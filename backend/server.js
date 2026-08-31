const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
require('express-async-errors');
const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const morgan  = require('morgan');
const rateLimit = require('express-rate-limit');
const fs = require('fs');

const app = express();

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
const profilesDir = path.join(uploadsDir, 'profiles');
if (!fs.existsSync(profilesDir)) fs.mkdirSync(profilesDir, { recursive: true });
const loansDir = path.join(uploadsDir, 'loans');
if (!fs.existsSync(loansDir)) fs.mkdirSync(loansDir, { recursive: true });

app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({ origin: [process.env.FRONTEND_URL || 'http://localhost:3001', 'http://localhost:3000', 'http://localhost:3001'], credentials: true }));
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));

// Serve uploads statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api', rateLimit({ windowMs: 15*60*1000, max: 500, message: { success:false, message:'Too many requests' } }));
app.use('/api/auth/register', rateLimit({ windowMs: 60*60*1000, max: 10 }));

app.use('/api', require('./routes'));

app.get('/health', (req, res) => res.json({ status:'ok', time:new Date(), version:'3.0' }));
app.use((req, res) => res.status(404).json({ success:false, message:'Endpoint not found' }));
app.use((err, req, res, next) => {
  console.error('[Error]', err.stack || err.message);
  res.status(err.status || 500).json({ success:false, message: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`\n[SmartBank] API running on http://localhost:${PORT}`);
  console.log('[SmartBank] AI Service expected at', process.env.AI_SERVICE_URL || 'http://localhost:8000');
  console.log('[SmartBank] Frontend expected at',   process.env.FRONTEND_URL   || 'http://localhost:3000');
});

module.exports = app;
