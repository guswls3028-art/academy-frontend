/* eslint-disable no-restricted-syntax */
// PATH: src/app_teacher/domains/comms/components/RegistrationRequestList.tsx
// 학생 등록요청 목록 + 승인/거절
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { approveRegistration, rejectRegistration } from "../api";
import type { RegistrationRequest } from "../api";
import BottomSheet from "@teacher/shared/ui/BottomSheet";
import { teacherToast } from "@teacher/shared/ui/teacherToast";
import { extractApiError } from "@/shared/utils/extractApiError";

interface Props {
  requests: RegistrationRequest[];
}

export default function RegistrationRequestList({ requests }: Props) {
  const [detail, setDetail] = useState<RegistrationRequest | null>(null);

  return (
    <>
      <div className="flex flex-col">
        {requests.map((r) => (
          <RequestCard key={r.id} request={r} onTap={() => setDetail(r)} />
        ))}
      </div>

      <BottomSheet
        open={!!detail}
        onClose={() => setDetail(null)}
        title="등록요청 상세"
      >
        {detail && <RequestDetail request={detail} onDone={() => setDetail(null)} />}
      </BottomSheet>
    </>
  );
}

function RequestCard({
  request: r,
  onTap,
}: {
  request: RegistrationRequest;
  onTap: () => void;
}) {
  const school = r.high_school || r.middle_school || r.elementary_school || "";

  return (
    <button
      onClick={onTap}
      className="w-full text-left cursor-pointer"
      style={{
        padding: "var(--tc-space-3) 0",
        background: "none",
        border: "none",
        borderBottom: "1px solid var(--tc-border-subtle)",
      }}
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold" style={{ color: "var(--tc-text)" }}>
            {r.name}
          </div>
          <div className="text-xs mt-0.5" style={{ color: "var(--tc-text-muted)" }}>
            {school && `${school} · `}
            {r.grade && `${r.grade} · `}
            {new Date(r.created_at).toLocaleDateString("ko-KR")} 접수
          </div>
        </div>
        <span
          className="text-[10px] font-bold rounded-full px-2"
          style={{
            lineHeight: "20px",
            background: "var(--tc-warn-bg)",
            color: "#b45309",
          }}
        >
          대기중
        </span>
      </div>
    </button>
  );
}

function RequestDetail({
  request: r,
  onDone,
}: {
  request: RegistrationRequest;
  onDone: () => void;
}) {
  const qc = useQueryClient();

  const approveMut = useMutation({
    mutationFn: () => approveRegistration(r.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teacher-registration-requests"] });
      qc.invalidateQueries({ queryKey: ["admin", "notification-counts"] });
      teacherToast.success(`${r.name} 학생이 승인되었습니다.`);
      onDone();
    },
    onError: (e) => teacherToast.error(extractApiError(e, "승인 처리에 실패했습니다.")),
  });

  const rejectMut = useMutation({
    mutationFn: () => rejectRegistration(r.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teacher-registration-requests"] });
      qc.invalidateQueries({ queryKey: ["admin", "notification-counts"] });
      teacherToast.info(`${r.name} 학생의 신청이 거절되었습니다.`);
      onDone();
    },
    onError: (e) => teacherToast.error(extractApiError(e, "거절 처리에 실패했습니다.")),
  });

  const school = r.high_school || r.middle_school || r.elementary_school || "-";
  const pending = approveMut.isPending || rejectMut.isPending;

  const rows: [string, string][] = [
    ["이름", r.name],
    ["학교", school],
    ["학년", r.grade || "-"],
    ["연락처", maskPhone(r.phone)],
    ["학부모 연락처", maskPhone(r.parent_phone)],
    ["접수일", new Date(r.created_at).toLocaleDateString("ko-KR")],
  ];
  if (r.memo) rows.push(["메모", r.memo]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between text-sm">
            <span style={{ color: "var(--tc-text-muted)" }}>{label}</span>
            <span className="font-medium" style={{ color: "var(--tc-text)" }}>
              {value}
            </span>
          </div>
        ))}
      </div>

      {(approveMut.isError || rejectMut.isError) && (
        <div
          className="text-xs text-center rounded"
          style={{ padding: 8, background: "var(--tc-danger-bg)", color: "var(--tc-danger)" }}
        >
          처리 중 오류가 발생했습니다. 다시 시도해주세요.
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={() => rejectMut.mutate()}
          disabled={pending}
          className="flex-1 text-sm font-semibold cursor-pointer"
          style={{
            padding: "10px",
            borderRadius: "var(--tc-radius)",
            border: "1px solid var(--tc-danger)",
            background: "var(--tc-surface)",
            color: "var(--tc-danger)",
            opacity: pending ? 0.6 : 1,
          }}
        >
          {rejectMut.isPending ? "거절 중…" : "거절"}
        </button>
        <button
          onClick={() => approveMut.mutate()}
          disabled={pending}
          className="flex-1 text-sm font-bold cursor-pointer"
          style={{
            padding: "10px",
            borderRadius: "var(--tc-radius)",
            border: "none",
            background: "var(--tc-primary)",
            color: "#fff",
            opacity: pending ? 0.6 : 1,
          }}
        >
          {approveMut.isPending ? "승인 중…" : "승인"}
        </button>
      </div>
    </div>
  );
}

function maskPhone(phone?: string) {
  if (!phone) return "-";
  if (phone.length >= 8) {
    return phone.slice(0, 3) + "-****-" + phone.slice(-4);
  }
  return phone;
}
