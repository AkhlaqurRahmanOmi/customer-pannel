// src/import/workers/csv-import.worker.ts
import fs from "fs";
import crypto from "crypto";
import { parse } from "csv-parse";
import { parentPort, workerData } from "worker_threads";
import { PrismaClient } from "@/generated/prisma/client";
import { ImportStatus } from "@/generated/prisma/enums";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

type WorkerResume = {
    startBytes?: string | number; // absolute byte offset from previous run
    overlapBytes?: number; // how many bytes to rewind to safely find row boundary + marker
    lastRowHash?: string; // marker to find exact resume position
    rowsProcessed?: string | number; // previous absolute count
    rowsInserted?: string | number; // previous absolute count
};

type WorkerData = {
    jobId: string;
    filePath: string;

    // optional tuning
    batchSize?: number; // default 1000
    progressUpdateEveryMs?: number; // throttle DB progress update, default 1000ms

    // optional, for UI percent/ETA calc on server
    totalRows?: number; // e.g. 2000000

    // optional resume support
    resume?: WorkerResume;
};

type CustomerRow = {
    customerId: string;
    firstName?: string;
    lastName?: string;
    company?: string;
    city?: string;
    country?: string;
    phone1?: string;
    phone2?: string;
    email?: string;
    subscriptionDate?: Date;
    website?: string;
    aboutCustomer?: string;
};

type BatchItem = {
    row: CustomerRow;
    sourceHash: string;
};

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set for csv-import.worker");
}

const pool = new Pool({ connectionString: databaseUrl });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({
    adapter,
    log: ["warn", "error"],
    errorFormat: process.env.NODE_ENV === "production" ? "minimal" : "pretty",
});

function toBigInt(v: unknown, fallback = 0n): bigint {
    if (v === undefined || v === null) return fallback;
    if (typeof v === "bigint") return v;
    if (typeof v === "number") return BigInt(Math.max(0, Math.floor(v)));
    if (typeof v === "string" && v.trim() !== "") return BigInt(v);
    return fallback;
}

function normalizeEmail(value: any): string {
    if (!value) return "";
    return String(value).trim().toLowerCase();
}

function parseDate(value: any): Date | undefined {
    if (!value) return undefined;
    const date = new Date(String(value));
    return Number.isNaN(date.getTime()) ? undefined : date;
}

