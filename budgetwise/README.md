# BudgetWise Unified

Full stack BudgetWise app with Next.js frontend and Express Prisma backend.

Tech Stack
* Frontend: Next.js (App Router), TypeScript
* Backend: Express, TypeScript, Prisma
* Database: SQLite for local development
* Auth: JWT

Project Structure
* backend: API server
* frontend: Next.js UI
* openapi: API contract for current and future endpoints
* design: reference prototypes if included

Local Setup

1. Backend
From the repo root:

cd backend
cp .env.example .env

Edit backend/.env and set:
DATABASE_URL="file:./dev.db"
JWT_SECRET="budgetwise_dev_secret_9f3a2c1d7e6b5a4c8d1f0e9b2a7c6d5e"

Install and start:

npm install
npx prisma generate
npx prisma migrate dev --name init
npm run dev

Backend runs on:
http://localhost:5001

2. Frontend
Open a second terminal from the repo root:

cd frontend
cp .env.local.example .env.local 2>/dev/null || true
npm install
npm run dev

Frontend runs on:
http://localhost:3000

Calendar page:
http://localhost:3000/calendar

Troubleshooting

Port 5001 already in use
lsof -nP -iTCP:5001 -sTCP:LISTEN
kill -9 <PID>

Port 3000 already in use
npm run dev -- -p 3001

Reset SQLite database
Stop the backend then from backend:

rm -f dev.db
npx prisma migrate dev --name init

Notes
* Do not commit backend/.env, frontend/.env.local, backend/dev.db, or node_modules
* Keep Groq API keys server side only