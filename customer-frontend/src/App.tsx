import './App.css'

function App() {
  return (
    <div className="page">
      <section className="sync-card" aria-label="Upload progress">
        <div className="sync-row">
          <div className="sync-left">
            <p className="sync-title">Upload progress: 70 %</p>
            <div className="progress-track" role="progressbar" aria-valuenow={70} aria-valuemin={0} aria-valuemax={100}>
              <div className="progress-fill" />
              <div className="progress-hatch" />
            </div>
            <p className="sync-meta">Processed: 1000 | Elapsed: 2m 16s | ETA: 2m 10s</p>
          </div>
          <button className="sync-button" type="button">
            Start sync
          </button>
        </div>
      </section>
      <section className="table-card" aria-label="Customer table">
        <header className="table-header">
          <h2>Customer table</h2>
        </header>
        <div className="table-grid" role="table" aria-label="Customer data grid">
          {Array.from({ length: 12 }).map((_, rowIndex) => (
            <div className="table-row" role="row" key={`row-${rowIndex}`}>
              {Array.from({ length: 6 }).map((__, colIndex) => (
                <div className="table-cell" role="cell" key={`cell-${rowIndex}-${colIndex}`} />
              ))}
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

export default App
