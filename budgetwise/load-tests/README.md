# BudgetWise Load Tests (k6)

These scripts run load tests against the Dockerized BudgetWise backend.

## What is included

- `k6-smoke.js`: quick sanity test (25 concurrent virtual users for 2 minutes)
- `k6-ramp.js`: ramps load up to 300 concurrent virtual users
- `k6-stress.js`: stress test up to 1000 concurrent virtual users

## Prerequisites

- Docker Desktop installed and running
- Project pulled locally
- Run commands from the `budgetwise` folder

## 1) Start the app stack

```powershell
cd budgetwise
docker compose up --build
```

Wait until backend and frontend are healthy and backend is listening on port `5001`.

## 2) Run tests (separate terminal)

Open a second terminal in `budgetwise` and run one test at a time:

```powershell
npm run load:smoke
npm run load:ramp
npm run load:stress
```

Recommended order: smoke -> ramp -> stress.

## 3) Optional: run authenticated read/write traffic

Without a token, tests still hit `/api/health`.
To include authenticated endpoints and database writes:

```powershell
$env:TOKEN="<paste-valid-jwt-here>"
$env:ENABLE_WRITES="1"
npm run load:ramp
```

### One-command login + run (recommended for teammates)

Use the auth helper scripts from `budgetwise`:
Note: Email and Password must be from an exisiting account
Note: Anything past smoke will be taxing on your machine

```powershell
npm run load:smoke:auth -- -Email "test@example.com" -Password "your_password"
npm run load:ramp:auth -- -Email "test@example.com" -Password "your_password" -EnableWrites
npm run load:stress:auth -- -Email "test@example.com" -Password "your_password" -EnableWrites
```

These commands:
- log in with `/api/auth/login`
- capture JWT automatically
- run k6 with `TOKEN` set
- include writes only when `-EnableWrites` is passed

### Getting a JWT quickly

If you already have a test account, log in and copy the `token` from response.
Example (PowerShell):

```powershell
$body = @{
  email = "test@example.com"
  password = "your_password"
} | ConvertTo-Json

Invoke-RestMethod `
  -Method Post `
  -Uri "http://localhost:5001/api/auth/login" `
  -ContentType "application/json" `
  -Body $body
```

Then:

```powershell
$env:TOKEN="<token-from-login-response>"
```

## 4) Optional: change API target URL

```powershell
$env:BASE_URL="http://localhost:5001"
npm run load:smoke
```

## 5) What to look at in results

- `http_req_failed`: request failure rate
- `http_req_duration`: latency (p95/p99 are most useful)
- `http_reqs`: throughput (requests/second)

For team comparisons, keep scenarios and machine conditions the same each run.

## Notes

- Write-enabled tests create expense rows, so use a test account/database.
- If stress test overwhelms your machine, lower VUs/stages in `k6-stress.js`.
- Let each test finish to get full summary metrics.
