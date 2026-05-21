// PATH: src/shared/ui/domain/DomainTable.tsx
// Students 도메인 UI SSOT — ds-table-wrap + table.ds-table 공통 래퍼

import type { CSSProperties, ReactNode } from "react";

type DomainTableStyle = CSSProperties & {
  width?: string | number;
  minWidth?: string | number;
  tableLayout?: "auto" | "fixed" | string;
  [customProperty: `--${string}`]: string | number | undefined;
};

type DomainTableProps = {
  children: ReactNode;
  /** table에 추가할 className */
  tableClassName?: string;
  /** table 인라인 스타일 (예: tableLayout: "fixed") */
  tableStyle?: DomainTableStyle;
  /** data-* 속성 전달 (예: data-edit-mode) */
  dataAttributes?: Record<string, string>;
};

function getResolvedTableStyle(tableStyle?: DomainTableStyle): CSSProperties | undefined {
  if (!tableStyle) return undefined;
  if (tableStyle.width == null || tableStyle.minWidth != null) return tableStyle;
  return { ...tableStyle, minWidth: tableStyle.width };
}

export default function DomainTable({
  children,
  tableClassName,
  tableStyle,
  dataAttributes,
}: DomainTableProps) {
  const hasExplicitWidth = tableStyle?.width != null;
  return (
    <div className="ds-table-wrap ds-table-wrap--domain-scroll">
      <table
        className={`ds-table ${hasExplicitWidth ? "" : "w-full"} ${tableClassName ?? ""}`.trim()}
        style={getResolvedTableStyle(tableStyle)}
        {...dataAttributes}
      >
        {children}
      </table>
    </div>
  );
}
