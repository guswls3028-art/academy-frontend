// PATH: src/shared/ui/ds/Tabs.tsx
import React from "react";

export interface TabItem {
  key: string;
  label: React.ReactNode;
  disabled?: boolean;
}

interface TabsProps {
  value: string;
  items: TabItem[];
  onChange: (key: string) => void;
}

export function Tabs({ value, items, onChange }: TabsProps) {
  return (
    <div className="ds-tabs" role="tablist" aria-orientation="horizontal">
      {items.map((t) => {
        const active = value === t.key;
        return (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={active}
            aria-disabled={t.disabled || false}
            disabled={t.disabled}
            onClick={() => !t.disabled && onChange(t.key)}
            className={`ds-tab ${active ? "is-active" : ""}`}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
