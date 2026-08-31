@echo off
title SmartBank AI - Setup
color 0B
echo.
echo  =============================================
echo   SmartBank AI v3 - Environment Setup
echo  =============================================
echo.
set /p PW=Enter your PostgreSQL password (press Enter if none): 
echo.

(
echo NODE_ENV=development
echo PORT=5000
echo DB_HOST=localhost
echo DB_PORT=5432
echo DB_NAME=smartbank_db
echo DB_USER=postgres
echo DB_PASSWORD=%PW%
echo JWT_SECRET=smartbank_jwt_secret_32chars_minimum_here
echo JWT_EXPIRES_IN=2h
echo JWT_REFRESH_SECRET=smartbank_refresh_secret_32chars_here
echo JWT_REFRESH_EXPIRES_IN=7d
echo AI_SERVICE_URL=http://localhost:8000
echo FRONTEND_URL=http://localhost:3000
echo SMTP_HOST=smtp.gmail.com
echo SMTP_PORT=587
echo SMTP_USER=
echo SMTP_PASS=
) > backend\.env
echo  [OK] Created backend\.env

(
echo DB_HOST=localhost
echo DB_PORT=5432
echo DB_NAME=smartbank_db
echo DB_USER=postgres
echo DB_PASSWORD=%PW%
echo AI_PORT=8000
echo FLASK_ENV=development
) > ai\.env
echo  [OK] Created ai\.env

echo.
echo  Done! Now follow these steps:
echo.
echo  STEP 1 - Open a new Command Prompt in this folder and run:
echo    createdb -U postgres smartbank_db
echo    psql -U postgres -d smartbank_db -f database\schema.sql
echo.
echo  STEP 2 - Backend (new Command Prompt):
echo    cd backend
echo    npm install
echo    npm run dev
echo.
echo  STEP 3 - AI service (another Command Prompt):
echo    cd ai
echo    pip install flask flask-cors psycopg2-binary python-dotenv scikit-learn joblib numpy requests
echo    python app.py
echo.
echo  STEP 4 - Open the app:
echo    Double-click frontend\index.html
echo.
echo  Test logins:
echo    Customer : jean@example.com   /  Staff@123456
echo    Admin    : admin@smartbank.rw /  Admin@123456
echo.
pause
