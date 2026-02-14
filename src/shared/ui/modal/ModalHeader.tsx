// PATH: src/shared/ui/modal/ModalHeader.tsx
import React from "react";

type ModalHeaderProps = {
  title: React.ReactNode;
  description?: React.ReactNode;
  type?: "action" | "confirm" | "inspect";
};

function Icon({ type }: { type: "action" | "confirm" | "inspect" }) {
  const common = {
    width: 16,
    height: 16,
    viewBox: "0 0 24 24",
    fill: "none" as const,
  };

  if (type === "confirm") {
    return (
      <svg {...common}>
        <path
          d="M12 9v4"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M12 17h0"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d="M10.3 4.4 2.5 18a2 2 0 0 0 1.7 3h15.6a2 2 0 0 0 1.7-3L13.7 4.4a2 2 0 0 0-3.4 0Z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (type === "inspect") {
    return (
      <svg {...common}>
        <path
          d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z"
          stroke="currentColor"
          strokeWidth="2"
        />
        <path
          d="M16.5 16.5 21 21"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <path
        d="M12 3v18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.25"
      />
      <path
        d="M7 12h10"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M12 7v10"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function ModalHeader({
  title,
  description,
  type = "action",
}: ModalHeaderProps) {
  const isConfirm = type === "confirm";

  const accentColor =
    type === "confirm"
      ? "var(--color-error)"
      : type === "inspect"
      ? "var(--color-text-muted)"
      : "var(--color-brand-primary)";

  return (
    <div
      className={`modal-header modal-header--${type}`}
    >
      <div aria-hidden className="modal-header__accent" />

      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <div
          aria-hidden
          style={{
            width: 28,
            height: 28,
            borderRadius: 10,
            display: "grid",
            placeItems: "center",
            border: "1px solid var(--color-border-divider)",
            background: "var(--color-modal-bg)",
            color: accentColor,
            boxShadow: "var(--elevation-1)",
            flex: "0 0 auto",
          }}
        >
          <Icon type={type} />
        </div>

        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: "var(--font-title)",
              letterSpacing: "-0.2px",
              color: "var(--color-text-primary)",
              lineHeight: 1.3,
            }}
          >
            {title}
          </div>

          {description && (
            <div
              style={{
                marginTop: 4,
                fontSize: 12,
                fontWeight: "var(--font-meta)",
                color: isConfirm ? "var(--color-text-secondary)" : "var(--color-text-muted)",
                lineHeight: 1.45,
              }}
            >
              {description}
            </div>
          )}

          {/* confirm-only: subtle warning cue */}
          {isConfirm && (
            <div
              style={{
                marginTop: 8,
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 10px",
                borderRadius: 12,
                border:
                  "1px solid color-mix(in srgb, var(--color-error) 22%, var(--color-border-divider))",
                background:
                  "color-mix(in srgb, var(--color-error) 6%, var(--color-modal-bg))",
                color: "var(--color-text-secondary)",
                fontSize: 12,
                fontWeight: "var(--font-meta)",
                letterSpacing: "-0.12px",
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 999,
                  background: "var(--color-error)",
                  boxShadow:
                    "0 0 0 3px color-mix(in srgb, var(--color-error) 14%, transparent)",
                }}
              />
              변경 사항은 되돌릴 수 없습니다.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