function splitFullName(fullName: string): { firstName?: string; lastName?: string } {
    const parts = fullName.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return {};
    if (parts.length === 1) return { firstName: parts[0] };
    return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

function pick(record: Record<string, any>, keys: string[]): string {
    for (const k of keys) {
        if (record[k] !== undefined && record[k] !== null && String(record[k]).trim() !== "") {
            return String(record[k]).trim();
        }
    }
    return "";
}


function mapCsvRecordToCustomer(record: Record<string, any>): CustomerRow | null {
    const customerId = pick(record, ["Customer Id", "customer_id", "customerid", "id"]);

    const firstNameRaw = pick(record, ["firstName", "first_name", "firstname","First Name"]);
    const lastNameRaw = pick(record, ["lastName", "last_name", "lastname", "Last Name"]);
    const fullName = pick(record, ["name", "full_name", "customer_name"]);

    let firstName = firstNameRaw;
    let lastName = lastNameRaw;
    if (!firstName && fullName) {
        const split = splitFullName(fullName);
        firstName = split.firstName ?? firstName;
        lastName = split.lastName ?? lastName;
    }

    const email = normalizeEmail(pick(record, ["mail", "email_address", "Email"]));
    const company = pick(record, ["Company", "company_name", "organization"]);
    const city = pick(record, ["City", "town"]);
    const country = pick(record, ["Country", "country_name"]);
    const phone1 = pick(record, ["Phone 1", "phone_1", "phone", "mobile", "mobile_number"]);
    const phone2 = pick(record, ["Phone 2", "phone_2", "secondary_phone"]);
    const subscriptionDate = parseDate(
        pick(record, ["subscriptionDate", "Subscription Date", "subscribed_at", "created_at"]),
    );
    const website = pick(record, ["website", "url", "site","Website"]);
    const aboutCustomer = pick(record, ["aboutCustomer", "about_customer", "about", "notes", "description", "bio","About Customer"]);

    const effectiveCustomerId = customerId || email;
    if (!effectiveCustomerId) return null;

    return {
        customerId: effectiveCustomerId,
        firstName: firstName || undefined,
        lastName: lastName || undefined,
        company: company || undefined,
        city: city || undefined,
        country: country || undefined,
        phone1: phone1 || undefined,
        phone2: phone2 || undefined,
        email: email || undefined,
        subscriptionDate,
        website: website || undefined,
        aboutCustomer: aboutCustomer || undefined,
    };
}

function computeSourceHash(row: CustomerRow): string {
    const stable = [
        row.customerId ?? "",
        row.firstName ?? "",
        row.lastName ?? "",
        row.company ?? "",
        row.city ?? "",
        row.country ?? "",
        row.phone1 ?? "",
        row.phone2 ?? "",
        row.email ?? "",
        row.subscriptionDate ? row.subscriptionDate.toISOString() : "",
        row.website ?? "",
        row.aboutCustomer ?? "",
    ].join("|");

    return crypto.createHash("sha256").update(stable, "utf8").digest("hex");
}

function post(msg: any) {
    parentPort?.postMessage(msg);
}

async function markJobFailed(jobId: string, error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    try {
        await prisma.importJob.update({
            where: { id: jobId },
            data: {
                status: ImportStatus.FAILED,
                error: message,
                updatedAt: new Date(),
            },
        });
    } catch {
        // ignore secondary failure
    }
    post({ type: "error", jobId, error: message });
}

async function markJobCompleted(jobId: string) {
    await prisma.importJob.update({
        where: { id: jobId },
        data: {
            status: ImportStatus.COMPLETED,
            completedAt: new Date(),
            updatedAt: new Date(),
        },
    });
    post({ type: "done", jobId });
}

async function updateJobProgress(params: {
    jobId: string;
    bytesRead: bigint;
    rowsProcessed: bigint;
    rowsInserted: bigint;
    lastRowHash?: string;
}) {
    await prisma.importJob.update({
        where: { id: params.jobId },
        data: {
            bytesRead: params.bytesRead,
            rowsProcessed: params.rowsProcessed,
            rowsInserted: params.rowsInserted,
            lastRowHash: params.lastRowHash,
            updatedAt: new Date(),
        },
    });
}

async function flushBatch(params: {
    jobId: string;
    items: BatchItem[];
    now: Date;
}): Promise<{ insertedOrUpdated: number; lastRowHash?: string }> {
    const { jobId, items, now } = params;

    if (items.length === 0) return { insertedOrUpdated: 0 };

    // Deduplicate by customerId within the batch (last row wins)
    const byCustomerId = new Map<string, BatchItem>();
    for (const it of items) byCustomerId.set(it.row.customerId, it);

    const batch = Array.from(byCustomerId.values());
    const customerIds = batch.map((b) => b.row.customerId);

    const existing = await prisma.customer.findMany({
        where: { customerId: { in: customerIds } },
        select: {
            customerId: true,
        },
    });

    const existingByCustomerId = new Map(existing.map((c) => [c.customerId, c]));

    const inserts: Array<{
        customerId: string;
        firstName?: string;
        lastName?: string;
        company?: string;
        city?: string;
        country?: string;
        phone1?: string;
        phone2?: string;
        email?: string;
        subscriptionDate?: Date;
        website?: string;
        aboutCustomer?: string;
    }> = [];

    const updates: Array<{
        customerId: string;
        data: {
            firstName?: string;
            lastName?: string;
            company?: string;
            city?: string;
            country?: string;
            phone1?: string;
            phone2?: string;
            email?: string;
            subscriptionDate?: Date;
            website?: string;
            aboutCustomer?: string;
        };
    }> = [];

    for (const it of batch) {
        const prev = existingByCustomerId.get(it.row.customerId);

        if (!prev) {
            inserts.push({
                ...it.row,
            });
            continue;
        }

        updates.push({
            customerId: prev.customerId,
            data: {
                ...it.row,
            },
        });
    }

    // Bulk insert
    if (inserts.length) {
        await prisma.customer.createMany({
            data: inserts,
            // helps with resume overlap / duplicate input rows
            skipDuplicates: true,
        });
    }

    // Per-row updates inside a transaction (batch size keeps this reasonable)
    if (updates.length) {
        await prisma.$transaction(
            updates.map((u) =>
                prisma.customer.update({
                    where: { customerId: u.customerId },
                    data: u.data,
                }),
            ),
        );
    }

    return {
        insertedOrUpdated: inserts.length + updates.length,
        lastRowHash: batch[batch.length - 1]?.sourceHash,
    };
}

async function run() {
    const data = workerData as WorkerData;

    const jobId = data.jobId;
    const filePath = data.filePath;

    const batchSize = Math.max(100, data.batchSize ?? 1000);
    const progressUpdateEveryMs = Math.max(200, data.progressUpdateEveryMs ?? 1000);

    const resume = data.resume ?? {};
    const resumeStartBytes = toBigInt(resume.startBytes, 0n);
    const overlapBytes = toBigInt(resume.overlapBytes ?? 1024 * 1024, 1024n * 1024n); // default 1MB
    const lastRowHashMarker = resume.lastRowHash ?? "";

    const initialRowsProcessed = toBigInt(resume.rowsProcessed, 0n);
    const initialRowsInserted = toBigInt(resume.rowsInserted, 0n);

    // If resuming, start a bit earlier (overlap) then scan until marker is found.
    const streamStart = resumeStartBytes > overlapBytes ? resumeStartBytes - overlapBytes : 0n;

    let seenResumeMarker = lastRowHashMarker ? false : true;

    // Track bytes read from THIS stream, then add streamStart to store absolute bytes.
    let bytesReadInThisRun = 0n;
    let absoluteBytesRead = streamStart;

    let rowsProcessed = initialRowsProcessed;
    let rowsInserted = initialRowsInserted;

    let lastProgressWriteAt = 0;
    const startTime = Date.now();

    const fileStream = fs.createReadStream(filePath, {
        start: Number(streamStart), // safe if < 2^53; for giant files use bigint-aware stream library
        highWaterMark: 1024 * 1024, // 1MB chunks
    });

    fileStream.on("data", (chunk: Buffer) => {
        bytesReadInThisRun += BigInt(chunk.length);
        absoluteBytesRead = streamStart + bytesReadInThisRun;
    });

    fileStream.on("error", (err) => {
        throw err;
    });

    const parser = parse({
        columns: true, // use first line as header
        skip_empty_lines: true,
        relax_quotes: true,
        relax_column_count: true,
        trim: true,
    });

    const batch: BatchItem[] = [];

    // Pipe stream -> parser
    fileStream.pipe(parser);

    async function maybePersistProgress(force = false, lastRowHash?: string) {
        const now = Date.now();
        if (!force && now - lastProgressWriteAt < progressUpdateEveryMs) return;
        lastProgressWriteAt = now;

        await updateJobProgress({
            jobId,
            bytesRead: absoluteBytesRead,
            rowsProcessed,
            rowsInserted,
            lastRowHash,
        });

        const elapsedSec = Math.max(1, Math.floor((now - startTime) / 1000));
        const rate = Number(rowsProcessed - initialRowsProcessed) / elapsedSec;

        post({
            type: "progress",
            jobId,
            rowsProcessed: rowsProcessed.toString(),
            rowsInserted: rowsInserted.toString(),
            bytesRead: absoluteBytesRead.toString(),
            rate,
            elapsedSec,
            lastRowHash,
        });
    }

    let lastRowHash: string | undefined;

    try {
        for await (const record of parser as AsyncIterable<Record<string, any>>) {
            const row = mapCsvRecordToCustomer(record);

            // We still might need to advance to find marker during resume overlap,
            // but if row is invalid (no customerId/email), it cannot be hashed reliably - just skip.
            if (!row) continue;

            const sourceHash = computeSourceHash(row);

            // Resume mode: scan until we see marker, then start counting/writing after it.
            if (!seenResumeMarker) {
                if (sourceHash === lastRowHashMarker) {
                    seenResumeMarker = true;
                }
                continue;
            }

            // normal processing
            rowsProcessed += 1n;
            batch.push({ row, sourceHash });

            if (batch.length >= batchSize) {
                const now = new Date();
                const result = await flushBatch({ jobId, items: batch, now });
                rowsInserted += BigInt(result.insertedOrUpdated);
                lastRowHash = result.lastRowHash ?? lastRowHash;

                batch.length = 0;

                await maybePersistProgress(false, lastRowHash);
            }
        }

        // flush remaining
        if (batch.length) {
            const now = new Date();
            const result = await flushBatch({ jobId, items: batch, now });
            rowsInserted += BigInt(result.insertedOrUpdated);
            lastRowHash = result.lastRowHash ?? lastRowHash;
            batch.length = 0;
        }

        // final progress write
        await maybePersistProgress(true, lastRowHash);

        await markJobCompleted(jobId);
    } catch (err) {
        await markJobFailed(jobId, err);
    } finally {
        // ensure parser and stream are closed
        try {
            fileStream.destroy();
        } catch {}
        try {
            await prisma.$disconnect();
            await pool.end();
        } catch {}
    }
}

// Boot
run().catch(async (err) => {
    const data = workerData as WorkerData;
    await markJobFailed(data.jobId, err);
    try {
        await prisma.$disconnect();
        await pool.end();
    } catch {}
});
