
-- ============================================================
--
-- common_* views: plain pass-throughs over the reference/geography
-- tables. They don't filter anything -- their purpose is to give the
-- GRANT statements in 05_access_control.sql a stable surface to grant
-- against, decoupled from the base tables.
--
-- ============================================================
 
USE census_demographics;
 
-- --- common (shared, unfiltered) ---
 
CREATE OR REPLACE VIEW common_countries AS
  SELECT * FROM countries;
 
CREATE OR REPLACE VIEW common_subdivisions AS
  SELECT * FROM subdivisions;
 
CREATE OR REPLACE VIEW common_age_brackets AS
  SELECT * FROM age_brackets;
 
CREATE OR REPLACE VIEW common_ethnicities AS
  SELECT * FROM ethnicities;
 
CREATE OR REPLACE VIEW common_education_levels AS
  SELECT * FROM education_levels;
 
CREATE OR REPLACE VIEW common_wealth_brackets AS
  SELECT * FROM wealth_brackets;
 

