-- ============================================================
-- A set of stored procedures wrapping multi-statement operations on this
-- schema that genuinely need atomicity -- each is explained inline with
-- what specifically goes wrong without a transaction. All are
-- SQL SECURITY DEFINER (for the same reason as sp_update_census_record /
-- sp_delete_census_record in 05_access_control.sql) and ownership-checked
-- against @current_user_id.
--
-- Each procedure explicitly START TRANSACTION / COMMITs (with a ROLLBACK
-- handler on error) rather than relying on the caller to wrap it, so it's
-- atomic no matter what calls it -- the mysql CLI, an app, anything.
-- ============================================================
 
USE census_demographics;
 
DELIMITER //
 
-- ------------------------------------------------------------
-- 1. Submit a full census record: the record itself plus all four
-- breakdown tables, as one atomic unit.
--
-- Without a transaction: the record insert could succeed and one of the
-- four breakdown inserts could fail (bad dimension id, connection drop
-- mid-request), leaving a census_records row with an incomplete or
-- missing breakdown.
--
-- Breakdown arrays are passed as JSON, e.g.
-- '[{"id":1,"count":25000},{"id":2,"count":75000}]', and unpacked with
-- JSON_TABLE -- MySQL procedures can't take a variable-length list of
-- rows as a parameter directly.
-- ------------------------------------------------------------
 
CREATE PROCEDURE sp_submit_census_record(
  IN p_subdivision_id INT,
  IN p_census_year INT,
  IN p_total_population BIGINT,
  IN p_population_growth_rate DECIMAL(6,3),
  IN p_recorded_date DATE,
  IN p_age_json JSON,
  IN p_ethnicity_json JSON,
  IN p_education_json JSON,
  IN p_wealth_json JSON,
  OUT p_new_census_record_id INT
)
SQL SECURITY DEFINER
BEGIN
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;
 
  START TRANSACTION;
 
  INSERT INTO census_records
    (subdivision_id, census_year, total_population, population_growth_rate, recorded_date)
    -- created_by_user_id is NOT set here -- the BEFORE INSERT trigger
    -- (04_ownership_triggers.sql) stamps it from @current_user_id itself
  VALUES
    (p_subdivision_id, p_census_year, p_total_population, p_population_growth_rate, p_recorded_date);
 
  SET p_new_census_record_id = LAST_INSERT_ID();
 
  INSERT INTO census_age_distribution (census_record_id, age_bracket_id, population_count)
    SELECT p_new_census_record_id, jt.id, jt.count
    FROM JSON_TABLE(p_age_json, '$[*]' COLUMNS (id INT PATH '$.id', count BIGINT PATH '$.count')) AS jt;
 
  INSERT INTO census_ethnicity_distribution (census_record_id, ethnicity_id, population_count)
    SELECT p_new_census_record_id, jt.id, jt.count
    FROM JSON_TABLE(p_ethnicity_json, '$[*]' COLUMNS (id INT PATH '$.id', count BIGINT PATH '$.count')) AS jt;
 
  INSERT INTO census_education_distribution (census_record_id, education_level_id, population_count)
    SELECT p_new_census_record_id, jt.id, jt.count
    FROM JSON_TABLE(p_education_json, '$[*]' COLUMNS (id INT PATH '$.id', count BIGINT PATH '$.count')) AS jt;
 
  INSERT INTO census_wealth_distribution (census_record_id, wealth_bracket_id, population_count)
    SELECT p_new_census_record_id, jt.id, jt.count
    FROM JSON_TABLE(p_wealth_json, '$[*]' COLUMNS (id INT PATH '$.id', count BIGINT PATH '$.count')) AS jt;
 
  COMMIT;
END//
 
-- ------------------------------------------------------------
-- 2. Revise a census record's total_population and proportionally
-- rescale every breakdown table to match.
--
-- Without a transaction (and without the rescaling): updating
-- total_population alone silently breaks the invariant that
-- age/ethnicity/wealth counts sum to it, and leaves education's implied
-- adult-population ratio wrong too.
--
-- Rescaling each row by a flat ratio and rounding independently doesn't
-- generally sum back to an exact total (rounding drift), so each
-- rescale dumps the leftover remainder onto whichever bracket is
-- currently largest.
--
-- Education is rescaled to preserve whatever adult-population ratio the
-- *existing* data already implies (old_education_sum / old_total),
-- rather than assuming a fixed ratio.
-- ------------------------------------------------------------
 
