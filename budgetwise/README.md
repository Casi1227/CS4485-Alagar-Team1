# BudgetWise

BudgetWise is a full stack app with a Next.js frontend and an Express backend. It uses PostgreSQL via Prisma, plus Zod validation, bcrypt password hashing, and JWT auth.

## Tech Stack
1. Frontend: Next.js 15, React 19, TypeScript, Tailwind v3, shadcn style components
2. Backend: Express, Prisma, PostgreSQL, Zod, bcrypt, JWT
3. Dev ports
   1. Frontend: http://localhost:3000
   2. Backend: http://localhost:5001

## Prerequisites
1. Node.js (Node 20 recommended)
2. Git
3. PostgreSQL (choose one)
   1. Docker Desktop (easiest if available)
   2. Local PostgreSQL install (Mac via Homebrew)
   3. Hosted PostgreSQL (Supabase, Railway, Neon, etc.)

## One Time Setup (Everyone)
1. Clone the repo
   1. `git clone <repo_url>`
   2. `cd budgetwise`

2. Install dependencies
   1. `npm install`
   2. `npm run install:all`

3. Create the backend env file
   1. `cp backend/.env.example backend/.env`

4. Set required values in `backend/.env`
   1. `PORT=5001`
   2. `JWT_SECRET=<any long random string>`
   3. `CORS_ORIGIN=http://localhost:3000`
   4. `DATABASE_URL=...` (see database options below)

## Database Option A (Recommended): Local Postgres via Docker
Use this if you have Docker Desktop installed.

1. Start Postgres
   1. From project root: `docker compose up -d`

2. Set `DATABASE_URL` in `backend/.env`
   1. Use the value provided in `backend/.env.example` for the Docker setup

3. Run Prisma migration and generate client
   1. `cd backend`
   2. `npx prisma migrate dev --name init`
   3. `npx prisma generate`
   4. `cd ..`

## Database Option B (No Docker): Local Postgres on Mac via Homebrew
Use this if you do not have Docker.

1. Install Postgres
   1. `brew install postgresql@16`

2. Start Postgres
   1. `brew services start postgresql@16`

3. Add Postgres tools to PATH (Apple Silicon Mac)
   1. `echo 'export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"' >> ~/.zshrc`
   2. `source ~/.zshrc`

4. Create the database
   1. `createdb budgetwise`

5. Set `DATABASE_URL` in `backend/.env`
   1. Use your Mac username in the URL
   2. Example:
      `DATABASE_URL=postgresql://YOUR_MAC_USERNAME@localhost:5432/budgetwise?schema=public`

6. Run Prisma migration and generate client
   1. `cd backend`
   2. `npx prisma migrate dev --name init`
   3. `npx prisma generate`
   4. `cd ..`

## Database Option C (No Local Installs): Hosted Postgres
Use this if you want zero local DB setup.

1. Create a Postgres database on a host (Supabase, Neon, Railway, etc.)
2. Copy the connection string
3. Set `DATABASE_URL` in `backend/.env` to that connection string
4. Run Prisma migration and generate client
   1. `cd backend`
   2. `npx prisma migrate dev --name init`
   3. `npx prisma generate`
   4. `cd ..`

## Running The App
From the project root:

1. Start the app
   1. `npm run dev`

2. Open in browser
   1. Frontend: http://localhost:3000
   2. Backend health: http://localhost:5001/api/health

## Demo Test Checklist
1. Backend health endpoint returns OK
   1. Visit http://localhost:5001/api/health

2. Frontend loads
   1. Visit http://localhost:3000

3. Auth flow works
   1. Register a new account
   2. Log in
   3. Confirm protected pages redirect to login when logged out

## Troubleshooting

### Error: next: command not found
This means frontend dependencies did not install.

1. Reinstall frontend dependencies
   1. `cd frontend`
   2. `rm -rf node_modules package-lock.json`
   3. `npm install`
   4. `cd ..`

### Error: Prisma P1010 user was denied access
This usually means your `DATABASE_URL` user is wrong or you edited the wrong env file.

1. Check what Prisma is reading
   1. `cd backend`
   2. `node -e "require('dotenv').config(); console.log(process.env.DATABASE_URL)"`

2. Update `backend/.env` so the username matches your local Postgres user
   1. Common Mac local user is your Mac username
   2. Example:
      `DATABASE_URL=postgresql://YOUR_MAC_USERNAME@localhost:5432/budgetwise?schema=public`

3. Re run migration
   1. `npx prisma migrate dev --name init`

### Error: createdb command not found (Mac)
This means Postgres tools are not on PATH.

1. Add to PATH (Apple Silicon)
   1. `echo 'export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"' >> ~/.zshrc`
   2. `source ~/.zshrc`

2. Confirm tools work
   1. `psql --version`
   2. `createdb --version`

### Port already in use
Backend runs on port 5001.

1. Find what is using the port
   1. `lsof -nP -iTCP:5001 -sTCP:LISTEN`

2. Kill the PID
   1. `kill -9 <PID>`

## Notes
1. Auth uses JWT tokens. The frontend redirects to login when not authenticated.
2. Prisma schema lives at `backend/prisma/schema.prisma`.
3. If migrations are already applied, Prisma may say the database is in sync. That is expected.