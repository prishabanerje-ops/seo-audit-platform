/**
 * LoadingSkeleton — animated placeholder for loading states.
 * type: 'table' | 'card' | 'ring'
 */
function Bone({ className = '', style = {} }) {
  return (
    <div
      className={`rounded animate-pulse ${className}`}
      style={{ backgroundColor: 'var(--bg-raised)', ...style }}
    />
  );
}

export function LoadingSkeleton({ rows = 5, columns = 4, type = 'table' }) {
  if (type === 'ring') {
    return (
      <div className="flex flex-col items-center gap-2">
        <div className="w-24 h-24 rounded-full animate-pulse" style={{ backgroundColor: 'var(--bg-raised)' }} />
        <Bone className="w-20 h-3" />
      </div>
    );
  }

  if (type === 'card') {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="p-4 rounded-lg border" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-default)' }}>
            <Bone className="w-24 h-3 mb-3" />
            <Bone className="w-16 h-7 mb-1" />
            <Bone className="w-20 h-2.5" />
          </div>
        ))}
      </div>
    );
  }

  // Table skeleton
  return (
    <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border-default)' }}>
      {/* Header */}
      <div className="flex gap-4 px-4 py-3" style={{ backgroundColor: 'var(--bg-raised)', borderBottom: '1px solid var(--border-default)' }}>
        {Array.from({ length: columns }).map((_, i) => (
          <Bone key={i} className="h-3 flex-1" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, ri) => (
        <div
          key={ri}
          className="flex gap-4 px-4 py-3.5"
          style={{ borderBottom: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-surface)' }}
        >
          {Array.from({ length: columns }).map((_, ci) => (
            <Bone
              key={ci}
              className="h-3"
              style={{ flex: 1, opacity: 1 - ri * 0.08, maxWidth: ci === 0 ? '40%' : undefined }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
