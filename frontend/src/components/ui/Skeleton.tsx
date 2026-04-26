// Tiny presentational primitives for loading states. The .skeleton class
// (defined in index.css) supplies the gradient + pulse animation; these just
// give it a sized box.

interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  style?: React.CSSProperties;
}

export function Skeleton({ width = "100%", height = 12, style }: SkeletonProps) {
  return <div className="skeleton" style={{ width, height, ...style }} />;
}

export function SkeletonCard() {
  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <Skeleton width="60%" height={18} />
        <Skeleton width={64} height={20} style={{ borderRadius: 6 }} />
      </div>
      <Skeleton width="40%" height={12} />
      <Skeleton width="100%" height={36} />
      <div style={{ display: "flex", gap: 6 }}>
        <Skeleton width={56} height={20} style={{ borderRadius: 6 }} />
        <Skeleton width={72} height={20} style={{ borderRadius: 6 }} />
        <Skeleton width={48} height={20} style={{ borderRadius: 6 }} />
      </div>
      <Skeleton width="80%" height={12} />
      <Skeleton width="65%" height={12} />
    </div>
  );
}

export function SkeletonGrid({ count = 3 }: { count?: number }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
        gap: 16,
      }}
    >
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
