// PATH: src/features/profile/expense/components/ExpenseTable.tsx
import { Expense } from "../../api/profile.api";
import { FiEdit2, FiTrash2 } from "react-icons/fi";
import { Button } from "@/shared/ui/ds";
import { DomainTable } from "@/shared/ui/domain";

/**
 * 메모도 1fr 금지 → minmax로 제한
 */
const GRID =
  "grid grid-cols-[110px_140px_minmax(160px,240px)_110px_72px] items-center gap-3";

export default function ExpenseTable({
  rows,
  onEdit,
  onDelete,
}: {
  rows: Expense[];
  onEdit: (r: Expense) => void;
  onDelete: (r: Expense) => void;
}) {
  return (
    <DomainTable tableClassName="ds-table--flat">
      <thead>
        <tr
          style={{
            background: "color-mix(in srgb, var(--color-primary) 4%, transparent)",
          }}
        >
          <th
            style={{
              padding: "var(--space-3) var(--space-4)",
              fontSize: "var(--text-sm)",
              fontWeight: "var(--font-title)",
              color: "var(--color-text-secondary)",
              textAlign: "left",
            }}
          >
            날짜
          </th>
          <th
            style={{
              padding: "var(--space-3) var(--space-4)",
              fontSize: "var(--text-sm)",
              fontWeight: "var(--font-title)",
              color: "var(--color-text-secondary)",
              textAlign: "left",
            }}
          >
            항목
          </th>
          <th
            style={{
              padding: "var(--space-3) var(--space-4)",
              fontSize: "var(--text-sm)",
              fontWeight: "var(--font-title)",
              color: "var(--color-text-secondary)",
              textAlign: "left",
            }}
          >
            메모
          </th>
          <th
            style={{
              padding: "var(--space-3) var(--space-4)",
              fontSize: "var(--text-sm)",
              fontWeight: "var(--font-title)",
              color: "var(--color-text-secondary)",
              textAlign: "right",
            }}
          >
            금액
          </th>
          <th
            style={{
              padding: "var(--space-3) var(--space-4)",
              fontSize: "var(--text-sm)",
              fontWeight: "var(--font-title)",
              color: "var(--color-text-secondary)",
              textAlign: "center",
            }}
          >
            관리
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr
            key={r.id}
            className="transition-colors"
            style={{
              borderTop: "1px solid color-mix(in srgb, var(--color-border-divider) 35%, transparent)",
            }}
          >
            {/* 날짜 */}
            <td
              style={{
                padding: "var(--space-3) var(--space-4)",
                fontSize: "var(--text-sm)",
                fontWeight: 600,
                color: "var(--color-text-primary)",
              }}
            >
              {r.date}
            </td>

            {/* 항목 */}
            <td
              style={{
                padding: "var(--space-3) var(--space-4)",
                fontSize: "var(--text-sm)",
                fontWeight: 600,
                color: "var(--color-text-primary)",
              }}
            >
              {r.title}
            </td>

            {/* 메모 */}
            <td
              style={{
                padding: "var(--space-3) var(--space-4)",
                fontSize: "var(--text-sm)",
                color: "var(--color-text-secondary)",
                maxWidth: 300,
              }}
              className="truncate"
              title={r.memo || undefined}
            >
              {r.memo || "-"}
            </td>

            {/* 금액 */}
            <td
              style={{
                padding: "var(--space-3) var(--space-4)",
                fontSize: "var(--text-sm)",
                fontWeight: "var(--font-title)",
                color: "var(--color-text-primary)",
                textAlign: "right",
              }}
            >
              {r.amount.toLocaleString()}원
            </td>

            {/* 관리 */}
            <td
              style={{
                padding: "var(--space-3) var(--space-4)",
                textAlign: "center",
              }}
            >
              <div className="flex justify-center gap-1">
                <Button
                  type="button"
                  intent="ghost"
                  size="sm"
                  onClick={() => onEdit(r)}
                  title="수정"
                  className="!min-w-0 !w-8 !h-8 !p-0"
                >
                  <FiEdit2 size={14} />
                </Button>
                <Button
                  type="button"
                  intent="danger"
                  size="sm"
                  onClick={() => onDelete(r)}
                  title="삭제"
                  className="!min-w-0 !w-8 !h-8 !p-0"
                >
                  <FiTrash2 size={14} />
                </Button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </DomainTable>
  );
}
