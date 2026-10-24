export function TableSkeleton({ rows = 5, cols = 6 }) {
  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="skeleton" style={{ height: 36, width: '100%' }} />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ display: 'flex', gap: 16 }}>
          {Array.from({ length: cols }).map((_, j) => (
            <div
              key={j}
              className="skeleton"
              style={{
                height: 24,
                flex: j === 0 ? 2 : 1,
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton({ count = 4 }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card" style={{ height: 130, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div className="skeleton" style={{ height: 16, width: '40%' }} />
            <div className="skeleton" style={{ height: 36, width: 36, borderRadius: 8 }} />
          </div>
          <div className="skeleton" style={{ height: 32, width: '60%' }} />
          <div className="skeleton" style={{ height: 14, width: '30%' }} />
        </div>
      ))}
    </div>
  );
}
