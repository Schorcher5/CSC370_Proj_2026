-- ============================================================
-- Justification of design descisions
-- ============================================================

-- Each table ends with the ENGIN table option set to InnoDB. 
-- While this is the default option and does not require an explicit declaration, we write this out explicitly in case we decide to alter which storage engine we want to use later on. 

-- When possible, attributes which are deemed to be optional or required have been explicitly given the NULL and NOT NULL options respectively. 
-- The reason behind this choice is to make it clear which attributes the authors have deemed to be optional or required for the main functionality of the app.
-- Hence any attribute which can be, but is neither declared to be NULL or NOT NULL, represents an error which must be corrected.

-- ============================================================
-- Census/demographic schema 
-- ============================================================

USE census_demographics;

-- ------------------------------------------------------------
-- Core geography
-- ------------------------------------------------------------

CREATE TABLE countries (
    country_id      INT AUTO_INCREMENT PRIMARY KEY,
    name            VARCHAR(150) NOT NULL,
    iso_code        CHAR(3) NOT NULL UNIQUE
) ENGINE=InnoDB;

CREATE TABLE subdivisions (
    subdivision_id          INT AUTO_INCREMENT PRIMARY KEY,
    country_id              INT NOT NULL,
    parent_subdivision_id   INT NULL,
    name                    VARCHAR(150) NOT NULL,
    subdivision_type        VARCHAR(50) NOT NULL,
    UNIQUE KEY uq_subdivision (country_id, parent_subdivision_id, name),
    FOREIGN KEY (country_id) REFERENCES countries(country_id),
    FOREIGN KEY (parent_subdivision_id) REFERENCES subdivisions(subdivision_id)
) ENGINE=InnoDB;

CREATE INDEX idx_subdivisions_country ON subdivisions(country_id);
CREATE INDEX idx_subdivisions_parent  ON subdivisions(parent_subdivision_id);

-- ------------------------------------------------------------
-- Dimension / lookup tables
-- ------------------------------------------------------------

CREATE TABLE age_brackets (
    age_bracket_id  INT AUTO_INCREMENT PRIMARY KEY,
    label           VARCHAR(20) NOT NULL,
    min_age         INT NOT NULL,
    max_age         INT NULL,
    CHECK (max_age IS NULL OR max_age >= min_age)
) ENGINE=InnoDB;

CREATE TABLE ethnicities (
    ethnicity_id    INT AUTO_INCREMENT PRIMARY KEY,
    country_id      INT NOT NULL,
    label           VARCHAR(100) NOT NULL,
    UNIQUE KEY uq_ethnicity (country_id, label),
    FOREIGN KEY (country_id) REFERENCES countries(country_id)
) ENGINE=InnoDB;

CREATE TABLE education_levels (
    education_level_id INT AUTO_INCREMENT PRIMARY KEY,
    label               VARCHAR(100) NOT NULL,
    level_rank          INT NOT NULL UNIQUE  -- was `rank` in the Postgres version; reserved word in MySQL 8+
) ENGINE=InnoDB;

CREATE TABLE wealth_brackets (
    wealth_bracket_id INT AUTO_INCREMENT PRIMARY KEY,
    label             VARCHAR(100) NOT NULL,
    min_income        DECIMAL(14,2) NULL,
    max_income        DECIMAL(14,2) NULL,
    CHECK (max_income IS NULL OR min_income IS NULL OR max_income >= min_income)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- Central fact table
-- ------------------------------------------------------------

CREATE TABLE census_records (
    census_record_id        INT AUTO_INCREMENT PRIMARY KEY,
    subdivision_id           INT NOT NULL,
    census_year              INT NOT NULL,
    total_population          BIGINT NOT NULL,
    population_growth_rate    DECIMAL(6,3) NULL,
    recorded_date             DATE NULL,
    UNIQUE KEY uq_census (subdivision_id, census_year),
    FOREIGN KEY (subdivision_id) REFERENCES subdivisions(subdivision_id),
    CHECK (total_population >= 0)
) ENGINE=InnoDB;

CREATE INDEX idx_census_subdivision_year ON census_records(subdivision_id, census_year);

-- ------------------------------------------------------------
-- Breakdown ("bridge") tables
-- ------------------------------------------------------------

CREATE TABLE census_age_distribution (
    census_record_id   INT NOT NULL,
    age_bracket_id      INT NOT NULL,
    population_count    BIGINT NOT NULL,
    PRIMARY KEY (census_record_id, age_bracket_id),
    FOREIGN KEY (census_record_id) REFERENCES census_records(census_record_id) ON DELETE CASCADE,
    FOREIGN KEY (age_bracket_id) REFERENCES age_brackets(age_bracket_id),
    CHECK (population_count >= 0)
) ENGINE=InnoDB;

CREATE TABLE census_ethnicity_distribution (
    census_record_id   INT NOT NULL,
    ethnicity_id         INT NOT NULL,
    population_count     BIGINT NOT NULL,
    PRIMARY KEY (census_record_id, ethnicity_id),
    FOREIGN KEY (census_record_id) REFERENCES census_records(census_record_id) ON DELETE CASCADE,
    FOREIGN KEY (ethnicity_id) REFERENCES ethnicities(ethnicity_id),
    CHECK (population_count >= 0)
) ENGINE=InnoDB;

CREATE TABLE census_education_distribution (
    census_record_id   INT NOT NULL,
    education_level_id   INT NOT NULL,
    population_count     BIGINT NOT NULL,
    PRIMARY KEY (census_record_id, education_level_id),
    FOREIGN KEY (census_record_id) REFERENCES census_records(census_record_id) ON DELETE CASCADE,
    FOREIGN KEY (education_level_id) REFERENCES education_levels(education_level_id),
    CHECK (population_count >= 0)
) ENGINE=InnoDB;

CREATE TABLE census_wealth_distribution (
    census_record_id   INT NOT NULL,
    wealth_bracket_id    INT NOT NULL,
    population_count     BIGINT NOT NULL,
    PRIMARY KEY (census_record_id, wealth_bracket_id),
    FOREIGN KEY (census_record_id) REFERENCES census_records(census_record_id) ON DELETE CASCADE,
    FOREIGN KEY (wealth_bracket_id) REFERENCES wealth_brackets(wealth_bracket_id),
    CHECK (population_count >= 0)
) ENGINE=InnoDB;

CREATE INDEX idx_age_dist_bracket     ON census_age_distribution(age_bracket_id);
CREATE INDEX idx_ethnicity_dist_eth   ON census_ethnicity_distribution(ethnicity_id);
CREATE INDEX idx_education_dist_level ON census_education_distribution(education_level_id);
CREATE INDEX idx_wealth_dist_bracket  ON census_wealth_distribution(wealth_bracket_id);
