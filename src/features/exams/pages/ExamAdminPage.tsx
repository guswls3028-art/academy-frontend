/**
 * 시험 (사이드바) — 아이콘 카드 그리드 + 추가 모달
 */

import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchExams } from "../api/exams";
import { fetchLectures, fetchSessions, type Lecture, type Session } from "@/features/lectures/api/sessions";
import { DomainLayout } from "@/shared/ui/layout";
import { EmptyState, Button } from "@/shared/ui/ds";
import { AdminModal, ModalBody, ModalFooter, ModalHeader, MODAL_WIDTH } from "@/shared/ui/modal";
import { feedback } from "@/shared/ui/feedback/feedback";
import { createRegularExam, createTemplateExam } from "../api/exams";

/* ── 아이콘 SVG ── */
const ExamIcon = ({ size = 40, color = "var(--color-primary)" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
    <rect x="8" y="4" width="24" height="32" rx="3" stroke={color} strokeWidth="2" fill="none" />
    <path d="M14 14h12M14 20h12M14 26h8" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    <circle cx="28" cy="28" r="6" fill={color} fillOpacity="0.15" stroke={color} strokeWidth="1.5" />
    <path d="M26 28l1.5 1.5 3-3" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const AddIcon = ({ size = 40 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
    <circle cx="20" cy="20" r="14" stroke="var(--color-text-muted)" strokeWidth="1.5" strokeDasharray="4 3" />
    <path d="M20 14v12M14 20h12" stroke="var(--color-text-muted)" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

/* ── 카드 스타일 ── */
const cardBase: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 10,
  padding: "24px 16px",
  borderRadius: "var(--radius-lg, 12px)",
  border: "1px solid var(--color-border-divider)",
  background: "var(--color-bg-surface)",
  cursor: "pointer",
  transition: "all 0.15s ease",
  minHeight: 160,
  textAlign: "center" as const,
};

const cardHoverClass = "exam-domain-card";

export default function ExamAdminPage() {
  const navigate = useNavigate();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);

  const { data: list = [], isLoading } = useQuery({
    queryKey: ["admin-exams"],
    queryFn: () => fetchExams(),
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return list;
    const k = search.trim().toLowerCase();
    return list.filter(
      (e) =>
        (e.title && e.title.toLowerCase().includes(k)) ||
        (e.subject && e.subject.toLowerCase().includes(k))
    );
  }, [list, search]);

  return (
    <DomainLayout title="시험" description="모든 시험을 한눈에 확인하고, 새 시험을 추가할 수 있습니다.">
      <style>{`
        .exam-domain-card:hover {
          border-color: var(--color-primary) !important;
          box-shadow: 0 2px 12px rgba(0,0,0,0.06);
          transform: translateY(-2px);
        }
        .exam-add-card:hover {
          border-color: var(--color-primary) !important;
          background: var(--color-bg-surface-soft) !important;
        }
      `}</style>

      <div style={{ marginBottom: 16 }}>
        <input
          className="ds-input"
          placeholder="시험명 · 과목 검색"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onBlur={() => setSearch(searchInput)}
          onKeyDown={(e) => e.key === "Enter" && setSearch(searchInput)}
          style={{ maxWidth: 320 }}
        />
      </div>

      {isLoading ? (
        <EmptyState scope="panel" tone="loading" title="불러오는 중..." />
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
            gap: 16,
          }}
        >
          {filtered.map((e) => {
            const isClosed = e.status === "CLOSED";
            const isOpen = !isClosed;
            const statusLabel = isOpen ? "진행 중" : "마감";
            const iconColor = isOpen
              ? "var(--color-success)"
              : "var(--color-text-muted)";

            return (
              <div
                key={e.id}
                className={cardHoverClass}
                style={{
                  ...cardBase,
                  borderLeft: isOpen
                    ? "3px solid var(--color-success)"
                    : isClosed
                      ? "3px solid var(--color-border-divider)"
                      : "1px solid var(--color-border-divider)",
                  opacity: isClosed ? 0.65 : 1,
                }}
                onClick={() => navigate("/admin/lectures")}
                title={`${e.title} — ${e.subject || "과목 없음"}`}
              >
                <ExamIcon color={iconColor} />
                <div style={{
                  fontSize: 14, fontWeight: 600, color: "var(--color-text-primary)", lineHeight: 1.3,
                  maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  textDecoration: isClosed ? "line-through" : "none",
                }}>
                  {e.title || "제목 없음"}
                </div>
                <div style={{ fontSize: 12, color: "var(--color-text-muted)", lineHeight: 1.2 }}>
                  {e.subject || "—"}
                </div>
                <span className="ds-status-badge ds-status-badge--1ch" data-tone={isOpen ? "success" : isClosed ? "danger" : "neutral"}>
                  {statusLabel}
                </span>
              </div>
            );
          })}

          {/* +추가 카드 (항상 마지막) */}
          <div
            className="exam-add-card"
            style={{
              ...cardBase,
              border: "2px dashed var(--color-border-divider)",
              background: "transparent",
            }}
            onClick={() => setAddOpen(true)}
          >
            <AddIcon />
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text-muted)" }}>
              시험 추가
            </div>
          </div>
        </div>
      )}

      {addOpen && (
        <ExamAddModal open={addOpen} onClose={() => setAddOpen(false)} onSuccess={() => { setAddOpen(false); }} />
      )}
    </DomainLayout>
  );
}

