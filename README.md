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

## CI / Automated builds

This repository includes a GitHub Actions workflow that builds the Next.js frontend and installs backend dependencies on push/PR. The workflow file is at `.github/workflows/ci.yml`.

## Docker / Local development

Preferred local setup uses Docker Compose (Postgres + backend + ai). If Docker Desktop is installed, run:

```powershell
cd "d:\my projects\smartbank3"
docker compose up -d postgres
```

If you prefer to run Postgres locally and apply the schema manually, use the helper scripts in `scripts/`:

PowerShell:
```powershell
./scripts/apply_schema.ps1 -Host localhost -Port 5432 -User postgres -Database smartbank_db -File database/schema.sql
```

POSIX:
```bash
./scripts/apply_schema.sh localhost 5432 postgres smartbank_db database/schema.sql
```

Note: Do not commit build artifacts (frontend `.next`) — they are removed from history and ignored by `.gitignore`.
