@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "ROOT_DIR=%~dp0"
if "%ROOT_DIR:~-1%"=="\" set "ROOT_DIR=%ROOT_DIR:~0,-1%"
cd /d "%ROOT_DIR%"

set "SKIP_INSTALL=0"
set "INIT_ONLY=0"

:parse_args
if "%~1"=="" goto args_done
if /I "%~1"=="--skip-install" (
  set "SKIP_INSTALL=1"
  shift
  goto parse_args
)
if /I "%~1"=="--init-only" (
  set "INIT_ONLY=1"
  shift
  goto parse_args
)
if /I "%~1"=="--help" goto show_help
if /I "%~1"=="-h" goto show_help
echo Unknown argument: %~1
echo Use --help to see available options.
exit /b 1

:args_done
where npm >nul 2>&1
if errorlevel 1 (
  echo Error: npm is not installed or not in PATH.
  exit /b 1
)

echo.
echo Validating required component directories...
call :assert_component "frontend" "frontend" || exit /b 1
call :assert_component "gateway" "backend\gateway" || exit /b 1
call :assert_component "user-service" "backend\services\user-service" || exit /b 1
call :assert_component "credential-service" "backend\services\credential-service" || exit /b 1
call :assert_component "credential-request-service" "backend\services\credential-request-service" || exit /b 1
call :assert_component "notification-service" "backend\services\notification-service" || exit /b 1
call :assert_component "blockchain-interface-service" "backend\services\blockchain-interface-service" || exit /b 1
call :assert_component "backend-db" "backend\db" || exit /b 1

echo.
echo Validating required .env files...
call :assert_env_file "frontend\.env" || exit /b 1
call :assert_env_file "backend\gateway\.env" || exit /b 1
call :assert_env_file "backend\services\user-service\.env" || exit /b 1
call :assert_env_file "backend\services\credential-service\.env" || exit /b 1
call :assert_env_file "backend\services\credential-request-service\.env" || exit /b 1
call :assert_env_file "backend\services\notification-service\.env" || exit /b 1
call :assert_env_file "backend\services\blockchain-interface-service\.env" || exit /b 1

if "%SKIP_INSTALL%"=="0" (
  echo.
  echo Installing npm dependencies...
  call :install_component "backend-db" "backend\db" || exit /b 1
  call :install_component "frontend" "frontend" || exit /b 1
  call :install_component "gateway" "backend\gateway" || exit /b 1
  call :install_component "user-service" "backend\services\user-service" || exit /b 1
  call :install_component "credential-service" "backend\services\credential-service" || exit /b 1
  call :install_component "credential-request-service" "backend\services\credential-request-service" || exit /b 1
  call :install_component "notification-service" "backend\services\notification-service" || exit /b 1
  call :install_component "blockchain-interface-service" "backend\services\blockchain-interface-service" || exit /b 1
) else (
  echo.
  echo Skipping npm install because --skip-install was set.
)

echo.
echo Running shared Prisma initialization...
call :initialize_prisma || exit /b 1

if "%INIT_ONLY%"=="1" (
  echo.
  echo Initialization completed. Services were not started because --init-only was set.
  exit /b 0
)

echo.
echo Starting all services in separate Command Prompt windows...
call :start_service "frontend" "frontend" || exit /b 1
call :start_service "gateway" "backend\gateway" || exit /b 1
call :start_service "user-service" "backend\services\user-service" || exit /b 1
call :start_service "credential-service" "backend\services\credential-service" || exit /b 1
call :start_service "credential-request-service" "backend\services\credential-request-service" || exit /b 1
call :start_service "notification-service" "backend\services\notification-service" || exit /b 1
call :start_service "blockchain-interface-service" "backend\services\blockchain-interface-service" || exit /b 1

echo.
echo Initialization complete and all services have been launched.
echo Close the individual service windows to stop them.
exit /b 0

:show_help
echo Usage: init.cmd [--skip-install] [--init-only]
echo.
echo   --skip-install  Skip npm install for all components.
echo   --init-only     Run setup only (no services started).
exit /b 0

:assert_component
set "name=%~1"
set "rel_path=%~2"
if not exist "%ROOT_DIR%\%rel_path%\" (
  echo [%name%] Missing directory: %rel_path%
  exit /b 1
)
if not exist "%ROOT_DIR%\%rel_path%\package.json" (
  echo [%name%] Missing package.json: %rel_path%\package.json
  exit /b 1
)
exit /b 0

:assert_env_file
if not exist "%ROOT_DIR%\%~1" (
  echo Missing required file: %~1
  exit /b 1
)
exit /b 0

:install_component
set "name=%~1"
set "rel_path=%~2"
echo [%name%] npm install
pushd "%ROOT_DIR%\%rel_path%" >nul
call npm install --no-audit --no-fund
set "rc=%errorlevel%"
popd >nul
if not "%rc%"=="0" (
  echo [%name%] npm install failed with exit code %rc%.
  exit /b %rc%
)
exit /b 0

:initialize_prisma
set "prisma_client_path=%ROOT_DIR%\backend\db\node_modules\.prisma\client"
if exist "%prisma_client_path%" (
  echo [bootstrap] Removing existing shared Prisma client cache...
  rmdir /s /q "%prisma_client_path%"
)

pushd "%ROOT_DIR%\backend\services\user-service" >nul
echo [bootstrap] Generating shared Prisma client...
call npm run db:generate
if errorlevel 1 (
  popd >nul
  echo [bootstrap] Failed to generate Prisma client.
  exit /b 1
)

echo [bootstrap] Applying database migrations (migrate deploy)...
call npm run db:migrate:deploy
if errorlevel 1 (
  popd >nul
  echo [bootstrap] Failed to apply database migrations.
  exit /b 1
)
popd >nul

echo [bootstrap] Prisma initialization completed.
exit /b 0

:start_service
set "name=%~1"
set "rel_path=%~2"
echo [%name%] starting (npm run --ignore-scripts dev)
start "SACVS %name%" cmd /k "cd /d ""%ROOT_DIR%\%rel_path%"" && npm run --ignore-scripts dev"
if errorlevel 1 (
  echo [%name%] Failed to launch service window.
  exit /b 1
)
exit /b 0