CREATE PROCEDURE sp_rescale_breakdown_table(
  IN p_table_name VARCHAR(64),
  IN p_id_column VARCHAR(64),
  IN p_census_record_id INT,
  IN p_target_sum BIGINT
)
SQL SECURITY DEFINER
proc_label: BEGIN
  -- Internal helper, not ownership-checked itself -- only called from
  -- within sp_revise_census_population below, which does the check once
  -- for the whole operation. Table/column names are always the fixed
  -- literals passed by that caller, never client input, so building SQL
  -- text with them here doesn't reopen the injection risk parameterized
  -- queries exist to close.
  SET @old_sum = 0;
  SET @sql = CONCAT('SELECT SUM(population_count) INTO @old_sum FROM ', p_table_name, ' WHERE census_record_id = ?');
  PREPARE stmt FROM @sql;
  SET @rec_id = p_census_record_id;
  EXECUTE stmt USING @rec_id;
  DEALLOCATE PREPARE stmt;
 
  IF @old_sum IS NULL OR @old_sum = 0 THEN
    -- nothing to rescale (no rows, or a zero-population record) -- leave as is
    LEAVE proc_label;
  END IF;
 
  SET @sql = CONCAT(
    'UPDATE ', p_table_name,
    ' SET population_count = ROUND(population_count * ? / ?)',
    ' WHERE census_record_id = ?'
  );
  PREPARE stmt FROM @sql;
  SET @target = p_target_sum, @old = @old_sum, @rec_id = p_census_record_id;
  EXECUTE stmt USING @target, @old, @rec_id;
  DEALLOCATE PREPARE stmt;
 
  SET @scaled_sum = 0;
  SET @sql = CONCAT('SELECT SUM(population_count) INTO @scaled_sum FROM ', p_table_name, ' WHERE census_record_id = ?');
  PREPARE stmt FROM @sql;
  EXECUTE stmt USING @rec_id;
  DEALLOCATE PREPARE stmt;
 
  SET @diff = p_target_sum - @scaled_sum;
 
  IF @diff != 0 THEN
    SET @sql = CONCAT(
      'UPDATE ', p_table_name,
      ' SET population_count = population_count + ?',
      ' WHERE census_record_id = ? ORDER BY population_count DESC LIMIT 1'
    );
    PREPARE stmt FROM @sql;
    EXECUTE stmt USING @diff, @rec_id;
    DEALLOCATE PREPARE stmt;
  END IF;
END//
 
CREATE PROCEDURE sp_revise_census_population(
  IN p_census_record_id INT,
  IN p_new_total_population BIGINT
)
SQL SECURITY DEFINER
BEGIN
  DECLARE v_owner INT;
  DECLARE v_old_total BIGINT;
  DECLARE v_old_education_sum BIGINT;
  DECLARE v_new_education_target BIGINT;
 
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;
 
  SELECT created_by_user_id, total_population INTO v_owner, v_old_total
  FROM census_records WHERE census_record_id = p_census_record_id;
 
  IF v_owner IS NULL OR v_owner != @current_user_id THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'not authorized to revise this census record';
  END IF;
 
  START TRANSACTION;
 
  SELECT SUM(population_count) INTO v_old_education_sum
  FROM census_education_distribution WHERE census_record_id = p_census_record_id;
  SET v_new_education_target = ROUND(p_new_total_population * (v_old_education_sum / v_old_total));
 
  UPDATE census_records SET total_population = p_new_total_population
  WHERE census_record_id = p_census_record_id;
 
  CALL sp_rescale_breakdown_table('census_age_distribution', 'age_bracket_id', p_census_record_id, p_new_total_population);
  CALL sp_rescale_breakdown_table('census_ethnicity_distribution', 'ethnicity_id', p_census_record_id, p_new_total_population);
  CALL sp_rescale_breakdown_table('census_wealth_distribution', 'wealth_bracket_id', p_census_record_id, p_new_total_population);
  CALL sp_rescale_breakdown_table('census_education_distribution', 'education_level_id', p_census_record_id, v_new_education_target);
 
  COMMIT;
END//
 
-- ------------------------------------------------------------
-- 3. Clone a census record forward to a new year: copies the record and
-- its full breakdown as a starting point for editing, rather than
-- starting the next year's entry from a blank form.
--
-- Without a transaction: the same partial-write risk as #1 -- the new
-- census_records row could be created with only some of its breakdown
-- copied over.
-- ------------------------------------------------------------
 
