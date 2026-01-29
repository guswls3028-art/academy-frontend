// // PATH: src/features/exams/panels/setup/ExamSetupPanel.tsx
// /**
//  * ExamSetupPanel
//  *
//  * ✅ HomeworkSetupPanel UI 패턴을 canonical로 적용
//  * - card wrapper 제거
//  * - section 단위 구성
//  * - 안내 영역은 bg-surface-soft 사용
//  *
//  * ❌ 로직 / API / 상태 변경 없음
//  */

// import { useMemo, useState, useEffect } from "react";
// import { useSearchParams } from "react-router-dom";
// import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// import ExamPolicyPanel from "./ExamPolicyPanel";
// import ExamBulkActionsPanel from "./ExamBulkActionsPanel";

// import { useAdminExam } from "../../hooks/useAdminExam";
// import {
//   fetchExamEnrollmentRows,
//   updateExamEnrollmentRows,
//   type ExamEnrollmentRow,
// } from "../../api/examEnrollments";

// // ✅ 사용
// import EnrollmentManageModal
//   from "@/features/sessions/components/enrollment/EnrollmentManageModal";
// export default function ExamSetupPanel({ examId }: { examId: number }) {
//   const qc = useQueryClient();
//   const { data: exam } = useAdminExam(examId);
//   const [searchParams] = useSearchParams();

//   const sessionId = useMemo(() => {
//     const fromQuery = Number(searchParams.get("sessionId"));
//     if (Number.isFinite(fromQuery) && fromQuery > 0) return fromQuery;

//     const path = window.location.pathname;
//     const idx = path.indexOf("/sessions/");
//     if (idx >= 0) {
//       const rest = path.slice(idx + "/sessions/".length);
//       const sid = Number(rest.split("/")[0]);
//       if (Number.isFinite(sid) && sid > 0) return sid;
//     }

//     return 0;
//   }, [searchParams]);

//   const hasSession = Number.isFinite(sessionId) && sessionId > 0;

//   const enrollQ = useQuery({
//     queryKey: ["exam-enrollment-manage", examId, sessionId],
//     queryFn: () => fetchExamEnrollmentRows({ examId, sessionId }),
//     enabled: hasSession && Number.isFinite(examId),
//   });

//   const serverRows: ExamEnrollmentRow[] = enrollQ.data?.items ?? [];

//   const [selected, setSelected] = useState<Set<number>>(new Set());
//   const [open, setOpen] = useState(false);

//   useEffect(() => {
//     if (!open) return;
//     const init = new Set<number>();
//     for (const r of serverRows) {
//       if (r.is_selected) init.add(r.enrollment_id);
//     }
//     setSelected(init);
//   }, [open, serverRows]);

//   const selectedCount = selected.size;

//   const saveMut = useMutation({
//     mutationFn: async () => {
//       const ids = Array.from(selected).sort((a, b) => a - b);
//       return updateExamEnrollmentRows({
//         examId,
//         sessionId,
//         enrollment_ids: ids,
//       });
//     },
//     onSuccess: async () => {
//       await qc.invalidateQueries({
//         queryKey: ["exam-enrollment-manage", examId, sessionId],
//       });
//       alert("저장 완료: 시험 응시 대상자가 갱신되었습니다.");
//       setOpen(false);
//     },
//     onError: (e: any) => {
//       alert(e?.response?.data?.detail || "저장 실패");
//     },
//   });

//   const toggle = (id: number) => {
//     setSelected((prev) => {
//       const next = new Set(prev);
//       next.has(id) ? next.delete(id) : next.add(id);
//       return next;
//     });
//   };

//   return (
//     <div className="space-y-6">
//       {/* 시험 정책 */}
//       <ExamPolicyPanel examId={examId} />

