/**
 * 영상 (사이드바) — 아이콘 카드 그리드 · 강의별 영상 관리 진입 + 추가 모달
 */

import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchLectures, fetchSessions, type Lecture, type Session } from "@/features/lectures/api/sessions";
import { DomainLayout } from "@/shared/ui/layout";
import { EmptyState, Button } from "@/shared/ui/ds";
import { AdminModal, ModalBody, ModalFooter, ModalHeader, MODAL_WIDTH } from "@/shared/ui/modal";

/* ── 아이콘 SVG ── */
const VideoIcon = ({ size = 40, color = "var(--color-primary)" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
    <rect x="4" y="8" width="24" height="24" rx="4" stroke={color} strokeWidth="2" fill={color} fillOpacity="0.1" />
    <path d="M30 15l6-3v16l-6-3V15z" fill={color} fillOpacity="0.3" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
    <path d="M14 16l8 4-8 4V16z" fill={color} />
  </svg>
);

const AddIcon = ({ size = 40 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
    <circle cx="20" cy="20" r="14" stroke="var(--color-text-muted)" strokeWidth="1.5" strokeDasharray="4 3" />
    <path d="M20 14v12M14 20h12" stroke="var(--color-text-muted)" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

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

export default function VideoAdminPage() {
  const navigate = useNavigate();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);

  const { data: lectures = [], isLoading } = useQuery({
    queryKey: ["admin-videos-lectures"],
    queryFn: () => fetchLectures({ is_active: undefined }),
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return lectures;
    const k = search.trim().toLowerCase();
    return lectures.filter(
      (l) =>
        (l.title && l.title.toLowerCase().includes(k)) ||
        (l.name && l.name.toLowerCase().includes(k)) ||
        (l.subject && l.subject.toLowerCase().includes(k))
    );
  }, [lectures, search]);

  return (
    <DomainLayout title="영상" description="강의별 영상을 관리합니다. 영상 업로드는 각 강의 > 차시에서 설정하세요.">
      <style>{`
        .video-domain-card:hover {
          border-color: var(--color-primary) !important;
          box-shadow: 0 2px 12px rgba(0,0,0,0.06);
          transform: translateY(-2px);
        }
        .video-add-card:hover {
          border-color: var(--color-primary) !important;
          background: var(--color-bg-surface-soft) !important;
        }
      `}</style>

      <div style={{ marginBottom: 16 }}>
        <input
          className="ds-input"
          placeholder="강의명 · 과목 검색"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onBlur={() => setSearch(searchInput)}
          onKeyDown={(e) => e.key === "Enter" && setSearch(searchInput)}
          style={{ maxWidth: 320 }}
        />
      </div>

      {isLoading ? (
        <EmptyState scope="panel" tone="loading" title="불러오는 중..." />
      ) : filtered.length === 0 ? (
        <EmptyState scope="panel" tone="empty" title="영상 강의가 없습니다." description={search ? "검색 조건을 변경해 보세요." : "강의를 먼저 생성해 주세요."} />
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
            gap: 16,
          }}
        >
          {filtered.map((l) => (
            <div
              key={l.id}
              className="video-domain-card"
              style={cardBase}
              onClick={() => navigate(`/admin/lectures/${l.id}`)}
              title={`${l.title || l.name} — 영상 관리`}
            >
              <VideoIcon
                color={l.is_active ? "var(--color-primary)" : "var(--color-text-muted)"}
              />
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text-primary)", lineHeight: 1.3, maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {l.title || l.name || "강의"}
              </div>
              <div style={{ fontSize: 12, color: "var(--color-text-muted)", lineHeight: 1.2 }}>
                {l.subject || "—"}
              </div>
              {l.start_date && (
                <div style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
                  {l.start_date}{l.end_date ? ` ~ ${l.end_date}` : ""}
                </div>
              )}
              <span
                style={{
                  display: "inline-block",
                  fontSize: 11,
                  fontWeight: 600,
                  padding: "2px 8px",
                  borderRadius: 6,
                  background: l.is_active
                    ? "color-mix(in srgb, var(--color-success, #22c55e) 12%, transparent)"
                    : "var(--color-bg-surface-soft)",
                  color: l.is_active ? "var(--color-success, #16a34a)" : "var(--color-text-muted)",
                }}
              >
                {l.is_active ? "활성" : "비활성"}
              </span>
            </div>
          ))}

          {/* +추가 카드 (항상 마지막) */}
          <div
            className="video-add-card"
            style={{
              ...cardBase,
              border: "2px dashed var(--color-border-divider)",
              background: "transparent",
            }}
            onClick={() => setAddOpen(true)}
          >
            <AddIcon />
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text-muted)" }}>
              영상 추가
            </div>
          </div>
        </div>
      )}

      {addOpen && (
        <VideoAddModal open={addOpen} onClose={() => setAddOpen(false)} />
      )}
    </DomainLayout>
  );
}

/* ── 영상 추가 모달 (강의 > 차시 선택 후 해당 차시로 이동) ── */
function VideoAddModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [selectedLecture, setSelectedLecture] = useState<Lecture | null>(null);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const navigate = useNavigate();

  const { data: lectures = [] } = useQuery({
    queryKey: ["admin-lectures-for-video-add"],
    queryFn: () => fetchLectures({ is_active: true }),
    enabled: open,
  });

  const { data: sessions = [] } = useQuery({
    queryKey: ["lecture-sessions", selectedLecture?.id],
    queryFn: () => fetchSessions(selectedLecture!.id),
    enabled: !!selectedLecture,
  });

  function handleGo() {
    if (!selectedLecture) return;
    onClose();
    if (selectedSession) {
      navigate(`/admin/lectures/${selectedLecture.id}/sessions/${selectedSession.id}`);
    } else {
      navigate(`/admin/lectures/${selectedLecture.id}`);
    }
  }

  return (
    <AdminModal open={open} onClose={onClose} type="action" width={MODAL_WIDTH.sm}>
      <ModalHeader type="action" title="영상 추가" description="강의 · 차시를 선택하면 영상 업로드 페이지로 이동합니다." />
      <ModalBody>
        <div className="modal-scroll-body" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label className="modal-section-label">강의 선택</label>
            <select
              className="ds-input"
              value={selectedLecture?.id ?? ""}
              onChange={(e) => {
                const lec = lectures.find((l) => l.id === Number(e.target.value)) ?? null;
                setSelectedLecture(lec);
                setSelectedSession(null);
              }}
              style={{ width: "100%" }}
            >
              <option value="">— 강의를 선택하세요 —</option>
              {lectures.map((l) => (
                <option key={l.id} value={l.id}>{l.title || l.name} ({l.subject || "—"})</option>
              ))}
            </select>
          </div>

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
        </div>
      </ModalBody>
      <ModalFooter
        right={
          <>
            <Button intent="secondary" onClick={onClose}>취소</Button>
            {selectedSession && (
              <Button intent="primary" onClick={handleGo}>
                영상 관리 이동
              </Button>
            )}
          </>
        }
      />
    </AdminModal>
  );
}
