# BudgetWise Unified

Full stack BudgetWise app with Next.js frontend and Express Prisma backend.

## Tech Stack

• Frontend: Next.js, TypeScript  
• Backend: Express, TypeScript, Prisma  
• Database: PostgreSQL  
• Auth: JWT  
• Containerization: Docker, Docker Compose  

## Project Structure

• backend: API server  
• frontend: Next.js UI  
• openapi: API contract for current and future endpoints  
• design: reference prototypes if included  

---

# Local Setup (Docker Recommended)

## Run Everything with Docker

From repo root:

docker compose up --build

Services:

• Frontend: http://localhost:3000  
• Backend: http://localhost:5001  
• PostgreSQL: localhost:5433  

Stop services:

docker compose down

### Import Mock Data with Docker

1) Copy your spreadsheet into:

backend/mock-data/personal/transactions/budgetwise/2025/2026.xlsx

2) Start DB + app:

docker compose up --build

3) In a second terminal (repo root), run the one-off seed:

docker compose --profile tools run --rm mock-seed

This imports data for the mock user into the Docker Postgres database.
It is optional and does not change normal teammate startup.

---

# Local Development (Without Docker)

## 1. Database (PostgreSQL Required)

You must have PostgreSQL running locally.

Example connection string:

DATABASE/URL="postgresql://myapp:secret@localhost:5433/myapp/db"

---

## 2. Backend

From repo root:

cd backend
cp .env.example .env

Edit backend/.env:

DATABASE\_URL="postgresql://myapp:secret@localhost:5433/myapp\_db"
JWT\_SECRET="budgetwise\_dev\_secret\_9f3a2c1d7e6b5a4c8d1f0e9b2a7c6d5e"
PORT=5001
CORS\_ORIGIN="http://localhost:3000"

Also set the MAIL\_SERVER_* variables in this file.
A description and an example configuration of these variables
are provided in .env.example.
The document mail-config-howto.md also provides a walkthrough
upon setting up a working configuration with these variables.

Install and run:

npm install
npx prisma generate
npx prisma migrate dev --name init
npm run dev

For mock data: npm run dev:mock
(username and password for mock user is shown in terminal after using this command)

Backend runs on:

http://localhost:5001

---

## 3. Frontend

Open a second terminal:

cd frontend
npm install
npm run dev

Frontend runs on:

http://localhost:3000

---

# Database Commands

Run migrations:

npx prisma migrate dev

Generate client:

npx prisma generate

Reset database:

npx prisma migrate reset

---

# Docker Commands

Start services:

docker compose up --build

Import mock data (docker version):

In second terminal: docker compose --profile tools run --rm mock-seed
Username + password for the mock data account will be given in terminal

Run in background:

docker compose up -d

Stop services:

docker compose down

View logs:

docker compose logs -f

---

# Troubleshooting

Port 5001 already in use

lsof -nP -iTCP:5001 -sTCP:LISTEN
kill -9 <PID>

Port 3000 already in use

npm run dev -- -p 3001

Docker rebuild

docker compose down -v
docker compose up --build

Notes
* Do not commit backend/.env, frontend/.env.local, backend/dev.db, or node_modules
* Keep Groq API keys server side only

Plaid Sandbox (Credit Card Linking)
* BudgetWise now supports Sandbox-only Plaid linking through Add Account -> Credit Card.
* In backend/.env set:

PLAID_CLIENT_ID="PLAID-SANDBOX-KEY"
PLAID_SECRET="PLAID-SANDBOX-KEY"
PLAID_ENV="sandbox"
PLAID_PRODUCTS="transactions"
PLAID_COUNTRY_CODES="US"
PLAID_LANGUAGE="en"

* Replace PLAID-SANDBOX-KEY values with your real Plaid Sandbox keys from the Plaid Dashboard.
* Test credentials for manual Link flow:
	* Username: user_good
	* Password: pass_good
* After linking, BudgetWise imports the last 30 days of transactions and maps them to app categories.
---

# Notes

• Do not commit backend/.env  
• Do not commit frontend/.env.local  
• Do not commit node modules
• Keep API keys server side only  
• Use PostgreSQL for all environments
