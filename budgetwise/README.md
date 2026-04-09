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

Install and run:

npm install
npx prisma generate
npx prisma migrate dev --name init
npm run dev

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

# Notes

• Do not commit backend/.env  
• Do not commit frontend/.env.local  
• Do not commit node_modules  
• Keep API keys server side only  
• Use PostgreSQL for all environments