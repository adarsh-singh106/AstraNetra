@echo off
color 0A
echo ---------------------------------------------------
echo ⚡ Installing ASTRANETRA dependencies...
echo ---------------------------------------------------
call npm install

echo.
echo ---------------------------------------------------
echo ⚡ Registering 'astra' command globally...
echo ---------------------------------------------------
call npm link

echo.
echo ---------------------------------------------------
echo ✅ Setup Complete! 
echo You can now open ANY terminal and type: astra
echo ---------------------------------------------------
pause
