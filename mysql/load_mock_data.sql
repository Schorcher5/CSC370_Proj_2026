-- ============================================================

-- Loads the 11 mock CSVs into census_demographics.

-- Order matters: parents must load before children that FK to them.

-- Assumes the CSVs have already been copied into the container at "/var/lib/mysql-files/census_data/".
-- Should probably include some check for the exists of this data, but I'm lazy.

-- ============================================================

USE census_demographics;

-- 1. countries
LOAD DATA INFILE '/var/lib/mysql-files/census_data/countries.csv'
INTO TABLE countries
FIELDS TERMINATED BY ',' OPTIONALLY ENCLOSED BY '"'
LINES TERMINATED BY '\n'
IGNORE 1 LINES
(country_id, name, iso_code);

-- 2. subdivisions (self-referencing FK; file lists parents before children)
LOAD DATA INFILE '/var/lib/mysql-files/census_data/subdivisions.csv'
INTO TABLE subdivisions
FIELDS TERMINATED BY ',' OPTIONALLY ENCLOSED BY '"'
LINES TERMINATED BY '\n'
IGNORE 1 LINES
(subdivision_id, country_id, @parent_subdivision_id, name, subdivision_type)
SET parent_subdivision_id = NULLIF(@parent_subdivision_id, '');

-- 3. age_brackets
LOAD DATA INFILE '/var/lib/mysql-files/census_data/age_brackets.csv'
INTO TABLE age_brackets
FIELDS TERMINATED BY ',' OPTIONALLY ENCLOSED BY '"'
LINES TERMINATED BY '\n'
IGNORE 1 LINES
(age_bracket_id, label, min_age, @max_age)
SET max_age = NULLIF(@max_age, '');

-- 4. ethnicities
LOAD DATA INFILE '/var/lib/mysql-files/census_data/ethnicities.csv'
INTO TABLE ethnicities
FIELDS TERMINATED BY ',' OPTIONALLY ENCLOSED BY '"'
LINES TERMINATED BY '\n'
IGNORE 1 LINES
(ethnicity_id, country_id, label);

-- 5. education_levels (CSV header is `rank`, table column is `level_rank`)
LOAD DATA INFILE '/var/lib/mysql-files/census_data/education_levels.csv'
INTO TABLE education_levels
FIELDS TERMINATED BY ',' OPTIONALLY ENCLOSED BY '"'
LINES TERMINATED BY '\n'
IGNORE 1 LINES
(education_level_id, label, level_rank);

-- 6. wealth_brackets
LOAD DATA INFILE '/var/lib/mysql-files/census_data/wealth_brackets.csv'
INTO TABLE wealth_brackets
FIELDS TERMINATED BY ',' OPTIONALLY ENCLOSED BY '"'
LINES TERMINATED BY '\n'
IGNORE 1 LINES
(wealth_bracket_id, label, min_income, @max_income)
SET max_income = NULLIF(@max_income, '');

-- 7. census_records
LOAD DATA INFILE '/var/lib/mysql-files/census_data/census_records.csv'
INTO TABLE census_records
FIELDS TERMINATED BY ',' OPTIONALLY ENCLOSED BY '"'
LINES TERMINATED BY '\n'
IGNORE 1 LINES
(census_record_id, subdivision_id, census_year, total_population, @growth_rate, recorded_date)
SET population_growth_rate = NULLIF(@growth_rate, '');

-- 8. census_age_distribution
LOAD DATA INFILE '/var/lib/mysql-files/census_data/census_age_distribution.csv'
INTO TABLE census_age_distribution
FIELDS TERMINATED BY ',' OPTIONALLY ENCLOSED BY '"'
LINES TERMINATED BY '\n'
IGNORE 1 LINES
(census_record_id, age_bracket_id, population_count);

-- 9. census_ethnicity_distribution
LOAD DATA INFILE '/var/lib/mysql-files/census_data/census_ethnicity_distribution.csv'
INTO TABLE census_ethnicity_distribution
FIELDS TERMINATED BY ',' OPTIONALLY ENCLOSED BY '"'
LINES TERMINATED BY '\n'
IGNORE 1 LINES
(census_record_id, ethnicity_id, population_count);

-- 10. census_education_distribution
LOAD DATA INFILE '/var/lib/mysql-files/census_data/census_education_distribution.csv'
INTO TABLE census_education_distribution
FIELDS TERMINATED BY ',' OPTIONALLY ENCLOSED BY '"'
LINES TERMINATED BY '\n'
IGNORE 1 LINES
(census_record_id, education_level_id, population_count);

-- 11. census_wealth_distribution
LOAD DATA INFILE '/var/lib/mysql-files/census_data/census_wealth_distribution.csv'
INTO TABLE census_wealth_distribution
FIELDS TERMINATED BY ',' OPTIONALLY ENCLOSED BY '"'
LINES TERMINATED BY '\n'
IGNORE 1 LINES
(census_record_id, wealth_bracket_id, population_count);

-- Sanity check: row counts per table
SELECT 'countries' AS tbl, COUNT(*) FROM countries
UNION ALL SELECT 'subdivisions', COUNT(*) FROM subdivisions
UNION ALL SELECT 'age_brackets', COUNT(*) FROM age_brackets
UNION ALL SELECT 'ethnicities', COUNT(*) FROM ethnicities
UNION ALL SELECT 'education_levels', COUNT(*) FROM education_levels
UNION ALL SELECT 'wealth_brackets', COUNT(*) FROM wealth_brackets
UNION ALL SELECT 'census_records', COUNT(*) FROM census_records
UNION ALL SELECT 'census_age_distribution', COUNT(*) FROM census_age_distribution
UNION ALL SELECT 'census_ethnicity_distribution', COUNT(*) FROM census_ethnicity_distribution
UNION ALL SELECT 'census_education_distribution', COUNT(*) FROM census_education_distribution
UNION ALL SELECT 'census_wealth_distribution', COUNT(*) FROM census_wealth_distribution;
