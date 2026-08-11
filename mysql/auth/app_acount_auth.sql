-- ============================================================
--
-- A dedicated, low-privilege account for the API to connect as -- not
-- root. Change 'change-this-password' before running anywhere but a
-- local throwaway database.
--
-- Granting UPDATE/DELETE directly on census_records does NOT work the
-- way you'd expect: `UPDATE census_records SET ... WHERE
-- census_record_id = ?` requires SELECT privilege on census_record_id
-- (any column read in a WHERE clause needs it, per MySQL's own
-- privilege model) -- which we deliberately never grant, since granting
-- it back would let 'census_app' run `SELECT * FROM census_records`
-- directly and defeat the whole point.
--
-- Fixed with SQL SECURITY DEFINER stored procedures: 'census_app' gets
-- EXECUTE on the procedure, not UPDATE/DELETE on the table. The
-- procedure's body runs with its definer's privileges, so the internal
-- UPDATE/DELETE doesn't hit the column-SELECT wall -- while the
-- ownership-check triggers from 04_ownership_triggers.sql still fire
-- normally, since session variables are connection-scoped, not
-- privilege-scoped.
--
-- ============================================================
 
USE census_demographics;
 
CREATE USER IF NOT EXISTS 'census_app'@'%' IDENTIFIED BY 'change-this-password';
 
-- --- shared/common data: read-only, unrestricted ---
GRANT SELECT ON census_demographics.common_countries TO 'census_app'@'%';
GRANT SELECT ON census_demographics.common_subdivisions TO 'census_app'@'%';
GRANT SELECT ON census_demographics.common_age_brackets TO 'census_app'@'%';
GRANT SELECT ON census_demographics.common_ethnicities TO 'census_app'@'%';
GRANT SELECT ON census_demographics.common_education_levels TO 'census_app'@'%';
GRANT SELECT ON census_demographics.common_wealth_brackets TO 'census_app'@'%';
 
-- --- private data: reads only through the my_* views ---
GRANT SELECT ON census_demographics.my_census_records TO 'census_app'@'%';
GRANT SELECT ON census_demographics.my_census_age_distribution TO 'census_app'@'%';
GRANT SELECT ON census_demographics.my_census_ethnicity_distribution TO 'census_app'@'%';
GRANT SELECT ON census_demographics.my_census_education_distribution TO 'census_app'@'%';
GRANT SELECT ON census_demographics.my_census_wealth_distribution TO 'census_app'@'%';
 
-- --- writes: INSERT direct, UPDATE/DELETE via procedure only ---
--
-- INSERT doesn't hit the WHERE-column-privilege issue (there's no
-- existing row to read), so it's granted directly. The BEFORE INSERT
-- trigger correctly overwrites any created_by_user_id the caller tries
-- to supply.
GRANT INSERT ON census_demographics.census_records TO 'census_app'@'%';
GRANT INSERT ON census_demographics.census_age_distribution TO 'census_app'@'%';
GRANT INSERT ON census_demographics.census_ethnicity_distribution TO 'census_app'@'%';
GRANT INSERT ON census_demographics.census_education_distribution TO 'census_app'@'%';
GRANT INSERT ON census_demographics.census_wealth_distribution TO 'census_app'@'%';
 
-- No UPDATE/DELETE grant on the breakdown tables at all -- by design,
-- the app never edits an individual breakdown row in place; it deletes
-- the whole census_records row (breakdown rows cascade automatically,
-- enforced by the storage engine regardless of the deleting session's
-- privileges on the child tables) and re-submits a fresh one.
 
DELIMITER //
 
CREATE PROCEDURE sp_update_census_record(
  IN p_census_record_id INT,
  IN p_total_population BIGINT,
  IN p_population_growth_rate DECIMAL(6,3),
  IN p_recorded_date DATE
)
SQL SECURITY DEFINER
BEGIN
  UPDATE census_records
  SET
    total_population = COALESCE(p_total_population, total_population),
    population_growth_rate = COALESCE(p_population_growth_rate, population_growth_rate),
    recorded_date = COALESCE(p_recorded_date, recorded_date)
  WHERE census_record_id = p_census_record_id;
END//
 
CREATE PROCEDURE sp_delete_census_record(
  IN p_census_record_id INT
)
SQL SECURITY DEFINER
BEGIN
  DELETE FROM census_records WHERE census_record_id = p_census_record_id;
END//
 
DELIMITER ;
 
GRANT EXECUTE ON PROCEDURE census_demographics.sp_update_census_record TO 'census_app'@'%';
GRANT EXECUTE ON PROCEDURE census_demographics.sp_delete_census_record TO 'census_app'@'%';
 
-- users: needed to authenticate (look up by username) and to let people
-- sign up. Nothing here stops 'census_app' from running `SELECT *
-- FROM users` in bulk -- GRANTs can't express "only ever WHERE username =
-- ?", that's an application-code discipline, not a database guarantee.
GRANT SELECT, INSERT ON census_demographics.users TO 'census_app'@'%';
 
-- execute on the session-variable wrapper function used by the my_* views
GRANT EXECUTE ON FUNCTION census_demographics.current_app_user_id TO 'census_app'@'%';
 
FLUSH PRIVILEGES;
 

