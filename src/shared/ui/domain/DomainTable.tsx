// PATH: src/shared/ui/domain/DomainTable.tsx
// Students 도메인 UI SSOT — ds-table-wrap + table.ds-table 공통 래퍼

import { ReactNode, CSSProperties } from "react";

type DomainTableProps = {
  children: ReactNode;
  /** table에 추가할 className */
  tableClassName?: string;
  /** table 인라인 스타일 (예: tableLayout: "fixed") */
  tableStyle?: CSSProperties;
};

export default function DomainTable({
  children,
  tableClassName,
  tableStyle,
}: DomainTableProps) {
  return (
    <div className="ds-table-wrap" style={{ overflow: "hidden" }}>
      <table
        className={`ds-table w-full ${tableClassName ?? ""}`.trim()}
        style={tableStyle}
      >
        {children}
      </table>
    </div>
  );
}
