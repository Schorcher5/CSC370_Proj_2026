-- ============================================================
--
--  my_* views: filtered by a session variable, @current_user_id, that
--  the application must SET on the connection before querying them.
--  IMPORTANT: this only protects READS. See 04_ownership_triggers.sql
--  for why writes need separate enforcement, and note that
--  @current_user_id must be set fresh per request on a pooled
--  connection -- it doesn't survive being handed back to the pool.
--
-- ============================================================






-- --- my_* (filtered to @current_user_id) ---
--
-- MySQL does not allow a session variable (@current_user_id) to appear
-- directly in a view's SELECT -- CREATE VIEW rejects it with
-- "View's SELECT contains a variable or parameter". A stored function
-- wrapping the read is a legal indirection: MySQL only blocks the
-- literal @-variable syntax in the view body itself.
--
-- Must be NOT DETERMINISTIC: its result depends on session state that
-- changes between calls, and marking it deterministic would be a lie
-- the optimizer might act on.
DELIMITER //
CREATE FUNCTION current_app_user_id() RETURNS INT
NOT DETERMINISTIC READS SQL DATA
BEGIN
  RETURN @current_user_id;
END//
DELIMITER ;
 
-- A NULL created_by_user_id (pre-migration/import data) never equals
-- current_app_user_id(), so it simply doesn't show up in anyone's "my"
-- view -- it's not private to anyone, it's just not owned. It stays
-- visible through the base table to any account with direct table access
-- (e.g. an admin/reporting account -- see 05_access_control.sql).
 
CREATE OR REPLACE VIEW my_census_records AS
  SELECT cr.*
  FROM census_records cr
  WHERE cr.created_by_user_id = current_app_user_id();
 
CREATE OR REPLACE VIEW my_census_age_distribution AS
  SELECT cad.*
  FROM census_age_distribution cad
  JOIN census_records cr ON cr.census_record_id = cad.census_record_id
  WHERE cr.created_by_user_id = current_app_user_id();
 
CREATE OR REPLACE VIEW my_census_ethnicity_distribution AS
  SELECT ced.*
  FROM census_ethnicity_distribution ced
  JOIN census_records cr ON cr.census_record_id = ced.census_record_id
  WHERE cr.created_by_user_id = current_app_user_id();
 
CREATE OR REPLACE VIEW my_census_education_distribution AS
  SELECT ceduc.*
  FROM census_education_distribution ceduc
  JOIN census_records cr ON cr.census_record_id = ceduc.census_record_id
  WHERE cr.created_by_user_id = current_app_user_id();
 
CREATE OR REPLACE VIEW my_census_wealth_distribution AS
  SELECT cwd.*
  FROM census_wealth_distribution cwd
  JOIN census_records cr ON cr.census_record_id = cwd.census_record_id
  WHERE cr.created_by_user_id = current_app_user_id();
 

