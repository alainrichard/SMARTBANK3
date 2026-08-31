# SmartBank AI — v4.0 (Next.js + Express + Python AI)

## Stack
- **Frontend**: Next.js 14 (App Router, TypeScript, Tailwind CSS)
- **Backend**: Node.js + Express
- **AI Service**: Python + scikit-learn + (optional TensorFlow)
- **Database**: PostgreSQL

## Quick Start

### 1. Database
```bash
psql -U postgres -c "CREATE DATABASE smartbank_db;"
psql -U postgres -d smartbank_db -f database/schema.sql
```

### 2. Backend
```bash
cd backend
npm install
# .env already configured with:
# DB_PASSWORD=2104
# SMTP_USER=alainrichard2009@gmail.com
# SMTP_PASS=pojy jbbw euhd ntky
npm run dev
# Runs on http://localhost:5000
```

### 3. AI Service
```bash
cd ai
pip install flask flask-cors psycopg2-binary python-dotenv requests scikit-learn joblib numpy pandas
# Optional: pip install tensorflow
python app.py
# Runs on http://localhost:8000
```

### 4. Frontend (Next.js)
```bash
cd frontend-nextjs
npm install
npm run dev
# Runs on http://localhost:3000
```

## Demo Accounts
| Role | Email | Password |
|------|-------|----------|
| Super Admin | admin@smartbank.rw | Admin@123456 |
| Branch Manager | manager@smartbank.rw | Staff@123456 |
| Fraud Analyst | analyst@smartbank.rw | Staff@123456 |
| Bank Staff | teller@smartbank.rw | Staff@123456 |
| Auditor | auditor@smartbank.rw | Staff@123456 |
| Customer | jean@example.com | Staff@123456 |

## Features
- AI fraud detection (RandomForest + rules)
- AI credit scoring (GradientBoosting)
- Behavioral anomaly detection (IsolationForest)
- Email notifications (welcome, login, OTP, transactions, loans, fraud alerts)
- Multi-language: English, French, Kinyarwanda
- Dark/Light mode
- Profile photo upload
- Loan applications with document upload + collateral for >5M RWF
- Reports: Excel, PDF, Word export
- GPS location detection
- Role-based access control
