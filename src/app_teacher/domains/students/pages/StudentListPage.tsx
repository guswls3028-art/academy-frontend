/* eslint-disable no-restricted-syntax, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-expressions */
// PATH: src/app_teacher/domains/students/pages/StudentListPage.tsx
// 학생 목록 — 강의딱지 + 전화번호 + 검색 + 필터 + 대량 선택 모드
import { useState, useDeferredValue } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { EmptyState } from "@/shared/ui/ds";
import { formatPhone } from "@/shared/utils/formatPhone";
import LectureChip from "@/shared/ui/chips/LectureChip";
import { Search, Filter, ChevronRight, Plus, Download, Upload, Check, X, Trash2, Tag, MessageSquare, Lock } from "@teacher/shared/ui/Icons";
import { Badge } from "@teacher/shared/ui/Badge";
import BottomSheet from "@teacher/shared/ui/BottomSheet";
import { teacherToast } from "@teacher/shared/ui/teacherToast";
import { extractApiError } from "@/shared/utils/extractApiError";
import {
  fetchStudents, exportStudentsExcel, uploadStudentBulkExcel,
  bulkDeleteStudents, bulkAttachTag, fetchTags, createTag, sendPasswordReset,
} from "../api";
import CreateStudentSheet from "../components/CreateStudentSheet";
import { sendMessage } from "@teacher/domains/comms/api";
import { useConfirm } from "@/shared/ui/confirm";

type FilterState = {
  grade?: string;
  gender?: string;
  status?: string;
};

type BulkAction = "delete" | "message" | "tag" | "password" | null;

