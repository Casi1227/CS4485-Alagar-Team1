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

**AI insights (Groq):** the backend does not ship with an API key. Create a file `budgetwise/.env` in the same folder as `docker-compose.yml` containing `GROQ_API_KEY=...` (get a key from the Groq console), or set that variable in your environment before `docker compose up`. Without it, AI insights return “not available” (HTTP 503).

Stop services:

docker compose down

### Optional: Scaled Backend Mode (Load Testing)

This mode keeps normal developer flow unchanged and adds an opt-in
backend load balancer + multiple backend replicas.

Start with 3 backend replicas:

```sh
docker compose -f docker-compose.yml -f docker-compose.scale.yml up -d --build --scale backend=3
```

In this mode:

* Frontend remains at: http://localhost:10000
* Backend remains at: http://localhost:5001 (served by `backend-lb`)
* `backend` containers are internal and can scale safely.

Stop:

```sh
docker compose -f docker-compose.yml -f docker-compose.scale.yml down
```

Notes:

* Default `docker compose up` is still available

---

### Import Mock Data with Docker

1) Copy your spreadsheet into:

backend/mock-data/personal_transactions_budgetwise_2025_2026.xlsx

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

DATABASE_URL="postgresql://myapp:secret@localhost:5433/myapp_db"

---

## 2. Backend

From repo root:

cd backend
cp .env.example .env

Edit backend/.env:

DATABASE_URL="postgresql://myapp:secret@localhost:5433/myapp_db"
JWT_SECRET="budgetwise_dev_secret_9f3a2c1d7e6b5a4c8d1f0e9b2a7c6d5e"
PORT=5001
CORS_ORIGIN="http://localhost:3000"

Also set the MAIL_SERVER_* variables in this file.
A description and an example configuration of these variables
are provided in .env.example.

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
* Health endpoint should be available at `/api/health`

### Render Scaling Notes

For horizontal scaling on Render:

* Increase backend instance count (replicas) on the backend web service.
* Keep frontend calling the same backend URL; Render handles balancing.
* Prefer shared/distributed rate limits for multi-instance consistency.
* Re-check DB connection pool limits when increasing replicas.

---

# Notes

• Do not commit backend/.env  
• Do not commit frontend/.env.local  
• Do not commit node modules  
• Keep API keys server side only  
• Use PostgreSQL for all environments  
• Keep Groq API keys server side only  

• Replace PLAID-SANDBOX-KEY values with your real Plaid Sandbox keys from the Plaid Dashboard.  
• Test credentials for manual Link flow:  
	* Username: user_good  
	* Password: pass_good  
• After linking, BudgetWise imports the last 30 days of transactions and maps them to app categories.  
• Demo direct import mode (skip Plaid Link UI):  
	* In backend/.env: PLAID_DEMO_DIRECT_IMPORT_ENABLED="true"  
	* In frontend/.env.local: NEXT_PUBLIC_PLAID_DEMO_DIRECT_IMPORT_ENABLED="true"  
	* With both enabled, clicking "Link with Plaid" imports Sandbox transactions directly.
