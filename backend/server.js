// backend/server.js
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const csvParser = require('csv-parser');
const fs = require('fs');
const db = require('./db');
const authenticateToken = require('./middleware');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Ensure uploads directory exists
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}
const upload = multer({ dest: 'uploads/' });

app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(express.json());
app.use(cookieParser());

// ==========================================
// AUTHENTICATION ROUTES
// ==========================================
app.post('/api/register', async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'All fields are required.' });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 12);
    await db.execute(
      'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
      [username, email, passwordHash]
    );
    res.status(201).json({ message: 'Registered successfully.' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Username or email already exists.' });
    }
    res.status(500).json({ error: 'Registration failed.' });
  }
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const [rows] = await db.execute('SELECT * FROM users WHERE email = ?', [email]);
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const token = jwt.sign(
      { id: user.user_id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '2h' }
    );
    res.cookie('token', token, { httpOnly: true, sameSite: 'lax', maxAge: 7200000 });
    res.json({ message: 'Login successful!', username: user.username });
  } catch (err) {
    res.status(500).json({ error: 'Login failed.' });
  }
});

app.post('/api/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Logged out successfully.' });
});

app.get('/api/me', authenticateToken, (req, res) => {
  res.json({ authenticated: true, user: req.user });
});

// ==========================================
// SIMULATIONS & DATA INGESTION
// ==========================================

// 1. Fetch User Simulations
app.get('/api/simulations', authenticateToken, async (req, res) => {
  try {
    const [rows] = await db.execute(
      'SELECT simulation_id, title, parameters, results, created_at FROM simulations WHERE user_id = ? ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json({ simulations: rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch simulations.' });
  }
});

// 2. Run Scenario with Baseline Join Fallback
app.post('/api/simulations', authenticateToken, async (req, res) => {
  const {
    simType = 'exponential_growth',
    title,
    subdivisionName = 'British Columbia',
    annualGrowthRate,
    projectionYears,
    customDistributions
  } = req.body;
  const userId = req.user.id;

  if (!title) {
    return res.status(400).json({ error: 'Simulation title is required.' });
  }

  try {
    let basePop = 5500000;
    let baseYear = 2024;

    // Database Join Lookup for Baseline
    try {
      const [baselineRows] = await db.execute(
        `SELECT s.name AS subdivision_name, cr.census_year, cr.total_population
         FROM subdivisions s
         JOIN census_records cr ON cr.subdivision_id = s.subdivision_id
         WHERE s.name = ? ORDER BY cr.census_year DESC LIMIT 1`,
        [subdivisionName]
      );
      if (baselineRows.length > 0 && baselineRows[0].total_population) {
        basePop = Number(baselineRows[0].total_population);
        baseYear = Number(baselineRows[0].census_year);
      }
    } catch (dbErr) {
      console.log('Census tables not present, using default baseline values.');
    }

    const gRate = parseFloat(annualGrowthRate) || 0.015;
    const years = parseInt(projectionYears) || 10;

    let parameters = {
      sim_type: simType,
      subdivision: subdivisionName,
      baseline_year: baseYear,
      base_population: basePop,
      annual_growth_rate: gRate,
      projection_years: years
    };
    let results = {};

    if (simType === 'exponential_growth') {
      const projected = Math.round(basePop * Math.pow(1 + gRate, years));
      const timeSeries = [];
      for (let i = 0; i <= years; i++) {
        timeSeries.push({
          year: baseYear + i,
          baseline: Math.round(basePop * Math.pow(1.008, i)),
          simulated: Math.round(basePop * Math.pow(1 + gRate, i))
        });
      }
      results = {
        projected_population: projected,
        net_growth: projected - basePop,
        growth_percentage: `${(((projected - basePop) / basePop) * 100).toFixed(2)}%`,
        time_series: timeSeries
      };
    } else if (simType === 'wealth_distribution') {
      parameters.income_mode = customDistributions?.incomeMode || 'household';
      const brackets = [
        { name: 'Under $30k', percentage: 18 },
        { name: '$30k - $60k', percentage: 27 },
        { name: '$60k - $100k', percentage: 32 },
        { name: '$100k - $150k', percentage: 15 },
        { name: '$150k+', percentage: 8 }
      ];
      results = {
        distribution_data: brackets.map((b) => ({
          bracket: b.name,
          population: Math.round(basePop * (b.percentage / 100)),
          percentage: b.percentage
        }))
      };
    } else if (simType === 'age_gender_cohort') {
      const cohorts = [
        { age: '0-17', malePct: 9.8, femalePct: 9.2 },
        { age: '18-34', malePct: 14.5, femalePct: 13.8 },
        { age: '35-49', malePct: 12.2, femalePct: 12.0 },
        { age: '50-64', malePct: 11.0, femalePct: 11.5 },
        { age: '65+', malePct: 7.5, femalePct: 8.5 }
      ];
      results = {
        cohort_breakdown: cohorts.map((c) => ({
          age_bracket: c.age,
          male: Math.round(basePop * (c.malePct / 100)),
          female: Math.round(basePop * (c.femalePct / 100))
        }))
      };
    }

    await db.execute(
      'INSERT INTO simulations (user_id, title, parameters, results) VALUES (?, ?, ?, ?)',
      [userId, title, JSON.stringify(parameters), JSON.stringify(results)]
    );

    res.status(201).json({ message: 'Simulation created and executed successfully!' });
  } catch (err) {
    console.error('Simulation error:', err);
    res.status(500).json({ error: 'Failed to create simulation: ' + err.message });
  }
});

