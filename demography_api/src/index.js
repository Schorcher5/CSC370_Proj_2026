require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const authenticateToken = require('./middleware/authenticateToken');
const authRouter = require('./routes/auth');
const referenceRouter = require('./routes/reference');
const censusRecordsRouter = require('./routes/censusRecords');

if (!process.env.JWT_SECRET) {
  console.warn('WARNING: JWT_SECRET is not set -- using an insecure default. Set it in .env before this runs anywhere but your own machine.');
}

const app = express();

app.use(cors({
  origin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

app.get('/healthz', (req, res) => res.json({ ok: true }));

app.use('/api', authRouter);
app.use('/api/reference', referenceRouter);
app.use('/api/census-records', authenticateToken, censusRecordsRouter);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`demography_api listening on ${port}`));
