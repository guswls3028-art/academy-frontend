// PATH: src/shared/ui/templates/ListPage.tsx
import React from "react";
import { Page, Panel, SectionHeader } from "@/shared/ui/ds";

export default function ListPage({
  title,
  description,
  actions,
  navigation,
  filters,
  children,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  navigation?: React.ReactNode;
  filters?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Page density="browse">
      {/* ===== SECTION HEADER (GLOBAL) ===== */}
      <SectionHeader
        title={title}
        description={description}
        actions={actions}
        navigation={navigation}
      />

      {/* ===== FILTER ZONE ===== */}
      {filters && (
        <div
          style={{
            marginTop: 20,
            borderRadius: "var(--radius-xl)",
            border: "1px solid var(--color-border-divider)",
            background: "var(--color-bg-surface)",
            boxShadow: "0 1px 0 rgba(0,0,0,0.02)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "14px 16px",
              background:
                "linear-gradient(180deg, var(--color-bg-surface-hover), var(--color-bg-surface))",
              borderBottom: "1px solid var(--color-border-divider)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 950,
                letterSpacing: "-0.12px",
                color: "var(--color-text-secondary)",
              }}
            >
              필터
            </div>
          </div>

          <div style={{ padding: 16 }}>{filters}</div>
        </div>
      )}

      {/* ===== WORK CUT (중요) ===== */}
      <div
        aria-hidden
        style={{
          margin: "28px 0 18px",
          height: 1,
          background:
            "linear-gradient(90deg, transparent, var(--color-border-divider), transparent)",
        }}
      />

      {/* ===== WORK PANEL ===== */}
      <Panel variant="default" density="default">
        {children}
      </Panel>
    </Page>
  );
}
