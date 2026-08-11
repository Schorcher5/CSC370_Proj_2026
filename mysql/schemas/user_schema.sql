-- ============================================================
-- Design choice: ownership lives on census_records only.
-- census_age_distribution / census_ethnicity_distribution /
-- census_education_distribution / census_wealth_distribution don't get
-- their own owner column -- they're owned transitively through
-- census_record_id, since a breakdown row is meaningless without its
-- parent record. Duplicating the owner onto all four tables would just
-- create four more places for it to drift out of sync.
-- ============================================================
 
USE census_demographics;
 
CREATE TABLE users (
    user_id       INT AUTO_INCREMENT PRIMARY KEY,
    username      VARCHAR(50) NOT NULL UNIQUE,
    email         VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;
 
-- Nullable rather than NOT NULL: existing rows (e.g. from a data import)
-- have no real owner, and that's fine -- see the note on my_census_records
-- in 03_views.sql for what a NULL owner means for visibility. New rows
-- written by the app should always set this explicitly (in practice: the
-- BEFORE INSERT trigger in 04_ownership_triggers.sql does this for you).
ALTER TABLE census_records
    ADD COLUMN created_by_user_id INT NULL AFTER subdivision_id,
    ADD FOREIGN KEY (created_by_user_id) REFERENCES users(user_id);
 
CREATE INDEX idx_census_records_owner ON census_records(created_by_user_id);

