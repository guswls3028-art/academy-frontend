// PATH: src/app_teacher/domains/exams/pages/OmrPage.tsx
// OMR 관리 — 답안지 PDF 다운로드 + 카메라/파일로 스캔 업로드
import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { EmptyState } from "@/shared/ui/ds";
import { ChevronLeft, Download, Upload, Camera, Check } from "@teacher/shared/ui/Icons";
import { Card } from "@teacher/shared/ui/Card";
import { Badge } from "@teacher/shared/ui/Badge";
import { teacherToast } from "@teacher/shared/ui/teacherToast";
import { fetchOMRDefaults, downloadOMRPdf, submitOMR, fetchExam, fetchExamResults } from "../api";

export default function OmrPage() {
  const { examId } = useParams<{ examId: string }>();
  const navigate = useNavigate();
  const eid = Number(examId);

  const [mcCount, setMcCount] = useState(20);
  const [essayCount, setEssayCount] = useState(0);
  const [nChoices, setNChoices] = useState(5);
  const [uploadTarget, setUploadTarget] = useState<number | null>(null);

  const { data: exam } = useQuery({
    queryKey: ["teacher-exam", eid],
    queryFn: () => fetchExam(eid),
    enabled: Number.isFinite(eid),
  });

  const { data: defaults, isLoading } = useQuery({
    queryKey: ["teacher-omr-defaults", eid],
    queryFn: () => fetchOMRDefaults(eid),
    enabled: Number.isFinite(eid),
  });

  const { data: results } = useQuery({
    queryKey: ["teacher-exam-results", eid],
    queryFn: () => fetchExamResults(eid),
    enabled: Number.isFinite(eid),
  });

  useEffect(() => {
    if (defaults) {
      setMcCount(defaults.mc_count);
      setEssayCount(defaults.essay_count);
      setNChoices(defaults.n_choices);
    }
  }, [defaults]);

  const downloadMut = useMutation({
    mutationFn: () => downloadOMRPdf(eid, {
      exam_title: defaults?.exam_title ?? exam?.title,
      lecture_name: defaults?.lecture_name,
      session_name: defaults?.session_name,
      mc_count: mcCount,
      essay_count: essayCount,
      n_choices: nChoices,
    }),
    onSuccess: () => teacherToast.success("OMR PDF를 다운로드했습니다."),
    onError: () => teacherToast.error("다운로드에 실패했습니다."),
  });

  if (isLoading) return <EmptyState scope="panel" tone="loading" title="불러오는 중…" />;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 py-0.5">
        <button onClick={() => navigate(-1)} className="flex p-1 cursor-pointer"
          style={{ background: "none", border: "none", color: "var(--tc-text-secondary)" }}>
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-[17px] font-bold flex-1 truncate" style={{ color: "var(--tc-text)" }}>
          OMR · {defaults?.exam_title ?? exam?.title ?? "시험"}
        </h1>
      </div>

      {/* OMR 설정 */}
      <Card>
        <div className="text-sm font-bold mb-2" style={{ color: "var(--tc-text)" }}>OMR 답안지 설정</div>
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <Fld label="객관식 문항 수" value={mcCount} onChange={setMcCount} />
            <Fld label="주관식 문항 수" value={essayCount} onChange={setEssayCount} />
          </div>
          <Fld label="객관식 선택지 수" value={nChoices} onChange={setNChoices} />
        </div>

        <button onClick={() => downloadMut.mutate()} disabled={downloadMut.isPending}
          className="flex items-center justify-center gap-2 w-full text-sm font-bold cursor-pointer mt-3"
          style={{ padding: "12px", borderRadius: "var(--tc-radius)", border: "none", background: "var(--tc-primary)", color: "#fff" }}>
          <Download size={14} /> {downloadMut.isPending ? "생성 중…" : "OMR PDF 다운로드"}
        </button>
      </Card>

      {/* 학생 제출 목록 */}
      <Card>
        <div className="text-sm font-bold mb-2" style={{ color: "var(--tc-text)" }}>스캔 업로드</div>
        <p className="text-[11px] mb-3" style={{ color: "var(--tc-text-muted)", lineHeight: 1.5 }}>
          학생별로 작성된 OMR을 카메라로 찍거나 갤러리에서 선택하여 업로드하면 자동 채점됩니다.
        </p>
        {results && results.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            {results.map((r: any) => {
              const enrollmentId = r.enrollment ?? r.enrollment_id;
              const hasSubmission = !!(r.submitted_at || r.total_score != null);
              return (
                <div key={r.id ?? enrollmentId} className="flex items-center justify-between"
                  style={{ padding: "10px 12px", borderRadius: "var(--tc-radius-sm)", background: "var(--tc-surface-soft)" }}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[13px] font-semibold" style={{ color: "var(--tc-text)" }}>{r.student_name ?? r.student?.name ?? "학생"}</span>
                      {hasSubmission && <Badge tone="success" size="xs"><Check size={9} /> 제출됨</Badge>}
                    </div>
                    {r.total_score != null && (
                      <div className="text-[11px] mt-0.5" style={{ color: "var(--tc-text-muted)" }}>
                        점수: {r.total_score}/{r.max_score ?? 100}
                      </div>
                    )}
                  </div>
                  <button onClick={() => setUploadTarget(enrollmentId)}
                    className="flex items-center gap-1 text-[12px] font-bold cursor-pointer shrink-0"
                    style={{ padding: "10px 14px", minHeight: "var(--tc-touch-min)", borderRadius: "var(--tc-radius-sm)", border: "1px solid var(--tc-primary)", background: "var(--tc-primary-bg)", color: "var(--tc-primary)" }}>
                    <Camera size={14} /> 스캔
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState scope="panel" tone="empty" title="응시 학생이 없습니다" />
        )}
      </Card>

      {/* Upload modal */}
      <UploadSheet open={uploadTarget != null} onClose={() => setUploadTarget(null)}
        examId={eid} enrollmentId={uploadTarget} />
    </div>
  );
}

function UploadSheet({ open, onClose, examId, enrollmentId }: {
  open: boolean; onClose: () => void; examId: number; enrollmentId: number | null;
}) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const submitMut = useMutation({
    mutationFn: (file: File) => submitOMR(examId, { enrollment_id: enrollmentId!, file }),
    onSuccess: () => {
      teacherToast.success("스캔이 제출되었습니다. 자동 채점이 진행됩니다.");
      onClose();
    },
    onError: (e: any) => teacherToast.error(e?.response?.data?.detail ?? "업로드에 실패했습니다."),
  });

  if (!open) return null;

  const pick = (fromCamera: boolean) => {
    const ref = fromCamera ? cameraRef : galleryRef;
    ref.current?.click();
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end" style={{ background: "rgba(0,0,0,0.5)" }} onClick={onClose}>
      <div className="w-full rounded-t-2xl"
        onClick={(e) => e.stopPropagation()}
        style={{ padding: "20px 20px calc(20px + var(--tc-safe-bottom))", background: "var(--tc-surface)" }}>
        <div className="text-center mb-4">
          <div className="text-[16px] font-bold" style={{ color: "var(--tc-text)" }}>OMR 스캔 업로드</div>
          <div className="text-[11px] mt-1" style={{ color: "var(--tc-text-muted)" }}>촬영 또는 갤러리에서 선택</div>
        </div>
        <div className="flex flex-col gap-2">
          <button onClick={() => pick(true)} disabled={submitMut.isPending}
            className="flex items-center justify-center gap-2 text-sm font-bold cursor-pointer"
            style={{ padding: "14px", borderRadius: "var(--tc-radius)", border: "none", background: "var(--tc-primary)", color: "#fff" }}>
            <Camera size={14} /> 카메라로 촬영
          </button>
          <button onClick={() => pick(false)} disabled={submitMut.isPending}
            className="flex items-center justify-center gap-2 text-sm font-semibold cursor-pointer"
            style={{ padding: "14px", borderRadius: "var(--tc-radius)", border: "1px solid var(--tc-border-strong)", background: "var(--tc-surface)", color: "var(--tc-text-secondary)" }}>
            <Upload size={14} /> 갤러리에서 선택
          </button>
          <button onClick={onClose} disabled={submitMut.isPending}
            className="text-sm font-semibold cursor-pointer"
            style={{ padding: "10px", borderRadius: "var(--tc-radius)", border: "none", background: "none", color: "var(--tc-text-muted)" }}>
            취소
          </button>
        </div>

        {submitMut.isPending && (
          <div className="text-[12px] text-center mt-3" style={{ color: "var(--tc-text-muted)" }}>업로드 중…</div>
        )}

        {/* Hidden inputs */}
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) submitMut.mutate(f); if (cameraRef.current) cameraRef.current.value = ""; }} />
        <input ref={galleryRef} type="file" accept="image/*,application/pdf" style={{ display: "none" }}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) submitMut.mutate(f); if (galleryRef.current) galleryRef.current.value = ""; }} />
      </div>
    </div>
  );
}

function Fld({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex-1">
      <label className="text-[11px] font-semibold block mb-1" style={{ color: "var(--tc-text-muted)" }}>{label}</label>
      <input type="number" value={value} onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="w-full text-sm"
        style={{ padding: "8px 10px", borderRadius: "var(--tc-radius-sm)", border: "1px solid var(--tc-border-strong)", background: "var(--tc-surface-soft)", color: "var(--tc-text)", outline: "none" }} />
    </div>
  );
}
