import './App.css'
import { useImportProgress } from './hooks/useImportProgress'
import { CustomerTable } from './components/CustomerTable'

function formatTime(seconds: number | null): string {
    if (seconds === null || seconds <= 0) return '--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}m ${secs}s`;
}

function formatNumber(value: string | number): string {
    return Number(value).toLocaleString();
}

function App() {
    const { progress, isLoading, error, startSync } = useImportProgress({
        totalRows: 2000000,
        recentLimit: 12,
    });

    const percent = progress?.percent ?? 0;
    const status = progress?.status ?? 'idle';
    const isRunning = status === 'RUNNING';
    // Disable button while loading initial data, during sync, or if already running
    const isDisabled = isLoading || !progress || progress.disableSync;

    const handleStartSync = async () => {
        try {
            await startSync();
        } catch (err) {
            console.error('Failed to start sync:', err);
        }
    };

    const getStatusText = () => {
        // Show status-based messages first (most important)
        if (status === 'RUNNING') return `Upload progress: ${percent.toFixed(1)}%`;
        if (status === 'COMPLETED') return 'Import completed';
        if (status === 'FAILED') return `Import failed: ${progress?.error || 'Unknown error'}`;
        // Show errors only when idle
        if (error) return `Error: ${error}`;
        if (!progress) return 'Loading...';
        return 'Ready to sync';
    };

    return (
        <div className="page">
            <section className="sync-card" aria-label="Upload progress">
                <div className="sync-row">
                    <div className="sync-left">
                        <p className={`sync-title ${status === 'FAILED' ? 'sync-title--error' : ''}`}>
                            {getStatusText()}
                        </p>
                        <div
                            className="progress-track"
                            role="progressbar"
                            aria-valuenow={percent}
                            aria-valuemin={0}
                            aria-valuemax={100}
                        >
                            <div className="progress-fill" style={{ width: `${percent}%` }} />
                            {isRunning && <div className="progress-hatch" />}
                        </div>
                        <p className="sync-meta">
                            Processed: {formatNumber(progress?.rowsProcessed ?? 0)} |
                            Elapsed: {formatTime(progress?.elapsedSec ?? 0)} |
                            ETA: {formatTime(progress?.etaSec ?? null)}
                            {progress?.rateRowsPerSec ? ` | ${formatNumber(Math.round(progress.rateRowsPerSec))} rows/sec` : ''}
                        </p>
                    </div>
                    <button
                        className="sync-button"
                        type="button"
                        onClick={handleStartSync}
                        disabled={isDisabled}
                    >
                        {isLoading ? 'Starting...' : isRunning ? 'Syncing...' : 'Start sync'}
                    </button>
                </div>
            </section>

            <CustomerTable
                recentCustomers={progress?.recentCustomers}
                isImporting={isRunning}
            />
        </div>
    )
}

export default App