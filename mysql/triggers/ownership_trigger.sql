-- ============================================================
-- Views filter SELECT. They do nothing for UPDATE/DELETE -- a GRANT of
-- UPDATE on census_records lets an account update ANY row by primary key,
-- regardless of what the my_census_records view would let it see. These
-- triggers close that gap at the database level, so write-side ownership
-- doesn't depend on the application remembering to add the right WHERE
-- clause on every mutating query.
--
-- Also handles INSERT: rather than trusting the application to send the
-- correct created_by_user_id (which would mean trusting client input for
-- an authorization-relevant field), the BEFORE INSERT trigger stamps it
-- from @current_user_id itself.
-- ============================================================
 
USE census_demographics;
 
DELIMITER //
 
-- --- census_records itself ---
 
CREATE TRIGGER trg_census_records_stamp_owner
BEFORE INSERT ON census_records
FOR EACH ROW
BEGIN
  IF @current_user_id IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'no authenticated user on this connection (@current_user_id not set)';
  END IF;
  SET NEW.created_by_user_id = @current_user_id;
END//
 
CREATE TRIGGER trg_census_records_check_owner_update
BEFORE UPDATE ON census_records
FOR EACH ROW
BEGIN
  IF OLD.created_by_user_id IS NULL OR OLD.created_by_user_id != @current_user_id THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'not authorized to modify this census record';
  END IF;
END//
 
CREATE TRIGGER trg_census_records_check_owner_delete
BEFORE DELETE ON census_records
FOR EACH ROW
BEGIN
  IF OLD.created_by_user_id IS NULL OR OLD.created_by_user_id != @current_user_id THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'not authorized to delete this census record';
  END IF;
END//
 
-- --- breakdown tables ---
--
-- These don't have their own owner column (see 02_add_user_ownership.sql),
-- so ownership is checked by looking up the parent census_records row.
-- Without the INSERT triggers, an account with INSERT on e.g.
-- census_age_distribution could attach a row to *someone else's*
-- census_record_id directly -- the foreign key only guarantees that
-- census_record_id exists, not that it belongs to the current user.
-- UPDATE/DELETE check the *existing* row's parent (OLD.census_record_id),
-- otherwise someone could tamper with another user's population_count
-- without ever touching the protected census_records row itself.
 
CREATE TRIGGER trg_age_dist_check_owner_insert
BEFORE INSERT ON census_age_distribution
FOR EACH ROW
BEGIN
  IF (SELECT created_by_user_id FROM census_records WHERE census_record_id = NEW.census_record_id) != @current_user_id THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'not authorized to write to this census record''s breakdown';
  END IF;
END//
 
CREATE TRIGGER trg_age_dist_check_owner_update
BEFORE UPDATE ON census_age_distribution
FOR EACH ROW
BEGIN
  IF (SELECT created_by_user_id FROM census_records WHERE census_record_id = OLD.census_record_id) != @current_user_id THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'not authorized to modify this census record''s breakdown';
  END IF;
END//
 
CREATE TRIGGER trg_age_dist_check_owner_delete
BEFORE DELETE ON census_age_distribution
FOR EACH ROW
BEGIN
  IF (SELECT created_by_user_id FROM census_records WHERE census_record_id = OLD.census_record_id) != @current_user_id THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'not authorized to delete from this census record''s breakdown';
  END IF;
END//
 
CREATE TRIGGER trg_ethnicity_dist_check_owner_insert
BEFORE INSERT ON census_ethnicity_distribution
FOR EACH ROW
BEGIN
  IF (SELECT created_by_user_id FROM census_records WHERE census_record_id = NEW.census_record_id) != @current_user_id THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'not authorized to write to this census record''s breakdown';
  END IF;
END//
 
CREATE TRIGGER trg_ethnicity_dist_check_owner_update
BEFORE UPDATE ON census_ethnicity_distribution
FOR EACH ROW
BEGIN
  IF (SELECT created_by_user_id FROM census_records WHERE census_record_id = OLD.census_record_id) != @current_user_id THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'not authorized to modify this census record''s breakdown';
  END IF;
END//
 
CREATE TRIGGER trg_ethnicity_dist_check_owner_delete
BEFORE DELETE ON census_ethnicity_distribution
FOR EACH ROW
BEGIN
  IF (SELECT created_by_user_id FROM census_records WHERE census_record_id = OLD.census_record_id) != @current_user_id THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'not authorized to delete from this census record''s breakdown';
  END IF;
END//
 
CREATE TRIGGER trg_education_dist_check_owner_insert
BEFORE INSERT ON census_education_distribution
FOR EACH ROW
BEGIN
  IF (SELECT created_by_user_id FROM census_records WHERE census_record_id = NEW.census_record_id) != @current_user_id THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'not authorized to write to this census record''s breakdown';
  END IF;
END//
 
CREATE TRIGGER trg_education_dist_check_owner_update
BEFORE UPDATE ON census_education_distribution
FOR EACH ROW
BEGIN
  IF (SELECT created_by_user_id FROM census_records WHERE census_record_id = OLD.census_record_id) != @current_user_id THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'not authorized to modify this census record''s breakdown';
  END IF;
END//
 
CREATE TRIGGER trg_education_dist_check_owner_delete
BEFORE DELETE ON census_education_distribution
FOR EACH ROW
BEGIN
  IF (SELECT created_by_user_id FROM census_records WHERE census_record_id = OLD.census_record_id) != @current_user_id THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'not authorized to delete from this census record''s breakdown';
  END IF;
END//
 
CREATE TRIGGER trg_wealth_dist_check_owner_insert
BEFORE INSERT ON census_wealth_distribution
FOR EACH ROW
BEGIN
  IF (SELECT created_by_user_id FROM census_records WHERE census_record_id = NEW.census_record_id) != @current_user_id THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'not authorized to write to this census record''s breakdown';
  END IF;
END//
 
CREATE TRIGGER trg_wealth_dist_check_owner_update
BEFORE UPDATE ON census_wealth_distribution
FOR EACH ROW
BEGIN
  IF (SELECT created_by_user_id FROM census_records WHERE census_record_id = OLD.census_record_id) != @current_user_id THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'not authorized to modify this census record''s breakdown';
  END IF;
END//
 
CREATE TRIGGER trg_wealth_dist_check_owner_delete
BEFORE DELETE ON census_wealth_distribution
FOR EACH ROW
BEGIN
  IF (SELECT created_by_user_id FROM census_records WHERE census_record_id = OLD.census_record_id) != @current_user_id THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'not authorized to delete from this census record''s breakdown';
  END IF;
END//
 
DELIMITER ;