export default function StudentListPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [search, setSearch] = useState("");
  const [showFilter, setShowFilter] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [filters, setFilters] = useState<FilterState>({});
  const deferredSearch = useDeferredValue(search);

  // Selection mode
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkAction, setBulkAction] = useState<BulkAction>(null);

  const hasFilter = Object.values(filters).some(Boolean);

  const { data, isLoading } = useQuery({
    queryKey: ["students-mobile", deferredSearch, filters],
    queryFn: () =>
      fetchStudents({
        search: deferredSearch.trim() || undefined,
        page_size: 50,
        ...(filters.grade ? { grade: Number(filters.grade) } : {}),
        ...(filters.gender ? { gender: filters.gender } : {}),
        ...(filters.status ? { status: filters.status } : {}),
      }),
  });

  const students = data?.data ?? [];
  const selectedCount = selectedIds.size;
  const selectedStudents = students.filter((s: any) => selectedIds.has(s.id));

  const toggleSelect = (id: number) => {
    const next = new Set(selectedIds);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelectedIds(next);
  };
  const selectAll = () => setSelectedIds(new Set(students.map((s: any) => s.id)));
  const clearSelection = () => setSelectedIds(new Set());
  const exitSelectMode = () => { setSelectMode(false); clearSelection(); };

  const deleteMut = useMutation({
    mutationFn: (ids: number[]) => bulkDeleteStudents(ids),
    onSuccess: (_, ids) => {
      qc.invalidateQueries({ queryKey: ["students-mobile"] });
      teacherToast.success(`${ids.length}명을 삭제했습니다. (30일 내 복원 가능)`);
      exitSelectMode();
    },
    onError: () => teacherToast.error("삭제에 실패했습니다."),
  });

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      {!selectMode ? (
        <div className="flex items-center justify-between">
          <div className="text-[17px] font-bold" style={{ color: "var(--tc-text)" }}>학생</div>
          <div className="flex gap-1.5">
            <button onClick={() => setSelectMode(true)}
              className="flex items-center gap-1 text-[11px] font-semibold cursor-pointer"
              style={{ padding: "8px 10px", minHeight: "var(--tc-touch-min)", borderRadius: "var(--tc-radius-sm)", border: "1px solid var(--tc-border)", background: "var(--tc-surface)", color: "var(--tc-text-secondary)" }}>
              선택
            </button>
            <button onClick={() => exportStudentsExcel().catch(() => teacherToast.error("내보내기에 실패했습니다."))}
              className="flex items-center gap-1 text-[11px] font-semibold cursor-pointer"
              style={{ padding: "8px 10px", minHeight: "var(--tc-touch-min)", borderRadius: "var(--tc-radius-sm)", border: "1px solid var(--tc-border)", background: "var(--tc-surface)", color: "var(--tc-text-secondary)" }}>
              <Download size={12} /> 엑셀
            </button>
            <label className="flex items-center gap-1 text-[11px] font-semibold cursor-pointer"
              style={{ padding: "8px 10px", minHeight: "var(--tc-touch-min)", borderRadius: "var(--tc-radius-sm)", border: "1px solid var(--tc-border)", background: "var(--tc-surface)", color: "var(--tc-text-secondary)" }}>
              <Upload size={12} /> 가져오기
              <input type="file" accept=".xlsx,.xls,.csv" style={{ display: "none" }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    uploadStudentBulkExcel(f, "0000")
                      .then(async () => {
                        await qc.invalidateQueries({ queryKey: ["students-mobile"] });
                        teacherToast.success("학생 일괄 업로드를 완료했습니다.");
                      })
                      .catch((err) => teacherToast.error(extractApiError(err, "학생 일괄 업로드에 실패했습니다.")));
                  }
                  e.target.value = "";
                }} />
            </label>
            <button onClick={() => setCreateOpen(true)}
              className="flex items-center gap-1 text-xs font-bold cursor-pointer"
              style={{ padding: "8px 14px", minHeight: "var(--tc-touch-min)", borderRadius: "var(--tc-radius)", border: "none", background: "var(--tc-primary)", color: "#fff" }}>
              <Plus size={14} /> 등록
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2"
          style={{ padding: "8px 10px", borderRadius: "var(--tc-radius)", background: "var(--tc-primary-bg)", border: "1px solid var(--tc-primary)" }}>
          <button onClick={exitSelectMode} className="flex p-1 cursor-pointer"
            style={{ background: "none", border: "none", color: "var(--tc-primary)" }}>
            <X size={16} />
          </button>
          <div className="flex-1 text-[13px] font-bold" style={{ color: "var(--tc-primary)" }}>
            {selectedCount}명 선택됨
          </div>
          <button onClick={selectAll} className="text-[11px] font-semibold cursor-pointer"
            style={{ padding: "4px 8px", borderRadius: "var(--tc-radius-sm)", border: "1px solid var(--tc-primary)", background: "var(--tc-surface)", color: "var(--tc-primary)" }}>
            전체 선택
          </button>
          {selectedCount > 0 && (
            <button onClick={clearSelection} className="text-[11px] font-semibold cursor-pointer"
              style={{ padding: "4px 8px", borderRadius: "var(--tc-radius-sm)", border: "1px solid var(--tc-border-strong)", background: "var(--tc-surface)", color: "var(--tc-text-secondary)" }}>
              해제
            </button>
          )}
        </div>
      )}

      {/* Search + Filter (hidden in select mode) */}
      {!selectMode && (
        <>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--tc-text-muted)" }} />
              <input type="text" placeholder="이름, 전화번호, 학교" value={search} onChange={(e) => setSearch(e.target.value)}
                className="w-full text-sm outline-none"
                style={{ padding: "10px 12px 10px 36px", border: "1px solid var(--tc-border-strong)", borderRadius: "var(--tc-radius)", background: "var(--tc-surface)", color: "var(--tc-text)" }} />
            </div>
            <button onClick={() => setShowFilter(true)}
              className="flex items-center justify-center shrink-0 cursor-pointer"
              style={{
                width: 40, height: 40, borderRadius: "var(--tc-radius)",
                border: hasFilter ? "2px solid var(--tc-primary)" : "1px solid var(--tc-border-strong)",
                background: hasFilter ? "var(--tc-primary-bg)" : "var(--tc-surface)",
                color: hasFilter ? "var(--tc-primary)" : "var(--tc-text-muted)",
              }}>
              <Filter size={18} />
            </button>
          </div>

          {hasFilter && (
            <div className="flex gap-1.5 flex-wrap">
              {filters.grade && <Badge tone="primary" pill>{filters.grade}학년</Badge>}
              {filters.gender && <Badge tone="primary" pill>{filters.gender === "M" ? "남" : "여"}</Badge>}
              <button onClick={() => setFilters({})} className="text-[11px] cursor-pointer" style={{ color: "var(--tc-danger)", background: "none", border: "none" }}>초기화</button>
            </div>
          )}

          {!isLoading && students.length > 0 && (
            <div className="text-xs" style={{ color: "var(--tc-text-muted)" }}>총 {data?.count ?? students.length}명</div>
          )}
        </>
      )}

      {/* List */}
      {isLoading ? (
        <EmptyState scope="panel" tone="loading" title="불러오는 중…" />
      ) : students.length > 0 ? (
        <div className="flex flex-col gap-1.5" style={{ paddingBottom: selectMode ? 80 : 0 }}>
          {students.map((s: any) => {
            const name = s.name ?? s.displayName ?? "이름 없음";
            const enrollments = s.enrollments ?? [];
            const parentPhone = s.parentPhone ?? s.parent_phone;
            const studentPhone = s.studentPhone ?? s.student_phone ?? s.phone;
            const sub = [s.grade != null ? `${s.grade}학년` : null, s.school].filter(Boolean).join(" · ");
            const isSelected = selectedIds.has(s.id);

            return (
              <button
                key={s.id}
                onClick={() => selectMode ? toggleSelect(s.id) : navigate(`/teacher/students/${s.id}`)}
                className="flex gap-3 rounded-xl w-full text-left cursor-pointer"
                style={{
                  padding: "var(--tc-space-3) var(--tc-space-4)",
                  background: isSelected ? "var(--tc-primary-bg)" : "var(--tc-surface)",
                  border: `${isSelected ? "2px" : "1px"} solid ${isSelected ? "var(--tc-primary)" : "var(--tc-border)"}`,
                }}>
                {selectMode && (
                  <div className="flex items-center justify-center shrink-0 self-center"
                    style={{
                      width: 22, height: 22, borderRadius: 4,
                      border: `2px solid ${isSelected ? "var(--tc-primary)" : "var(--tc-border-strong)"}`,
                      background: isSelected ? "var(--tc-primary)" : "var(--tc-surface)",
                      color: "#fff",
                    }}>
                    {isSelected && <Check size={14} />}
                  </div>
                )}
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-base font-bold shrink-0" style={{ background: "var(--tc-primary-bg)", color: "var(--tc-primary)" }}>{name[0]}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[15px] font-semibold" style={{ color: "var(--tc-text)" }}>{name}</span>
                    {enrollments.map((e: any) => (
                      <LectureChip key={e.id ?? e.lectureId} lectureName={e.lectureName ?? e.lecture_title ?? ""} color={e.lectureColor ?? e.lecture_color} chipLabel={e.lectureChipLabel ?? e.lecture_chip_label} size={16} />
                    ))}
                  </div>
                  {sub && <div className="text-[12px] mt-0.5" style={{ color: "var(--tc-text-muted)" }}>{sub}</div>}
                  {!selectMode && (
                    <div className="flex gap-3 mt-1 text-[12px]" style={{ color: "var(--tc-text-secondary)" }}>
                      {parentPhone && <a href={`tel:${parentPhone}`} onClick={(e) => e.stopPropagation()} className="no-underline" style={{ color: "var(--tc-text-secondary)" }}>부 {formatPhone(parentPhone)}</a>}
                      {studentPhone && <a href={`tel:${studentPhone}`} onClick={(e) => e.stopPropagation()} className="no-underline" style={{ color: "var(--tc-text-secondary)" }}>학 {formatPhone(studentPhone)}</a>}
                    </div>
                  )}
                </div>
                {!selectMode && <ChevronRight size={16} className="shrink-0 self-center" style={{ color: "var(--tc-text-muted)" }} />}
              </button>
            );
          })}
        </div>
      ) : (
        <EmptyState scope="panel" tone="empty" title={search ? `"${search}" 결과 없음` : "학생이 없습니다"} />
      )}

      {/* Bulk action bar — TabBar 위에 띄우기 (z-index 230, bottom = tabbar 높이 + safe-bottom) */}
      {selectMode && selectedCount > 0 && (
        <div className="fixed left-0 right-0"
          style={{
            bottom: "calc(var(--tc-tabbar-h) + var(--tc-safe-bottom))",
            padding: "12px 16px",
            background: "var(--tc-surface)",
            borderTop: "1px solid var(--tc-border)",
            boxShadow: "0 -4px 12px rgba(0,0,0,0.06)",
            zIndex: 230,
          }}>
          <div className="flex gap-2">
            <BulkBtn icon={<MessageSquare size={14} />} label="문자" onClick={() => setBulkAction("message")} />
            <BulkBtn icon={<Tag size={14} />} label="태그" onClick={() => setBulkAction("tag")} />
            <BulkBtn icon={<Lock size={14} />} label="비번초기화" onClick={() => setBulkAction("password")} />
            <BulkBtn icon={<Trash2 size={14} />} label="삭제" tone="danger"
              onClick={async () => {
                const ok = await confirm({ title: `학생 ${selectedCount}명 삭제`, message: "30일 내 복원이 가능합니다. 삭제하시겠습니까?", confirmText: "삭제", danger: true });
                if (ok) deleteMut.mutate(Array.from(selectedIds));
              }} />
          </div>
        </div>
      )}

      {/* Filter bottom sheet */}
      <BottomSheet open={showFilter} onClose={() => setShowFilter(false)} title="필터">
        <div className="flex flex-col gap-4 p-4">
          <FilterGroup label="학년" options={[{ v: "", l: "전체" }, { v: "1", l: "1학년" }, { v: "2", l: "2학년" }, { v: "3", l: "3학년" }, { v: "4", l: "4학년" }, { v: "5", l: "5학년" }, { v: "6", l: "6학년" }]} value={filters.grade ?? ""} onChange={(v) => setFilters((f) => ({ ...f, grade: v || undefined }))} />
          <FilterGroup label="성별" options={[{ v: "", l: "전체" }, { v: "M", l: "남" }, { v: "F", l: "여" }]} value={filters.gender ?? ""} onChange={(v) => setFilters((f) => ({ ...f, gender: v || undefined }))} />
          <FilterGroup label="상태" options={[{ v: "", l: "전체" }, { v: "active", l: "활성" }, { v: "inactive", l: "비활성" }]} value={filters.status ?? ""} onChange={(v) => setFilters((f) => ({ ...f, status: v || undefined }))} />
          <div className="flex gap-2">
            <button onClick={() => setFilters({})} className="flex-1 text-sm font-semibold py-2.5 rounded-lg cursor-pointer" style={{ background: "var(--tc-surface-soft)", color: "var(--tc-text-secondary)", border: "1px solid var(--tc-border)" }}>
              초기화
            </button>
            <button onClick={() => setShowFilter(false)} className="flex-1 text-sm font-semibold py-2.5 rounded-lg cursor-pointer" style={{ background: "var(--tc-primary)", color: "#fff", border: "none" }}>
              적용
            </button>
          </div>
        </div>
      </BottomSheet>

      {/* Create student sheet */}
      <CreateStudentSheet open={createOpen} onClose={() => setCreateOpen(false)} />

      {/* Bulk action sheets */}
      <BulkMessageSheet open={bulkAction === "message"} onClose={() => setBulkAction(null)}
        students={selectedStudents} onDone={exitSelectMode} />
      <BulkTagSheet open={bulkAction === "tag"} onClose={() => setBulkAction(null)}
        students={selectedStudents} onDone={exitSelectMode} />
      <BulkPasswordSheet open={bulkAction === "password"} onClose={() => setBulkAction(null)}
        students={selectedStudents} onDone={exitSelectMode} />
    </div>
  );
}

