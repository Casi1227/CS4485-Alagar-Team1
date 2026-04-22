# BudgetWise Unified

Full stack BudgetWise app with Next.js frontend and Express + Prisma backend.

## Tech Stack

Frontend: Next.js, TypeScript

Backend: Express, TypeScript, Prisma

Mail server: Postfix 3.10+

Database: PostgreSQL

Auth: JWT

Containerization: Docker, Docker Compose

---

## Project Structure

budgetwise/

* backend: API server
* frontend: Next.js UI
* mail-server: mail-server configuration
* openapi: API contract
* design: reference prototypes

.github/

* workflows: CI pipeline (GitHub Actions)

---

## CI Pipeline

GitHub Actions runs on:

* push to main and docker-setup
* pull requests into main

Checks:

* frontend build (Next.js)
* backend build (TypeScript + Prisma)

View runs in the Actions tab on GitHub.

---

## Local Setup (Docker Recommended)

### Run Everything

From repo root:

```sh
docker compose up --build
```

Services:

* Frontend: http://localhost:3000
* Backend: http://localhost:5001
* Mail server:
    each of
    - smtp://localhost
    - submissions://localhost
    - submission://localhost
* PostgreSQL: postgresql://localhost

Stop:

```sh
docker compose down
```

---

### Import Mock Data (Docker)

1. Place file:

backend/mock-data/personal/transactions/budgetwise/2025/2026.xlsx

2. Start services:

```sh
docker compose up --build
```

3. Run seed:

```sh
docker compose --profile tools run --rm mock-seed
```

---

## Local Development (No Docker)

### 1. Database

Ensure PostgreSQL is running.

Example:

```sh
DATABASE_URL="postgresql://myapp:secret@localhost/myapp_db"
```

---

### 2. Mail server

Ensure Postfix is properly configured and running.
The details for this depend upon the operating system.

Mail server runs on (depending upon the configuration) each of:

* smtp://localhost
* submissions://localhost
* submission://localhost

---

### 3. Backend

```sh
cd budgetwise/backend
cp .env.example .env
```

Update `.env`:

```sh
DATABASE_URL=...
JWT_SECRET=...
PORT=5001
CORS_ORIGIN=http://localhost:3000

# Or leave unset to use the default of the local machine's hostname.
FRONTEND_SERVER_NAME=...

# Appropriately set or comment out each of these,
# depending upon how you configured the mail server.
# The defaults should probably suffice,
# depending upon your configuration of the mail server,
# of course.
MAIL_SERVER_URL=...
MAIL_SERVER_DOMAIN=...
MAIL_SERVER_MBOX_NO_REPLY_DISPLAY_NAME=...
MAIL_SERVER_MBOX_NO_REPLY_LOCAL_PART=...
```

Run:

```sh
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run dev
```

Optional mock mode:

```sh
npm run dev:mock
```

Backend runs on:

* http://localhost:5001

---

### 4. Frontend

```sh
cd budgetwise/frontend
npm install
npm run dev
```

Frontend runs on:

* http://localhost:3000

---

## Database Commands

```sh
npx prisma migrate dev
npx prisma generate
npx prisma migrate reset
```

---

## Docker Commands

Start:

```sh
docker compose up --build
```

Run in background:

```sh
docker compose up -d
```

Stop:

```sh
docker compose down
```

View logs:

```sh
docker compose logs -f
```

---

## Troubleshooting

Port 5001 already in use:

```sh
lsof -nP -iTCP:5001 -sTCP:LISTEN
kill -9 <PID>
```

Port 3000 already in use:

```sh
npm run dev -- -p 3001
```

Docker rebuild:

```sh
docker compose down -v
docker compose up --build
```

---

## Best Practices

* Do not commit backend/.env
* Do not commit frontend/.env.local
* Do not commit node\_modules
* Do not commit build output (dist, .next)
* Keep API keys server-side only
* Use PostgreSQL for all environments

---

## Deployment Notes (Upcoming)

* App will be deployed using Docker on Render
* CI must pass before merging to main
* Health endpoint should be available at `/health`


Notes


# Notes

• Do not commit backend/.env  
• Do not commit frontend/.env.local  
• Do not commit node modules
• Keep API keys server side only  
• Use PostgreSQL for all environments
* Keep Groq API keys server side only

* Replace PLAID-SANDBOX-KEY values with your real Plaid Sandbox keys from the Plaid Dashboard.
* Test credentials for manual Link flow:
	* Username: user_good
	* Password: pass_good
* After linking, BudgetWise imports the last 30 days of transactions and maps them to app categories.
* Demo direct import mode (skip Plaid Link UI):
	* In backend/.env: PLAID_DEMO_DIRECT_IMPORT_ENABLED="true"
	* In frontend/.env.local: NEXT_PUBLIC_PLAID_DEMO_DIRECT_IMPORT_ENABLED="true"
	* With both enabled, clicking "Link with Plaid" imports Sandbox transactions directly.
---