// 3. Upload & Stream Parse CSV Data
app.post('/api/simulations/upload-csv', authenticateToken, upload.single('csvFile'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Please upload a CSV file.' });

  const userId = req.user.id;
  const filePath = req.file.path;
  const rows = [];

  fs.createReadStream(filePath)
    .pipe(csvParser())
    .on('data', (row) => rows.push(row))
    .on('end', async () => {
      try {
        const title = req.body.title || `CSV Dataset: ${req.file.originalname}`;

        const ageGenderMap = {};
        const incomeCounts = {};

        rows.forEach((r) => {
          const count = parseInt(r.sample_count) || 1;
          const age = r.age_bracket || 'Unknown';
          const gender = (r.gender || 'Unknown').toLowerCase();
          const income = r.income_bracket || 'Unknown';

          // Group Age + Gender
          if (!ageGenderMap[age]) {
            ageGenderMap[age] = { age_bracket: age, male: 0, female: 0, other: 0 };
          }
          if (gender === 'male' || gender === 'm') ageGenderMap[age].male += count;
          else if (gender === 'female' || gender === 'f') ageGenderMap[age].female += count;
          else ageGenderMap[age].other += count;

          // Group Income
          incomeCounts[income] = (incomeCounts[income] || 0) + count;
        });

        const totalCount = rows.reduce((acc, r) => acc + (parseInt(r.sample_count) || 1), 0);

        const parameters = {
          sim_type: 'csv_dataset',
          total_records: rows.length,
          total_samples: totalCount,
          filename: req.file.originalname
        };

        const results = {
          parsed_count: rows.length,
          cohort_breakdown: Object.values(ageGenderMap),
          distribution_data: Object.keys(incomeCounts).map((k) => ({
            bracket: k,
            population: incomeCounts[k],
            percentage: ((incomeCounts[k] / totalCount) * 100).toFixed(1)
          }))
        };

        await db.execute(
          'INSERT INTO simulations (user_id, title, parameters, results) VALUES (?, ?, ?, ?)',
          [userId, title, JSON.stringify(parameters), JSON.stringify(results)]
        );

        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        res.status(201).json({
          message: `CSV processed successfully (${rows.length} rows, ${totalCount} samples).`
        });
      } catch (e) {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        res.status(500).json({ error: 'Failed to process CSV data.' });
      }
    });
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});