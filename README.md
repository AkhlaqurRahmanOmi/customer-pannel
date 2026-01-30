# Customer Panel (Full Stack)

This repo contains a NestJS backend that performs a 2GB+ CSV import without blocking the Node.js event loop, plus a React frontend (currently a static UI shell).

## Structure

- `customer-pannel/` - NestJS API + Prisma + PostgreSQL
- `customer-frontend/` - React + Vite UI

## Stack

- Backend: NestJS, TypeScript, Prisma, PostgreSQL
- Frontend: React, TypeScript, Vite
- Import: Worker Threads + streaming CSV parse
- Progress: SSE + persisted ImportJob state

## Setup (backend)

```bash
cd customer-pannel
npm install
```

Create `.env` from `.env.example` and adjust:

- `DATABASE_URL`
- `CSV_PATH` (local path to the large CSV)
- `IMPORT_TOTAL_ROWS=2000000`

Run DB and migrate:

```bash
docker compose up -d
npx prisma migrate deploy
```

Start the API:

```bash
npm run start:dev
```

API base URL: `http://localhost:3000/api/v1`
Swagger: `http://localhost:3000/api/docs`

## Setup (frontend)

```bash
cd customer-frontend
npm install
npm run dev
```

The frontend is wired to the API and shows realtime import progress + customer data.

## Backend API overview

Customers:

- `GET /api/v1/customers?page=1&limit=50`
- `POST /api/v1/customers`
- `GET /api/v1/customers/:id`
- `PATCH /api/v1/customers/:id`
- `DELETE /api/v1/customers/:id`

Import:

- `POST /api/v1/customers/sync`
- `GET /api/v1/customers/progress`
- `GET /api/v1/customers/progress/stream` (SSE)

## Import behavior (backend)

- Reads CSV from local disk via `fs.createReadStream`
- Uses a worker thread so the main Node.js event loop stays responsive
- Streams CSV rows (`csv-parse`) and writes in batches
- Persists progress in the database (bytes read, rows processed/inserted)
- Auto-resumes if the process restarts while a job is running
- Provides realtime progress via SSE and a snapshot endpoint for refresh

## What is done

- Backend CSV import with progress persistence and resume
- Realtime progress stream (SSE) + polling snapshot
- Customer CRUD with pagination
- Recent imported rows returned in progress snapshot
- Frontend wired to API for import status + customer data

## What is not done

- Bonus: "Skip updates for manually modified customers" on re-import

## Notes / Tradeoffs

- Postgres is used instead of MongoDB; Prisma is the DB layer.
- The resume strategy rewinds a small byte overlap and searches for the last row hash to avoid duplicates.
- Batch sizes and progress persistence intervals are configurable via env vars.
