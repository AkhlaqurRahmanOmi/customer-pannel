# Customer Panel API (NestJS + Prisma + PostgreSQL)

This is the backend service for the customer import + CRUD system. It is designed to ingest a 2GB+ CSV using a streaming worker thread (no event-loop blocking), persist progress for resume, and expose a realtime progress stream via SSE.

## Stack

- NestJS + TypeScript
- Prisma + PostgreSQL
- CSV streaming with `csv-parse`
- Worker Threads for non-blocking import
- Server-Sent Events (SSE) for realtime progress

## Features implemented

- CSV import from local disk (no upload)
- Event-loop safe import using a dedicated worker thread
- Progress persisted in DB (`ImportJob`) for refresh/resume
- Auto-resume on server restart when a job is running
- Batched inserts + updates
- Recent imported rows surfaced to the UI (`recentCustomers`)
- Customer CRUD with pagination

## Not implemented (known gaps)

- Bonus: "Do not overwrite manually modified customers" on re-sync

## Local setup

1) Install dependencies

```bash
cd customer-pannel
npm install
```

2) Configure environment

Copy `.env.example` to `.env` and adjust values as needed.

Key values:

- `DATABASE_URL` (PostgreSQL)
- `CSV_PATH` (absolute or relative path to the 2GB CSV)
- `IMPORT_TOTAL_ROWS` (defaults to 2,000,000)

3) Run database (Docker)

```bash
docker compose up -d
```

4) Run migrations

```bash
npx prisma migrate deploy
```

5) Start the API

```bash
npm run start:dev
```

API base URL: `http://localhost:3000/api/v1`
Swagger: `http://localhost:3000/api/docs`

## API surface

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

### Start import

```json
POST /api/v1/customers/sync
{
  "filePath": "customers-2000000.csv",
  "batchSize": 1000,
  "progressUpdateEveryMs": 1000,
  "totalRows": 2000000
}
```

- `filePath` is optional if `CSV_PATH` is set in `.env`.
- If a job is already running, the API returns 409.

### Progress snapshot (polling)

```json
GET /api/v1/customers/progress
{
  "jobId": "...",
  "status": "RUNNING",
  "rowsProcessed": "12345",
  "rowsInserted": "12000",
  "bytesRead": "987654321",
  "percent": 0.62,
  "rateRowsPerSec": 450.2,
  "elapsedSec": 120,
  "etaSec": 430,
  "recentCustomers": [ ... ]
}
```

### Progress stream (SSE)

```
GET /api/v1/customers/progress/stream
Content-Type: text/event-stream
```

The stream emits:

- `snapshot` on connect (restores UI after refresh)
- `progress` while running
- `done` on completion
- `error` on failure

## CSV mapping

The import worker accepts flexible headers. It looks for a usable `customerId` or `email` and maps optional fields if present (name, company, city, country, phones, website, about, subscription date). Rows without a usable identifier are skipped.

## Resume strategy

Progress is persisted in `ImportJob`:

- `bytesRead`, `rowsProcessed`, `rowsInserted`
- `lastRowHash` as a resume marker

When resuming, the worker rewinds by a small overlap (default 1MB) and scans until it finds `lastRowHash`, then continues from the next row. This is resilient to restarts and avoids duplicate writes.

## Why these libraries

- `csv-parse` for streaming CSV parsing
- Prisma for DB access (batching + type safety)
- Worker Threads to keep Node's main thread responsive