/* ── 시험 추가 모달 ── */
function ExamAddModal({ open, onClose, onSuccess }: { open: boolean; onClose: () => void; onSuccess: () => void }) {
  const [step, setStep] = useState<"select" | "form">("select");
  const [selectedLecture, setSelectedLecture] = useState<Lecture | null>(null);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const { data: lectures = [] } = useQuery({
    queryKey: ["admin-lectures-for-exam-add"],
    queryFn: () => fetchLectures({ is_active: true }),
    enabled: open,
  });

  const { data: sessions = [] } = useQuery({
    queryKey: ["lecture-sessions", selectedLecture?.id],
    queryFn: () => fetchSessions(selectedLecture!.id),
    enabled: !!selectedLecture,
  });

  async function handleCreate() {
    if (!title.trim()) { feedback.error("시험명을 입력해 주세요."); return; }
    if (!selectedSession) { feedback.error("차시를 선택해 주세요."); return; }
    setBusy(true);
    try {
      await createTemplateExam({ title: title.trim(), subject: subject.trim() || selectedLecture?.subject || "" });
      feedback.success("시험이 생성되었습니다. 강의 > 차시에서 상세 설정하세요.");
      onSuccess();
      navigate(`/admin/lectures/${selectedLecture?.id}`);
    } catch {
      feedback.error("시험 생성에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminModal open={open} onClose={onClose} type="action" width={MODAL_WIDTH.sm}>
      <ModalHeader type="action" title="시험 추가" description="강의 · 차시를 선택한 뒤 시험을 만듭니다." />
      <ModalBody>
        <div className="modal-scroll-body" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* 강의 선택 */}
          <div>
            <label className="modal-section-label">강의 선택</label>
            <select
              className="ds-input"
              value={selectedLecture?.id ?? ""}
              onChange={(e) => {
                const lec = lectures.find((l) => l.id === Number(e.target.value)) ?? null;
                setSelectedLecture(lec);
                setSelectedSession(null);
                if (lec) setSubject(lec.subject || "");
              }}
              style={{ width: "100%" }}
            >
              <option value="">— 강의를 선택하세요 —</option>
              {lectures.map((l) => (
                <option key={l.id} value={l.id}>{l.title || l.name} ({l.subject || "—"})</option>
              ))}
            </select>
          </div>

          {/* 차시 선택 */}
          {selectedLecture && (
            <div>
              <label className="modal-section-label">차시 선택</label>
              {sessions.length === 0 ? (
                <div style={{ fontSize: 13, color: "var(--color-text-muted)", padding: "8px 0" }}>
                  차시가 없습니다. 먼저 차시를 추가하세요.
                </div>
              ) : (
                <select
                  className="ds-input"
                  value={selectedSession?.id ?? ""}
                  onChange={(e) => {
                    const ses = sessions.find((s) => s.id === Number(e.target.value)) ?? null;
                    setSelectedSession(ses);
                  }}
                  style={{ width: "100%" }}
                >
                  <option value="">— 차시를 선택하세요 —</option>
                  {sessions.map((s) => (
                    <option key={s.id} value={s.id}>{s.order}차시 — {s.title}</option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* 시험 정보 */}
          {selectedSession && (
            <>
              <div>
                <label className="modal-section-label">시험명</label>
                <input
                  className="ds-input"
                  placeholder="예: 1차시 확인테스트"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  style={{ width: "100%" }}
                  autoFocus
                />
              </div>
              <div>
                <label className="modal-section-label">과목</label>
                <input
                  className="ds-input"
                  placeholder="과목명"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  style={{ width: "100%" }}
                />
              </div>
            </>
          )}
        </div>
      </ModalBody>
      <ModalFooter
        right={
          <>
            <Button intent="secondary" onClick={onClose} disabled={busy}>취소</Button>
            {selectedSession && (
              <Button intent="primary" onClick={handleCreate} disabled={busy || !title.trim()}>
                {busy ? "생성 중..." : "생성"}
              </Button>
            )}
          </>
        }
      />
    </AdminModal>
  );
}
