// App-wide brand mark. Used in both signed-out hero and signed-in header.

export default function Brand() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div
        aria-hidden
        style={{
          width: 28,
          height: 28,
          borderRadius: 8,
          background: "linear-gradient(135deg, #a78bfa, #6366f1)",
          boxShadow: "0 6px 20px rgba(167, 139, 250, 0.35)",
        }}
      />
      <span style={{ fontWeight: 600, letterSpacing: "-0.01em", color: "var(--text-strong)" }}>
        AI Career Matcher
      </span>
    </div>
  );
}