//       {/* 시험 응시 대상 학생 */}
//       <section className="rounded border bg-[var(--bg-surface)]">
//         <div className="border-b px-4 py-3">
//           <div className="text-sm font-semibold text-[var(--text-primary)]">
//             시험 응시 대상 학생
//           </div>
//           <div className="text-xs text-[var(--text-muted)]">
//             세션 등록 학생 중 선택하여 시험 응시 대상자를 관리합니다.
//           </div>
//         </div>

//         <div className="p-4 space-y-3">
//           {!hasSession && (
//             <div className="rounded border bg-[var(--bg-surface-soft)] p-3 text-sm text-[var(--text-muted)]">
//               ⚠️ sessionId 컨텍스트가 없어 대상자 관리를 할 수 없습니다.
//             </div>
//           )}

//           {hasSession && enrollQ.isLoading && (
//             <div className="text-sm text-[var(--text-muted)]">
//               불러오는 중...
//             </div>
//           )}

//           {hasSession && enrollQ.isError && (
//             <div className="text-sm text-red-600">
//               대상자 조회 실패 (exam과 session 연결 확인 필요)
//             </div>
//           )}

//           {hasSession && !enrollQ.isLoading && !enrollQ.isError && (
//             <>
//               <div className="flex items-center justify-between rounded border bg-[var(--bg-surface-soft)] px-3 py-2">
//                 <div className="text-sm text-[var(--text-primary)]">
//                   선택된 대상자:{" "}
//                   <span className="font-semibold">{selectedCount}명</span>
//                 </div>
//                 <div className="text-xs text-[var(--text-muted)]">
//                   session #{sessionId}
//                 </div>
//               </div>

//               <button
//                 type="button"
//                 className="rounded border px-3 py-2 text-sm hover:bg-[var(--bg-surface-soft)]"
//                 onClick={() => setOpen(true)}
//               >
//                 시험 응시 대상자 등록 / 제거
//               </button>
//             </>
//           )}
//         </div>
//       </section>

//       {/* 안내 */}
//       <section className="rounded border bg-[var(--bg-surface-soft)] p-4 text-sm text-[var(--text-muted)]">
//         ℹ️ 시험 점수 입력 · 채점 · 판정은{" "}
//         <b className="text-[var(--text-primary)]">세션 &gt; 성적</b> 메뉴에서
//         진행합니다.
//       </section>

//       {/* 일괄 작업 */}
//       <ExamBulkActionsPanel examId={examId} />

//       {/* 공용 Enrollment Modal (다음 단계에서 전역화 예정) */}
//       {hasSession && (
//         <EnrollmentManageModal
//           open={open}
//           onClose={() => setOpen(false)}
//           title="시험 응시 대상자 관리"
//           description="세션 등록 학생 중에서 시험 응시 대상자를 선택 후 저장하세요."
//           sessionId={sessionId}
//           rows={serverRows}
//           loading={enrollQ.isLoading}
//           error={
//             enrollQ.isError
//               ? "목록 조회 실패 (session_id 연결을 확인하세요)"
//               : null
//           }
//           selectedIds={selected}
//           onToggle={toggle}
//           onSave={() => saveMut.mutate()}
//           saving={saveMut.isPending}
//         />
//       )}
//     </div>
//   );
// }

import { useSearchParams } from "react-router-dom";
import ExamPolicyPanel from "./ExamPolicyPanel";
import ExamBulkActionsPanel from "./ExamBulkActionsPanel";
import BlockReason from "../../components/BlockReason";

export default function ExamSetupPanel({ examId }: { examId: number }) {
  const [sp] = useSearchParams();
  const sessionId = Number(sp.get("session_id"));

  const hasSession = Number.isFinite(sessionId) && sessionId > 0;

  return (
    <div className="space-y-6">
      <ExamPolicyPanel examId={examId} />

      {!hasSession && (
        <BlockReason
          title="세션 컨텍스트 필요"
          description="대상자 관리 및 제출/결과는 session_id가 있을 때만 가능합니다."
        />
      )}

      <ExamBulkActionsPanel examId={examId} />
    </div>
  );
}
