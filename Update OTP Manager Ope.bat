@echo off
echo Memulai update dari GitHub...
set REPO_URL=https://github.com/danie-lung/otp-manager-ope/archive/refs/heads/main.zip
set ZIP_FILE=update.zip
set EXTRACT_DIR=temp_update

echo Mengunduh file...
powershell -Command "Invoke-WebRequest -Uri '%REPO_URL%' -OutFile '%ZIP_FILE%'"

echo Mengekstrak file...
powershell -Command "Expand-Archive -Path '%ZIP_FILE%' -DestinationPath '%EXTRACT_DIR%' -Force"

echo Menyalin file baru...
xcopy "%EXTRACT_DIR%\otp-manager-ope-main\*" "." /E /Y /I

echo Membersihkan file sementara...
del "%ZIP_FILE%"
rmdir "%EXTRACT_DIR%" /S /Q

echo Update selesai!
pause