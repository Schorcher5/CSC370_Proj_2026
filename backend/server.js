// backend/server.js
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('./db');
const authenticateToken = require('./middleware');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// ==========================================
// AUTHENTICATION ROUTES

app.post('/api/register', async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'All fields are required.' });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const sql = 'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)';
    await db.execute(sql, [username, email, passwordHash]);
    res.status(201).json({ message: 'User registered successfully!' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Username or Email already exists.' });
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

    const token = jwt.sign({ id: user.user_id, username: user.username }, process.env.JWT_SECRET, { expiresIn: '2h' });
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
// SIMULATIONS ROUTES

// 1. GET retrieve all simulations owned by user
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

// 2. POST create & run new simulation
app.post('/api/simulations', authenticateToken, async (req, res) => {
  const { title, subdivision, basePopulation, annualGrowthRate, projectionYears } = req.body;
  const userId = req.user.id;

  if (!title || !subdivision || !basePopulation || !annualGrowthRate || !projectionYears) {
    return res.status(400).json({ error: 'All simulation parameters are required.' });
  }

  try {
    const pCount = parseInt(basePopulation);
    const gRate = parseFloat(annualGrowthRate);
    const years = parseInt(projectionYears);

    // Build the parameters JSON payload
    const parameters = {
      subdivision: subdivision,
      base_population: pCount,
      annual_growth_rate: gRate,
      projection_years: years
    };

    // Compute simple compound projection for simulation results
    // Formula: P_final = P_0 * (1 + r)^t
    const projectedPopulation = Math.round(pCount * Math.pow(1 + gRate, years));
    const netChange = projectedPopulation - pCount;

    const results = {
      projected_population: projectedPopulation,
      net_growth: netChange,
      growth_percentage: `${((netChange / pCount) * 100).toFixed(2)}%`
    };

    // Insert row directly into simulations table
    const sql = 'INSERT INTO simulations (user_id, title, parameters, results) VALUES (?, ?, ?, ?)';
    await db.execute(sql, [
      userId,
      title,
      JSON.stringify(parameters),
      JSON.stringify(results)
    ]);

    res.status(201).json({ message: 'Simulation created and executed successfully!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create simulation.' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});