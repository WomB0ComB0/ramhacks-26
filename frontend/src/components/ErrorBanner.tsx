interface Props {
  message: string;
  onDismiss?: () => void;
  variant?: "error" | "warning";
}

export default function ErrorBanner({ message, onDismiss, variant = "error" }: Props) {
  const color = variant === "error" ? "#fb7185" : "#fbbf24";
  return (
    <div
      role="alert"
      style={{
        marginTop: 12,
        marginBottom: 12,
        padding: "10px 14px",
        borderRadius: 10,
        border: `1px solid ${color}`,
        background: "rgba(251, 113, 133, 0.06)",
        display: "flex",
        gap: 12,
        alignItems: "flex-start",
        fontSize: 14,
        color: "var(--text)",
      }}
    >
      <span aria-hidden style={{ color, fontSize: 18, lineHeight: 1, marginTop: 1 }}>
        !
      </span>
      <div style={{ flex: 1, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{message}</div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          aria-label="Dismiss"
          style={{
            background: "transparent",
            border: "none",
            color: "var(--text-muted)",
            cursor: "pointer",
            fontSize: 16,
            lineHeight: 1,
            padding: 2,
          }}
        >
          ×
        </button>
      )}
    </div>
  );
}
