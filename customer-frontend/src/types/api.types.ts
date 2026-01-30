// API Response wrapper
export interface ApiResponse<T> {
    success: boolean;
    statusCode: number;
    message: string;
    data: T;
    meta: {
        timestamp: string;
        traceId: string;
        version: string;
    };
}

// Customer
export interface Customer {
    id: number;
    customerId: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    company: string | null;
    city: string | null;
    country: string | null;
    phone1: string | null;
    phone2: string | null;
    subscriptionDate: string | null;
    website: string | null;
    aboutCustomer: string | null;
    createdAt: string;
    updatedAt: string;
}

// Pagination
export interface Pagination {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
    hasNext: boolean;
    hasPrev: boolean;
}

export interface PaginatedData<T> {
    data: T[];
    pagination: Pagination;
}

// Import Job
export type ImportStatus = 'IDLE' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'idle';

export interface ImportJob {
    id: string;
    filePath: string;
    status: ImportStatus;
    bytesRead: string;
    rowsProcessed: string;
    rowsInserted: string;
    lastRowHash: string | null;
    startedAt: string | null;
    completedAt: string | null;
    error: string | null;
    updatedAt: string;
}

// Import Progress
export interface ImportProgress {
    jobId: string | null;
    status: ImportStatus;
    filePath?: string | null;
    rowsProcessed: string;
    rowsInserted: string;
    bytesRead: string;
    percent: number;
    rateRowsPerSec: number;
    elapsedSec: number;
    etaSec: number | null;
    startedAt?: string | null;
    updatedAt?: string | null;
    completedAt?: string | null;
    lastRowHash?: string;
    error?: string | null;
    disableSync: boolean;
    recentCustomers: Customer[];
}

// SSE Message types
export interface SSEMessage {
    type: 'snapshot' | 'progress' | 'done' | 'complete' | 'error' | 'heartbeat';
    jobId?: string;
    status?: ImportStatus;
    rowsProcessed?: string;
    rowsInserted?: string;
    bytesRead?: string;
    percent?: number;
    rate?: number; // Worker sends 'rate'
    rateRowsPerSec?: number; // Snapshot sends 'rateRowsPerSec'
    elapsedSec?: number;
    etaSec?: number | null;
    error?: string;
    ts?: string;
    recentCustomers?: Customer[];
    disableSync?: boolean;
    lastRowHash?: string;
}

// Request DTOs
export interface StartImportDto {
    filePath?: string;
    batchSize?: number;
    progressUpdateEveryMs?: number;
    totalRows?: number;
}

export interface QueryCustomerDto {
    page?: number;
    limit?: number;
}