CREATE PROCEDURE sp_clone_census_record_to_year(
  IN p_source_census_record_id INT,
  IN p_new_census_year INT,
  OUT p_new_census_record_id INT
)
SQL SECURITY DEFINER
BEGIN
  DECLARE v_owner INT;
  DECLARE v_subdivision_id INT;
  DECLARE v_total_population BIGINT;
 
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;
 
  SELECT created_by_user_id, subdivision_id, total_population
    INTO v_owner, v_subdivision_id, v_total_population
  FROM census_records WHERE census_record_id = p_source_census_record_id;
 
  IF v_owner IS NULL OR v_owner != @current_user_id THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'not authorized to clone this census record';
  END IF;
 
  START TRANSACTION;
 
  INSERT INTO census_records (subdivision_id, census_year, total_population, population_growth_rate, recorded_date)
  VALUES (v_subdivision_id, p_new_census_year, v_total_population, NULL, NULL);
  -- population_growth_rate/recorded_date reset to NULL rather than
  -- copied -- they describe this specific census event, not the source
  -- one, and are meaningless (or actively wrong) carried over verbatim
 
  SET p_new_census_record_id = LAST_INSERT_ID();
 
  INSERT INTO census_age_distribution (census_record_id, age_bracket_id, population_count)
    SELECT p_new_census_record_id, age_bracket_id, population_count
    FROM census_age_distribution WHERE census_record_id = p_source_census_record_id;
 
  INSERT INTO census_ethnicity_distribution (census_record_id, ethnicity_id, population_count)
    SELECT p_new_census_record_id, ethnicity_id, population_count
    FROM census_ethnicity_distribution WHERE census_record_id = p_source_census_record_id;
 
  INSERT INTO census_education_distribution (census_record_id, education_level_id, population_count)
    SELECT p_new_census_record_id, education_level_id, population_count
    FROM census_education_distribution WHERE census_record_id = p_source_census_record_id;
 
  INSERT INTO census_wealth_distribution (census_record_id, wealth_bracket_id, population_count)
    SELECT p_new_census_record_id, wealth_bracket_id, population_count
    FROM census_wealth_distribution WHERE census_record_id = p_source_census_record_id;
 
  COMMIT;
END//
 
-- ------------------------------------------------------------
-- 4. Delete a user account without silently destroying or orphaning
-- their census data.
--
-- Without a transaction: DELETE FROM users fails outright with a
-- foreign key error the moment that user owns any census_records --
-- there is otherwise no way to delete an account that has ever
-- submitted data. This procedure decides what happens to that data
-- explicitly rather than leaving it as an unhandled error, and does
-- both steps atomically so a user is never left half-deleted.
--
-- Default here: orphan the records (set created_by_user_id to NULL)
-- rather than delete them -- census data has value independent of who
-- submitted it, and NULL already means "not owned by anyone" everywhere
-- else in this schema (03_views.sql). p_hard_delete_data=TRUE switches
-- to actually deleting the user's records instead (e.g. for an actual
-- right-to-be-forgotten request, where orphaning isn't sufficient).
-- ------------------------------------------------------------
 
CREATE PROCEDURE sp_delete_user_account(
  IN p_user_id INT,
  IN p_hard_delete_data BOOLEAN
)
SQL SECURITY DEFINER
BEGIN
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;
 
  START TRANSACTION;
 
  IF p_hard_delete_data THEN
    DELETE FROM census_records WHERE created_by_user_id = p_user_id;
    -- breakdown rows cascade automatically (ON DELETE CASCADE, schema)
  ELSE
    UPDATE census_records SET created_by_user_id = NULL WHERE created_by_user_id = p_user_id;
  END IF;
 
  DELETE FROM users WHERE user_id = p_user_id;
 
  COMMIT;
END//
 
DELIMITER ;
 
-- census_app calls these directly; it doesn't need EXECUTE on
-- sp_rescale_breakdown_table since only sp_revise_census_population
-- calls it, from inside its own DEFINER context.
GRANT EXECUTE ON PROCEDURE census_demographics.sp_submit_census_record TO 'census_app'@'%';
GRANT EXECUTE ON PROCEDURE census_demographics.sp_revise_census_population TO 'census_app'@'%';
GRANT EXECUTE ON PROCEDURE census_demographics.sp_clone_census_record_to_year TO 'census_app'@'%';
GRANT EXECUTE ON PROCEDURE census_demographics.sp_delete_user_account TO 'census_app'@'%';
 