/* ─── Bulk Buttons ─── */
function BulkBtn({ icon, label, onClick, tone }: { icon: React.ReactNode; label: string; onClick: () => void; tone?: "danger" }) {
  const color = tone === "danger" ? "var(--tc-danger)" : "var(--tc-primary)";
  const bg = tone === "danger" ? "var(--tc-danger-bg)" : "var(--tc-primary-bg)";
  return (
    <button onClick={onClick}
      className="flex-1 flex flex-col items-center justify-center gap-0.5 cursor-pointer"
      style={{ padding: "8px 6px", borderRadius: "var(--tc-radius)", border: "none", background: bg, color }}>
      {icon}
      <span className="text-[11px] font-bold">{label}</span>
    </button>
  );
}

/* ─── Bulk Message Sheet ─── */
function BulkMessageSheet({ open, onClose, students, onDone }: {
  open: boolean; onClose: () => void; students: any[]; onDone: () => void;
}) {
  const [body, setBody] = useState("");
  const [sendTo, setSendTo] = useState<"student" | "parent">("parent");
  const [mode, setMode] = useState<"sms" | "alimtalk">("sms");

  const sendMut = useMutation({
    mutationFn: () => sendMessage({
      student_ids: students.map((s) => s.id),
      send_to: sendTo,
      message_mode: mode,
      raw_body: body,
    }),
    onSuccess: (res) => {
      teacherToast.success(`${res.queued}건 발송 요청되었습니다.`);
      setBody("");
      onDone();
      onClose();
    },
    onError: () => teacherToast.error("발송에 실패했습니다."),
  });

  return (
    <BottomSheet open={open} onClose={onClose} title={`${students.length}명에게 메시지`}>
      <div className="flex flex-col gap-2.5" style={{ padding: "var(--tc-space-3) 0" }}>
        <div>
          <label className="text-[11px] font-semibold block mb-1" style={{ color: "var(--tc-text-muted)" }}>수신자</label>
          <div className="flex gap-1.5">
            {[["student", "학생"], ["parent", "학부모"]].map(([v, l]) => (
              <button key={v} onClick={() => setSendTo(v as any)} type="button"
                className="flex-1 text-[12px] font-semibold cursor-pointer"
                style={{
                  padding: "8px 10px", borderRadius: "var(--tc-radius-sm)",
                  border: `1px solid ${sendTo === v ? "var(--tc-primary)" : "var(--tc-border-strong)"}`,
                  background: sendTo === v ? "var(--tc-primary-bg)" : "var(--tc-surface-soft)",
                  color: sendTo === v ? "var(--tc-primary)" : "var(--tc-text-secondary)",
                }}>{l}</button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-[11px] font-semibold block mb-1" style={{ color: "var(--tc-text-muted)" }}>채널</label>
          <div className="flex gap-1.5">
            {[["sms", "SMS"], ["alimtalk", "알림톡"]].map(([v, l]) => (
              <button key={v} onClick={() => setMode(v as any)} type="button"
                className="flex-1 text-[12px] font-semibold cursor-pointer"
                style={{
                  padding: "8px 10px", borderRadius: "var(--tc-radius-sm)",
                  border: `1px solid ${mode === v ? "var(--tc-primary)" : "var(--tc-border-strong)"}`,
                  background: mode === v ? "var(--tc-primary-bg)" : "var(--tc-surface-soft)",
                  color: mode === v ? "var(--tc-primary)" : "var(--tc-text-secondary)",
                }}>{l}</button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-[11px] font-semibold block mb-1" style={{ color: "var(--tc-text-muted)" }}>메시지 본문</label>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5}
            placeholder="메시지 내용을 입력하세요"
            className="w-full text-sm"
            style={{ padding: "8px 10px", borderRadius: "var(--tc-radius-sm)", border: "1px solid var(--tc-border-strong)", background: "var(--tc-surface-soft)", color: "var(--tc-text)", outline: "none", resize: "vertical" }} />
          <div className="text-[11px] mt-0.5" style={{ color: "var(--tc-text-muted)" }}>{body.length}자</div>
        </div>
        <button onClick={() => sendMut.mutate()} disabled={!body.trim() || sendMut.isPending}
          className="w-full text-sm font-bold cursor-pointer mt-1"
          style={{ padding: "12px", borderRadius: "var(--tc-radius)", border: "none", background: body.trim() ? "var(--tc-primary)" : "var(--tc-surface-soft)", color: body.trim() ? "#fff" : "var(--tc-text-muted)" }}>
          {sendMut.isPending ? "발송 중…" : `${students.length}명에게 발송`}
        </button>
      </div>
    </BottomSheet>
  );
}

/* ─── Bulk Tag Sheet ─── */
function BulkTagSheet({ open, onClose, students, onDone }: {
  open: boolean; onClose: () => void; students: any[]; onDone: () => void;
}) {
  const qc = useQueryClient();
  const [newTagName, setNewTagName] = useState("");

  const { data: tags } = useQuery({ queryKey: ["all-tags"], queryFn: fetchTags, enabled: open });

  const attachMut = useMutation({
    mutationFn: (tagId: number) => bulkAttachTag(students.map((s) => s.id), tagId),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["students-mobile"] });
      teacherToast.success(`태그 적용 ${res.ok}건${res.fail > 0 ? `, 실패 ${res.fail}건` : ""}`);
      onDone();
      onClose();
    },
    onError: (e) => teacherToast.error(extractApiError(e, "태그 적용에 실패했습니다.")),
  });

  const createMut = useMutation({
    mutationFn: () => createTag(newTagName.trim()),
    onSuccess: (tag: any) => { setNewTagName(""); qc.invalidateQueries({ queryKey: ["all-tags"] }); attachMut.mutate(tag.id); },
    onError: (e) => teacherToast.error(extractApiError(e, "태그를 생성하지 못했습니다.")),
  });

  return (
    <BottomSheet open={open} onClose={onClose} title={`${students.length}명에 태그`}>
      <div className="flex flex-col gap-3" style={{ padding: "var(--tc-space-3) 0" }}>
        <div>
          <label className="text-[11px] font-semibold block mb-1.5" style={{ color: "var(--tc-text-muted)" }}>기존 태그 선택</label>
          {tags && tags.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {tags.map((t: any) => (
                <button key={t.id} onClick={() => attachMut.mutate(t.id)} disabled={attachMut.isPending}
                  className="flex items-center gap-1 text-[12px] font-medium cursor-pointer"
                  style={{ padding: "6px 12px", borderRadius: "var(--tc-radius-full)", border: "1px solid var(--tc-primary)", background: "var(--tc-primary-bg)", color: "var(--tc-primary)" }}>
                  <Plus size={10} /> {t.name}
                </button>
              ))}
            </div>
          ) : (
            <div className="text-[12px]" style={{ color: "var(--tc-text-muted)" }}>등록된 태그가 없습니다.</div>
          )}
        </div>
        <div className="flex gap-2" style={{ borderTop: "1px solid var(--tc-border-subtle)", paddingTop: "var(--tc-space-3)" }}>
          <input type="text" value={newTagName} onChange={(e) => setNewTagName(e.target.value)}
            placeholder="새 태그 이름"
            className="flex-1 text-sm"
            style={{ padding: "8px 10px", borderRadius: "var(--tc-radius-sm)", border: "1px solid var(--tc-border-strong)", background: "var(--tc-surface-soft)", color: "var(--tc-text)", outline: "none" }} />
          <button onClick={() => createMut.mutate()} disabled={!newTagName.trim() || createMut.isPending}
            className="text-xs font-bold cursor-pointer shrink-0"
            style={{ padding: "8px 14px", borderRadius: "var(--tc-radius)", border: "none", background: "var(--tc-primary)", color: "#fff", opacity: !newTagName.trim() ? 0.5 : 1 }}>
            생성 + 적용
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}

/* ─── Bulk Password Reset Sheet ─── */
function BulkPasswordSheet({ open, onClose, students, onDone }: {
  open: boolean; onClose: () => void; students: any[]; onDone: () => void;
}) {
  const [target, setTarget] = useState<"student" | "parent" | "both">("student");
  const [tempPw, setTempPw] = useState("");
  const [notify, setNotify] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!notify && !tempPw.trim()) {
      teacherToast.error("알림톡을 끄려면 임시 비밀번호를 입력해 주세요.");
      return;
    }
    setSubmitting(true);
    const targets: ("student" | "parent")[] = target === "both" ? ["student", "parent"] : [target];
    let ok = 0; let fail = 0;
    try {
      for (const s of students) {
        for (const t of targets) {
          try {
            const params: any = {
              target: t,
              student_name: s.name ?? s.displayName ?? "",
              ...(tempPw.trim() ? { temp_password: tempPw.trim() } : {}),
              ...(!notify ? { skip_notify: true } : {}),
            };
            if (t === "student") {
              if (!s.psNumber && !s.ps_number) { fail++; continue; }
              params.student_ps_number = s.psNumber ?? s.ps_number;
            } else {
              const pp = s.parentPhone ?? s.parent_phone;
              if (!pp) { fail++; continue; }
              params.parent_phone = pp;
            }
            await sendPasswordReset(params);
            ok++;
          } catch { fail++; }
        }
      }
      const notifyMsg = notify ? " 알림톡 발송됩니다." : "";
      teacherToast.success(`비밀번호 변경 ${ok}건${fail > 0 ? `, 실패 ${fail}건` : ""}.${notifyMsg}`);
      onDone(); onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose} title={`${students.length}명 비밀번호 초기화`}>
      <div className="flex flex-col gap-3" style={{ padding: "var(--tc-space-3) 0" }}>
        <div>
          <label className="text-[11px] font-semibold block mb-1.5" style={{ color: "var(--tc-text-muted)" }}>변경 대상</label>
          <div className="flex gap-1.5">
            {([
              { k: "student" as const, l: "학생" },
              { k: "parent" as const, l: "학부모" },
              { k: "both" as const, l: "둘 다" },
            ]).map((opt) => (
              <button key={opt.k} onClick={() => setTarget(opt.k)} type="button"
                className="flex-1 text-[12px] font-semibold cursor-pointer"
                style={{
                  padding: "8px 10px", borderRadius: "var(--tc-radius-sm)",
                  border: `1px solid ${target === opt.k ? "var(--tc-primary)" : "var(--tc-border-strong)"}`,
                  background: target === opt.k ? "var(--tc-primary-bg)" : "var(--tc-surface-soft)",
                  color: target === opt.k ? "var(--tc-primary)" : "var(--tc-text-secondary)",
                }}>{opt.l}</button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-[11px] font-semibold block mb-1" style={{ color: "var(--tc-text-muted)" }}>임시 비밀번호</label>
          <input type="text" value={tempPw} onChange={(e) => setTempPw(e.target.value)} placeholder="비워두면 자동 생성"
            className="w-full text-sm"
            style={{ padding: "8px 10px", borderRadius: "var(--tc-radius-sm)", border: "1px solid var(--tc-border-strong)", background: "var(--tc-surface-soft)", color: "var(--tc-text)", outline: "none" }} />
          <p className="text-[11px] mt-1" style={{ color: "var(--tc-text-muted)" }}>입력하면 모든 대상에 동일 비밀번호가 설정됩니다.</p>
        </div>
        <div className="flex items-center justify-between"
          style={{ padding: "10px 12px", borderRadius: "var(--tc-radius-sm)", border: "1px solid var(--tc-border-subtle)", background: notify ? "var(--tc-primary-bg)" : "var(--tc-surface-soft)" }}>
          <div className="flex items-center gap-2">
            <MessageSquare size={14} style={{ color: notify ? "var(--tc-primary)" : "var(--tc-text-muted)" }} />
            <div>
              <div className="text-[13px] font-semibold" style={{ color: "var(--tc-text)" }}>임시 비밀번호 알림톡</div>
              <div className="text-[11px]" style={{ color: "var(--tc-text-muted)" }}>
                {notify ? "변경된 비밀번호를 알림톡으로 전달합니다" : "알림톡 발송 안 함"}
              </div>
            </div>
          </div>
          <button onClick={() => setNotify(!notify)} type="button" className="cursor-pointer shrink-0"
            style={{ background: "none", border: "none", padding: 0 }}>
            <div className="w-10 h-5 rounded-full relative"
              style={{ background: notify ? "var(--tc-primary)" : "var(--tc-border-strong)", transition: "background 150ms" }}>
              <div className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow"
                style={{ left: notify ? 20 : 2, transition: "left 150ms" }} />
            </div>
          </button>
        </div>
        <button onClick={handleSubmit} disabled={submitting}
          className="w-full text-sm font-bold cursor-pointer mt-1"
          style={{ padding: "12px", borderRadius: "var(--tc-radius)", border: "none", background: "var(--tc-primary)", color: "#fff", opacity: submitting ? 0.6 : 1 }}>
          {submitting ? "변경 중…" : `${students.length}명 비밀번호 변경`}
        </button>
      </div>
    </BottomSheet>
  );
}

function FilterGroup({ label, options, value, onChange }: { label: string; options: { v: string; l: string }[]; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <div className="text-sm font-semibold mb-2" style={{ color: "var(--tc-text)" }}>{label}</div>
      <div className="flex gap-2 flex-wrap">
        {options.map((o) => (
          <button
            key={o.v}
            onClick={() => onChange(o.v)}
            className="text-[13px] font-medium px-3 py-1.5 rounded-full cursor-pointer"
            style={{
              border: value === o.v ? "2px solid var(--tc-primary)" : "1px solid var(--tc-border)",
              background: value === o.v ? "var(--tc-primary-bg)" : "var(--tc-surface)",
              color: value === o.v ? "var(--tc-primary)" : "var(--tc-text-secondary)",
            }}
          >
            {o.l}
          </button>
        ))}
      </div>
    </div>
  );
}
