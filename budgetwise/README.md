# BudgetWise Unified

Full stack BudgetWise app with Next.js frontend and Express + Prisma backend.

## Tech Stack

Frontend: Next.js, TypeScript  
Backend: Express, TypeScript, Prisma  
Database: PostgreSQL  
Auth: JWT  
Containerization: Docker, Docker Compose  

---

## Project Structure

budgetwise/
- backend: API server  
- frontend: Next.js UI  
- openapi: API contract  
- design: reference prototypes  

.github/
- workflows: CI pipeline (GitHub Actions)

---

## CI Pipeline

GitHub Actions runs on:
- push to main and docker-setup
- pull requests into main

Checks:
- frontend build (Next.js)
- backend build (TypeScript + Prisma)

View runs in the Actions tab on GitHub.

---

## Local Setup (Docker Recommended)

### Run Everything

From repo root:

```bash
docker compose up --build
```

Services:
- Frontend: http://localhost:3000  
- Backend: http://localhost:5001  
- PostgreSQL: localhost:5433  

Stop:

```bash
docker compose down
```

---

### Import Mock Data (Docker)

1. Place file:

```
backend/mock-data/personal_transactions_budgetwise_2025_2026.xlsx
```

2. Start services:

```bash
docker compose up --build
```

3. Run seed:

```bash
docker compose --profile tools run --rm mock-seed
```

---

## Local Development (No Docker)

### 1. Database

Ensure PostgreSQL is running.

Example:

```bash
DATABASE_URL="postgresql://myapp:secret@localhost:5433/myapp_db"
```

---

### 2. Backend

```bash
cd budgetwise/backend
cp .env.example .env
```

Update `.env`:

```bash
DATABASE_URL=...
JWT_SECRET=...
PORT=5001
CORS_ORIGIN=http://localhost:3000
```

Run:

```bash
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run dev
```

Optional mock mode:

```bash
npm run dev:mock
```

Backend runs on:
http://localhost:5001

---

### 3. Frontend

```bash
cd budgetwise/frontend
npm install
npm run dev
```

Frontend runs on:
http://localhost:3000

---

## Database Commands

```bash
npx prisma migrate dev
npx prisma generate
npx prisma migrate reset
```

---

## Docker Commands

Start:

```bash
docker compose up --build
```

Run in background:

```bash
docker compose up -d
```

Stop:

```bash
docker compose down
```

View logs:

```bash
docker compose logs -f
```

---

## Troubleshooting

Port 5001 already in use:

```bash
lsof -nP -iTCP:5001 -sTCP:LISTEN
kill -9 <PID>
```

Port 3000 already in use:

```bash
npm run dev -- -p 3001
```

Docker rebuild:

```bash
docker compose down -v
docker compose up --build
```

---

## Best Practices

- Do not commit backend/.env  
- Do not commit frontend/.env.local  
- Do not commit node_modules  
- Do not commit build output (dist, .next)  
- Keep API keys server-side only  
- Use PostgreSQL for all environments  

---

## Deployment Notes (Upcoming)

- App will be deployed using Docker on Render  
- CI must pass before merging to main  
- Health endpoint should be available at `/health`  