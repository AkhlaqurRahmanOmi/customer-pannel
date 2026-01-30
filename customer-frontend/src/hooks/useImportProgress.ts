
import { useState, useEffect, useCallback, useRef } from 'react';
import type { ImportProgress, StartImportDto, SSEMessage } from '../types/api.types';
import { importApi } from '../service/api';

interface UseImportProgressOptions {
    totalRows?: number;
    recentLimit?: number;
    autoConnect?: boolean;
}

interface UseImportProgressReturn {
    progress: ImportProgress | null;
    isLoading: boolean;
    error: string | null;
    isConnected: boolean;
    startSync: (dto?: StartImportDto) => Promise<void>;
    refresh: () => Promise<void>;
}

const defaultProgress: ImportProgress = {
    jobId: null,
    status: 'idle',
    rowsProcessed: '0',
    rowsInserted: '0',
    bytesRead: '0',
    percent: 0,
    rateRowsPerSec: 0,
    elapsedSec: 0,
    etaSec: null,
    disableSync: false,
    recentCustomers: [],
};

export function useImportProgress(options: UseImportProgressOptions = {}): UseImportProgressReturn {
    const { totalRows = 2000000, recentLimit = 20, autoConnect = true } = options;

    const [progress, setProgress] = useState<ImportProgress | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isConnected, setIsConnected] = useState(false);

    const eventSourceRef = useRef<EventSource | null>(null);

    // Helper to calculate percent from rows processed
    const calculatePercent = (rowsProcessed: string | number): number => {
        const processed = Number(rowsProcessed);
        return totalRows > 0 ? Math.min((processed / totalRows) * 100, 100) : 0;
    };

    // Helper to calculate ETA
    const calculateEta = (rowsProcessed: string | number, rate: number): number | null => {
        if (rate <= 0) return null;
        const processed = Number(rowsProcessed);
        const remaining = Math.max(0, totalRows - processed);
        return Math.ceil(remaining / rate);
    };

    // Fetch initial progress
    const refresh = useCallback(async () => {
        try {
            setIsLoading(true);
            setError(null);
            const response = await importApi.getProgress(totalRows, recentLimit);
            setProgress(response.data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch progress');
            setProgress(defaultProgress);
        } finally {
            setIsLoading(false);
        }
    }, [totalRows, recentLimit]);

    // Handle SSE messages - merge worker updates with existing progress
    const handleSSEMessage = useCallback((data: SSEMessage) => {
        setProgress((prev) => {
            const current = prev || defaultProgress;

            // Handle different message types
            if (data.type === 'snapshot') {
                // Full snapshot from server - use as-is
                return {
                    jobId: data.jobId ?? null,
                    status: data.status ?? 'idle',
                    rowsProcessed: data.rowsProcessed ?? '0',
                    rowsInserted: data.rowsInserted ?? '0',
                    bytesRead: data.bytesRead ?? '0',
                    percent: data.percent ?? 0,
                    rateRowsPerSec: data.rateRowsPerSec ?? 0,
                    elapsedSec: data.elapsedSec ?? 0,
                    etaSec: data.etaSec ?? null,
                    disableSync: data.disableSync ?? false,
                    recentCustomers: data.recentCustomers ?? [],
                    error: data.error,
                };
            }

            if (data.type === 'progress') {
                // Worker progress update - calculate missing fields
                const rowsProcessed = data.rowsProcessed ?? current.rowsProcessed;
                const rate = data.rate ?? data.rateRowsPerSec ?? current.rateRowsPerSec;

                return {
                    ...current,
                    jobId: data.jobId ?? current.jobId,
                    status: 'RUNNING', // If we get progress, it's running
                    rowsProcessed,
                    rowsInserted: data.rowsInserted ?? current.rowsInserted,
                    bytesRead: data.bytesRead ?? current.bytesRead,
                    percent: calculatePercent(rowsProcessed),
                    rateRowsPerSec: rate,
                    elapsedSec: data.elapsedSec ?? current.elapsedSec,
                    etaSec: calculateEta(rowsProcessed, rate),
                    disableSync: true,
                };
            }

            if (data.type === 'done' || data.type === 'complete') {
                // Import completed
                return {
                    ...current,
                    status: 'COMPLETED',
                    percent: 100,
                    etaSec: 0,
                    disableSync: false,
                };
            }

            if (data.type === 'error') {
                return {
                    ...current,
                    status: 'FAILED',
                    error: data.error,
                    disableSync: false,
                };
            }

            if (data.type === 'heartbeat') {
                // Heartbeat - no state change needed
                return current;
            }

            return current;
        });
        setError(null);
    }, [totalRows]);

    // Connect to SSE stream
    const connectSSE = useCallback(() => {
        if (eventSourceRef.current) {
            eventSourceRef.current.close();
        }

        const eventSource = importApi.createProgressStream(
            handleSSEMessage,
            () => {
                setIsConnected(false);
                // Reconnect after 3 seconds
                setTimeout(() => {
                    if (autoConnect) connectSSE();
                }, 3000);
            },
            totalRows,
            recentLimit
        );

        eventSource.onopen = () => {
            setIsConnected(true);
        };

        eventSourceRef.current = eventSource;
    }, [totalRows, recentLimit, autoConnect, handleSSEMessage]);

    // Start sync
    const startSync = useCallback(async (dto?: StartImportDto) => {
        try {
            setIsLoading(true);
            setError(null);
            await importApi.startSync(dto);
            // Progress will be updated via SSE
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to start sync';
            // If import is already running, just refresh to show current progress
            if (message.toLowerCase().includes('already running')) {
                await refresh();
                return; // Don't throw, just show the running import
            }
            setError(message);
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, [refresh]);

    // Setup SSE connection on mount
    useEffect(() => {
        refresh();
        if (autoConnect) {
            connectSSE();
        }

        return () => {
            eventSourceRef.current?.close();
        };
    }, [refresh, connectSSE, autoConnect]);

    return {
        progress,
        isLoading,
        error,
        isConnected,
        startSync,
        refresh,
    };
}