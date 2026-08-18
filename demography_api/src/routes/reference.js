const express = require('express');
const { pool } = require('../db');

const router = express.Router();

const VIEWS = {
  countries: 'common_countries',
  subdivisions: 'common_subdivisions',
  'age-brackets': 'common_age_brackets',
  ethnicities: 'common_ethnicities',
  'education-levels': 'common_education_levels',
  'wealth-brackets': 'common_wealth_brackets',
};

for (const [path, view] of Object.entries(VIEWS)) {
  router.get(`/${path}`, async (req, res, next) => {
    try {
      const [rows] = await pool.query(`SELECT * FROM ${view}`);
      res.json(rows);
    } catch (err) {
      next(err);
    }
  });
}

module.exports = router;
