// PATH: src/shared/ui/domain/DomainTable.tsx
// Students 도메인 UI SSOT — ds-table-wrap + table.ds-table 공통 래퍼

import { ReactNode, CSSProperties } from "react";

type DomainTableProps = {
  children: ReactNode;
  /** table에 추가할 className */
  tableClassName?: string;
  /** table 인라인 스타일 (예: tableLayout: "fixed") */
  tableStyle?: CSSProperties;
  /** data-* 속성 전달 (예: data-edit-mode) */
  dataAttributes?: Record<string, string>;
};

export default function DomainTable({
  children,
  tableClassName,
  tableStyle,
  dataAttributes,
}: DomainTableProps) {
  const hasExplicitWidth = tableStyle?.width != null;
  return (
    <div className="ds-table-wrap" style={{ overflowX: "auto", overflowY: "visible" }}>
      <table
        className={`ds-table ${hasExplicitWidth ? "" : "w-full"} ${tableClassName ?? ""}`.trim()}
        style={{
          ...tableStyle,
          ...(tableStyle?.width != null && tableStyle?.minWidth == null
            ? { minWidth: tableStyle.width }
            : undefined),
        }}
        {...dataAttributes}
      >
        {children}
      </table>
    </div>
  );
}
