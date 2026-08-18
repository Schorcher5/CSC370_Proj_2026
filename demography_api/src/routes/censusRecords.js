const express = require('express');
const { withUserConnection } = require('../db');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const rows = await withUserConnection(req.user.id, async (conn) => {
      const [rows] = await conn.query('SELECT * FROM my_census_records ORDER BY census_year');
      return rows;
    });
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.get('/:id/breakdown', async (req, res, next) => {
  try {
    const breakdown = await withUserConnection(req.user.id, async (conn) => {
      const tables = {
        age: 'my_census_age_distribution',
        ethnicity: 'my_census_ethnicity_distribution',
        education: 'my_census_education_distribution',
        wealth: 'my_census_wealth_distribution',
      };
      const out = {};
      for (const [key, view] of Object.entries(tables)) {
        const [rows] = await conn.query(
          `SELECT * FROM ${view} WHERE census_record_id = ?`,
          [req.params.id],
        );
        out[key] = rows;
      }
      return out;
    });
    res.json(breakdown);
  } catch (err) {
    next(err);
  }
});

// Submits a full record (the record itself + all four breakdowns) in
// one atomic call to sp_submit_census_record -- see
// mysql/transactions/common_transactions.sql for why this needs to be
// one transaction rather than five separate INSERTs from here.
router.post('/', async (req, res, next) => {
  try {
    const {
      subdivision_id, census_year, total_population,
      population_growth_rate, recorded_date,
      age, ethnicity, education, wealth,
    } = req.body;

    const newId = await withUserConnection(req.user.id, async (conn) => {
      await conn.query(
        'CALL sp_submit_census_record(?, ?, ?, ?, ?, ?, ?, ?, ?, @new_id)',
        [
          subdivision_id, census_year, total_population,
          population_growth_rate ?? null, recorded_date ?? null,
          JSON.stringify(age ?? []),
          JSON.stringify(ethnicity ?? []),
          JSON.stringify(education ?? []),
          JSON.stringify(wealth ?? []),
        ],
      );
      const [[{ '@new_id': id }]] = await conn.query('SELECT @new_id');
      return id;
    });

    res.status(201).json({ census_record_id: newId });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
