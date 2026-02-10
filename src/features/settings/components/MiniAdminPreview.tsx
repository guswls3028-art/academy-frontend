// PATH: src/features/settings/components/MiniAdminPreview.tsx
export default function MiniAdminPreview() {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        borderRadius: 10,
        overflow: "hidden",
        background: "var(--pv-canvas)",
        display: "grid",
        gridTemplateColumns: "52px 1fr",
        border: "1px solid var(--pv-border)",
      }}
    >
      {/* Sidebar */}
      <div
        style={{
          background: "var(--pv-sidebar-bg)",
          color: "var(--pv-sidebar-text)",
          borderRight: "1px solid var(--pv-border)",
          padding: 8,
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        {/* Brand / Logo */}
        <div
          style={{
            height: 24,
            borderRadius: 10,
            border: "1px solid var(--pv-border)",
            background:
              "color-mix(in srgb, var(--pv-sidebar-bg) 86%, var(--pv-primary))",
            display: "grid",
            placeItems: "center",
          }}
        >
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: 4,
              background: "var(--pv-primary)",
              opacity: 0.95,
            }}
          />
        </div>

        {/* Nav */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div
            style={{
              height: 10,
              borderRadius: 8,
              background: "var(--pv-sidebar-muted)",
              opacity: 0.5,
            }}
          />
          <div
            style={{
              height: 16,
              borderRadius: 10,
              background: "var(--pv-sidebar-active-bg)",
              border: "1px solid var(--pv-border)",
            }}
          />
          <div
            style={{
              height: 14,
              borderRadius: 10,
              background: "var(--pv-sidebar-muted)",
              opacity: 0.35,
            }}
          />
          <div
            style={{
              height: 14,
              borderRadius: 10,
              background: "var(--pv-sidebar-muted)",
              opacity: 0.28,
            }}
          />
        </div>

        <div style={{ flex: 1 }} />

        {/* Footer button */}
        <div
          style={{
            height: 18,
            borderRadius: 10,
            border: "1px solid var(--pv-border)",
            background:
              "color-mix(in srgb, var(--pv-sidebar-bg) 88%, var(--pv-primary))",
            opacity: 0.9,
          }}
        />
      </div>

      {/* Main */}
      <div
        style={{
          background: "var(--pv-page)",
          display: "grid",
          gridTemplateRows: "22px 1fr 22px",
          gap: 8,
          padding: 10,
        }}
      >
        {/* Header bar */}
        <div
          style={{
            borderRadius: 10,
            border: "1px solid var(--pv-border)",
            background: "color-mix(in srgb, var(--pv-panel) 86%, transparent)",
          }}
        />

        {/* Content */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 8,
          }}
        >
          <div
            style={{
              borderRadius: 12,
              border: "1px solid var(--pv-border)",
              background: "var(--pv-panel)",
            }}
          />
          <div
            style={{
              borderRadius: 12,
              border: "1px solid var(--pv-border)",
              background:
                "color-mix(in srgb, var(--pv-panel) 88%, var(--pv-primary))",
            }}
          />
        </div>

        {/* CTA */}
        <div
          style={{
            borderRadius: 999,
            border: "1px solid var(--pv-border)",
            background: "var(--pv-primary)",
            opacity: 0.95,
            justifySelf: "end",
            width: "46%",
          }}
        />
      </div>
    </div>
  );
}
