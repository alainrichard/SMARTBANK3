# SmartBank AI v8 — Setup Guide

## First-Time Setup (fresh database)
```powershell
psql -U postgres -c "CREATE DATABASE smartbank_db;"
psql -U postgres -d smartbank_db -f database/schema.sql
```

## EXISTING DATABASE — Run migration instead (fixes column errors)
```powershell
psql -U postgres -d smartbank_db -f database/migrate_v2.sql
```
This safely adds all new columns without dropping your data:
- branches: manager_id, province, district
- users: province, district, sector, village, preferred_branch_id, kyc fields

## Start order (3 separate terminals)
```powershell
# Terminal 1 — Backend (port 5000)
cd backend
npm install
npm run dev

# Terminal 2 — AI Service (port 8000)
cd ai
pip install flask flask-cors psycopg2-binary python-dotenv scikit-learn joblib numpy pandas requests
python app.py

# Terminal 3 — Frontend (port 3001)
cd frontend-nextjs
npm install
npm run dev
```
Open: http://localhost:3001

## Login Credentials
| Role | Email | Password |
|------|-------|----------|
| Super Admin | admin@smartbank.rw | Admin@123456 |
| Branch Manager | manager@smartbank.rw | Staff@123456 |
| Fraud Analyst | analyst@smartbank.rw | Staff@123456 |
| Bank Teller | teller@smartbank.rw | Staff@123456 |
| Auditor | auditor@smartbank.rw | Staff@123456 |
| Customer | jean@example.com | Staff@123456 |

## New AI Endpoints (app.py)
- GET /api/credit/advanced/:uid — Multi-source credit scoring
- GET /api/behavior/:uid — Customer behavior analytics
- GET /api/planning/:uid — Financial planning tools
- POST /api/liquidity — Bank-wide liquidity forecast (admin)
- POST /api/compliance/check — AML transaction screening
