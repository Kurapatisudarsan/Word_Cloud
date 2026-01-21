@echo off
echo ================================================
echo   Word Cloud Game - Automatic Setup
echo ================================================
echo.

echo [1/3] Setting up database tables...
python -c "import os; os.environ['DJANGO_SETTINGS_MODULE']='backend.settings'; import django; django.setup(); from django.db import connection; sql=open('create_tables.sql').read(); [connection.cursor().execute(s.strip()) for s in sql.split(';') if s.strip()]" 2>nul
if errorlevel 1 (
    echo    Database tables may already exist - continuing...
) else (
    echo    ✓ Database tables created!
)

echo.
echo [2/3] Starting Backend Server...
echo    Backend will run on: http://localhost:8000
start /B python manage.py runserver

timeout /t 3 /nobreak >nul

echo.
echo [3/3] Starting Frontend Server...
echo    Opening in new window...
start cmd /k "cd ..\frontend && npm install && npm run dev"

echo.
echo ================================================
echo   Setup Complete!
echo ================================================
echo.
echo   Frontend: http://localhost:5173
echo   Backend:  http://localhost:8000
echo.
echo   Opening browser in 5 seconds...
timeout /t 5 /nobreak >nul
start http://localhost:5173

echo.
echo   Press any key to stop servers...
pause >nul
