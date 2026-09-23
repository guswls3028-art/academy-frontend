/* eslint-disable no-restricted-syntax */
// PATH: src/app_teacher/domains/students/pages/StudentListPage.tsx
// 학생 목록 — 강의딱지 + 전화번호 + 검색 + 필터 + 대량 선택 모드
import { useEffect, useState, useDeferredValue, useRef } from "react";
import { useLocation, useNavigate } from "react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { EmptyState , ICON } from "@/shared/ui/ds";
import { formatPhone } from "@/shared/utils/formatPhone";
import StudentNameWithLectureChip from "@/shared/ui/chips/StudentNameWithLectureChip";
import { Search, Filter, ChevronRight, Plus, Download, Upload, Check, X, Trash2, Tag, MessageSquare, Lock } from "@teacher/shared/ui/Icons";
import { Badge } from "@teacher/shared/ui/Badge";
import BottomSheet from "@teacher/shared/ui/BottomSheet";
import KakaoAlimtalkPreview from "@/shared/ui/notifications/KakaoAlimtalkPreview";
import { EmptyActionButton } from "@teacher/shared/ui/EmptyActionButton";
import { teacherToast } from "@teacher/shared/ui/teacherToast";
import { extractApiError } from "@/shared/utils/extractApiError";
import { asyncStatusStore } from "@/shared/ui/asyncStatus";
import {
  fetchStudents, exportStudentsExcel, uploadStudentBulkExcel,
  bulkDeleteStudents, bulkAttachTag, fetchTags, createTag, sendPasswordReset,
} from "../api";
import type { ClientStudent } from "@/shared/api/contracts/students";
import CreateStudentSheet from "../components/CreateStudentSheet";
import { teacherStudentsQueryKeys } from "../queryKeys";
import { fetchAllTemplates, preflightMessage, sendMessage, type MessageSendPreflight } from "@teacher/domains/comms/api";
import { teacherMessageTemplatesQueryKey } from "@/shared/notifications/messageTemplateQueryKey";
import { stripInternalAlimtalkMemoToken } from "@/shared/notifications/teacherMemo";
import { useConfirm } from "@/shared/ui/confirm";
import InitialPasswordMethodSelector from "@/shared/product/students/InitialPasswordMethodSelector";
import {
  DEFAULT_STUDENT_INITIAL_PASSWORD_SETTINGS,
  isStudentInitialPasswordReady,
  type StudentInitialPasswordSettings,
} from "@/shared/product/students/initialPassword";
import {
  parseStudentExcel,
  type ParseStudentExcelResult,
} from "@/shared/product/students/studentExcel";

type FilterState = {
  grade?: string;
  gender?: string;
  status?: string;
};

type BulkAction = "delete" | "message" | "tag" | "password" | null;
type MessageRecipient = "student" | "parent";
type SendTiming = "now" | "scheduled";
type MessageReview = {
  preflight: MessageSendPreflight;
  payload: Parameters<typeof sendMessage>[0];
};
type SelectModeIntent = "bulk" | "message" | "scheduled";
type StudentListLocationState = {
  startSelectMode?: boolean;
  preferredMessageTiming?: SendTiming;
} | null;

const MESSAGE_RECIPIENT_OPTIONS: { value: MessageRecipient; label: string }[] = [
  { value: "student", label: "학생" },
  { value: "parent", label: "학부모" },
];

const ALIMTALK_TYPE_OPTIONS = [
  { value: "attendance", label: "출결·수업·시험·과제" },
  { value: "clinic", label: "클리닉 안내" },
] as const;

function defaultScheduledLocalValue(): string {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function StudentListPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [search, setSearch] = useState("");
  const [showFilter, setShowFilter] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [excelImportFile, setExcelImportFile] = useState<File | null>(null);
  const [filters, setFilters] = useState<FilterState>({});
  const deferredSearch = useDeferredValue(search);

  // Selection mode
  const [selectMode, setSelectMode] = useState(false);
  const [selectModeIntent, setSelectModeIntent] = useState<SelectModeIntent>("bulk");
  const [preferredMessageTiming, setPreferredMessageTiming] = useState<SendTiming>("now");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkAction, setBulkAction] = useState<BulkAction>(null);

  const hasFilter = Object.values(filters).some(Boolean);

  useEffect(() => {
    const state = location.state as StudentListLocationState;
    if (!state?.startSelectMode) return;
    const timing = state.preferredMessageTiming === "scheduled" ? "scheduled" : "now";
    setSelectMode(true);
    setSelectModeIntent(timing === "scheduled" ? "scheduled" : "message");
    setPreferredMessageTiming(timing);
    navigate(location.pathname, { replace: true, state: {} });
  }, [location.pathname, location.state, navigate]);

  const { data, isLoading } = useQuery({
    queryKey: teacherStudentsQueryKeys.studentList(deferredSearch, filters),
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
  const selectedStudents = students.filter((s) => selectedIds.has(s.id));

  const toggleSelect = (id: number) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };
  const selectAll = () => setSelectedIds(new Set(students.map((s) => s.id)));
  const clearSelection = () => setSelectedIds(new Set());
  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectModeIntent("bulk");
    setPreferredMessageTiming("now");
    clearSelection();
  };

  const deleteMut = useMutation({
    mutationFn: (ids: number[]) => bulkDeleteStudents(ids),
    onSuccess: (_, ids) => {
      qc.invalidateQueries({ queryKey: teacherStudentsQueryKeys.students });
      teacherToast.success(`${ids.length}명을 삭제했습니다. (30일 이내 복구 가능)`);
      exitSelectMode();
    },
    onError: () => teacherToast.error("삭제에 실패했습니다."),
  });

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      {!selectMode ? (
        <div className="flex items-center justify-between gap-2">
          <div className="text-[17px] font-bold" style={{ color: "var(--tc-text)" }}>학생 관리</div>
          <div className="flex gap-1.5 items-center shrink-0">
            <button onClick={() => {
              setSelectModeIntent("bulk");
              setPreferredMessageTiming("now");
              setSelectMode(true);
            }}
              className="flex items-center gap-1 text-[12px] font-semibold cursor-pointer"
              style={{ padding: "8px 12px", minHeight: "var(--tc-touch-min)", borderRadius: "var(--tc-radius-sm)", border: "1px solid var(--tc-border)", background: "var(--tc-surface)", color: "var(--tc-text-secondary)" }}>
              선택
            </button>
            <button onClick={() => setMoreOpen((v) => !v)}
              aria-label="더보기"
              className="flex items-center justify-center cursor-pointer relative"
              style={{ width: 36, minHeight: "var(--tc-touch-min)", borderRadius: "var(--tc-radius-sm)", border: "1px solid var(--tc-border)", background: "var(--tc-surface)", color: "var(--tc-text-secondary)" }}>
              ⋯
            </button>
            <button onClick={() => setCreateOpen(true)}
              className="flex items-center gap-1 text-xs font-bold cursor-pointer"
              style={{ padding: "8px 14px", minHeight: "var(--tc-touch-min)", borderRadius: "var(--tc-radius)", border: "none", background: "var(--tc-primary)", color: "#fff" }}>
              <Plus size={ICON.xs} /> 추가
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2"
          style={{ padding: "8px 10px", borderRadius: "var(--tc-radius)", background: "var(--tc-primary-bg)", border: "1px solid var(--tc-primary)" }}>
          <button onClick={exitSelectMode} aria-label="선택 취소" className="flex items-center justify-center cursor-pointer"
            style={{ width: 44, minHeight: "var(--tc-touch-min)", borderRadius: "var(--tc-radius-sm)", background: "none", border: "none", color: "var(--tc-primary)" }}>
            <X size={ICON.sm} />
          </button>
          <div className="flex-1 text-[13px] font-bold" style={{ color: "var(--tc-primary)" }}>
            {selectModeIntent === "scheduled"
              ? `예약할 학생 ${selectedCount}명`
              : selectModeIntent === "message"
                ? `알림톡 보낼 학생 ${selectedCount}명`
                : `${selectedCount}명 선택됨`}
          </div>
          <button onClick={selectAll} className="text-[11px] font-semibold cursor-pointer"
            style={{ minHeight: 36, padding: "6px 10px", borderRadius: "var(--tc-radius-sm)", border: "1px solid var(--tc-primary)", background: "var(--tc-surface)", color: "var(--tc-primary)" }}>
            전체 선택
          </button>
          {selectedCount > 0 && (
            <button onClick={clearSelection} className="text-[11px] font-semibold cursor-pointer"
              style={{ minHeight: 36, padding: "6px 10px", borderRadius: "var(--tc-radius-sm)", border: "1px solid var(--tc-border-strong)", background: "var(--tc-surface)", color: "var(--tc-text-secondary)" }}>
              해제
            </button>
          )}
        </div>
      )}

      {/* More menu — 엑셀 내보내기 / 가져오기 */}
      {!selectMode && moreOpen && (
        <div className="flex flex-col gap-1.5 rounded-xl"
          style={{ background: "var(--tc-surface)", border: "1px solid var(--tc-border)", padding: "var(--tc-space-2)" }}>
          <button onClick={() => {
              setMoreOpen(false);
              exportStudentsExcel().catch(() => teacherToast.error("내보내기에 실패했습니다."));
            }}
            className="flex items-center gap-2 text-sm cursor-pointer"
            style={{ padding: "10px 12px", minHeight: "var(--tc-touch-min)", borderRadius: "var(--tc-radius-sm)", border: "none", background: "none", color: "var(--tc-text)", textAlign: "left" }}>
            <Download size={ICON.xs} /> 엑셀 내보내기
          </button>
          <label className="flex items-center gap-2 text-sm cursor-pointer"
            style={{ padding: "10px 12px", minHeight: "var(--tc-touch-min)", borderRadius: "var(--tc-radius-sm)", border: "none", background: "none", color: "var(--tc-text)" }}>
            <Upload size={ICON.xs} /> 엑셀 가져오기
            <input type="file" accept=".xlsx" style={{ display: "none" }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                setMoreOpen(false);
                if (f) {
                  setExcelImportFile(f);
                }
                e.target.value = "";
              }} />
          </label>
        </div>
      )}

      {/* Search + Filter (hidden in select mode) */}
      {!selectMode && (
        <>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={ICON.sm} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--tc-text-muted)" }} />
              <input type="text" placeholder="이름, 아이디, 전화번호, 학교" value={search} onChange={(e) => setSearch(e.target.value)}
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
              <Filter size={ICON.md} />
            </button>
          </div>

          {hasFilter && (
            <div className="flex gap-1.5 flex-wrap">
              {filters.grade && <Badge tone="primary" pill>{filters.grade}학년</Badge>}
              {filters.gender && <Badge tone="primary" pill>{filters.gender === "M" ? "남" : "여"}</Badge>}
              {filters.status && <Badge tone="primary" pill>{filters.status === "active" ? "관리 중" : "관리 제외"}</Badge>}
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
        <div className="grid grid-cols-1 gap-1.5 lg:grid-cols-2 lg:gap-3" style={{ paddingBottom: selectMode ? 80 : 0 }}>
          {students.map((s) => {
            const name = s.name ?? s.displayName ?? "이름 없음";
            const enrollments = s.enrollments ?? [];
            const parentPhone = s.parentPhone;
            const studentPhone = s.studentPhone;
            const sub = [s.grade != null ? `${s.grade}학년` : null, s.school].filter(Boolean).join(" · ");
            const isSelected = selectedIds.has(s.id);

            return (
              <button
                key={s.id}
                onClick={() => selectMode ? toggleSelect(s.id) : navigate(`/workspace/mobile/students/${s.id}`)}
                className="flex gap-3 rounded-xl w-full text-left cursor-pointer"
                style={{
                  padding: "var(--tc-space-3) var(--tc-space-4)",
                  background: isSelected ? "var(--tc-primary-bg)" : "var(--tc-surface)",
                  border: `${isSelected ? "2px" : "1px"} solid ${isSelected ? "var(--tc-primary)" : "var(--tc-border)"}`,
                }}>
                {selectMode && (
                  <div className="flex items-center justify-center shrink-0 self-center"
                    style={{
                      width: 32, height: 32, borderRadius: 8,
                      border: `2px solid ${isSelected ? "var(--tc-primary)" : "var(--tc-border-strong)"}`,
                      background: isSelected ? "var(--tc-primary)" : "var(--tc-surface)",
                      color: "#fff",
                    }}>
                    {isSelected && <Check size={ICON.xs} />}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <StudentNameWithLectureChip
                    name={name}
                    profilePhotoUrl={s.profilePhotoUrl}
                    avatarSize={40}
                    chipSize={20}
                    className="text-sm"
                    lectures={enrollments.map((e) => ({
                      lectureName: e.lectureName,
                      color: e.lectureColor,
                      chipLabel: e.lectureChipLabel,
                    }))}
                  />
                  {sub && <div className="text-[12px] mt-0.5" style={{ color: "var(--tc-text-muted)" }}>{sub}</div>}
                  {!selectMode && (
                    <div className="flex gap-3 mt-1 text-[12px]" style={{ color: "var(--tc-text-secondary)" }}>
                      {parentPhone && <a href={`tel:${parentPhone}`} onClick={(e) => e.stopPropagation()} className="no-underline" style={{ color: "var(--tc-text-secondary)" }}>부 {formatPhone(parentPhone)}</a>}
                      {studentPhone && <a href={`tel:${studentPhone}`} onClick={(e) => e.stopPropagation()} className="no-underline" style={{ color: "var(--tc-text-secondary)" }}>학 {formatPhone(studentPhone)}</a>}
                    </div>
                  )}
                </div>
                {!selectMode && <ChevronRight size={ICON.sm} className="shrink-0 self-center" style={{ color: "var(--tc-text-muted)" }} />}
              </button>
            );
          })}
        </div>
      ) : (
        <EmptyState
          scope="panel"
          tone="empty"
          title={search ? `"${search}" 결과 없음` : "학생이 없습니다"}
          description={search ? "검색어를 줄이거나 필터를 초기화해 보세요." : "첫 학생을 등록하면 상담과 수강 이력을 한 화면에서 관리할 수 있습니다."}
          actions={
            search || hasFilter ? (
              <EmptyActionButton variant="secondary" onClick={() => { setSearch(""); setFilters({}); }}>
                검색 초기화
              </EmptyActionButton>
            ) : (
              <EmptyActionButton onClick={() => setCreateOpen(true)}>
                학생 등록
              </EmptyActionButton>
            )
          }
        />
      )}

      {/* Bulk action bar — TabBar 위에 띄우기 (z-index 230, bottom = tabbar 높이 + safe-bottom) */}
      {selectMode && selectedCount > 0 && (
        <div className="fixed left-0 right-0 lg:left-[var(--tc-sidebar-w)]"
          style={{
            bottom: "calc(var(--tc-tabbar-h) + var(--tc-safe-bottom))",
            padding: "12px 16px",
            background: "var(--tc-surface)",
            borderTop: "1px solid var(--tc-border)",
            boxShadow: "0 -4px 12px rgba(0,0,0,0.06)",
            zIndex: 230,
          }}>
          <div className="flex gap-2">
            <BulkBtn
              icon={<MessageSquare size={ICON.xs} />}
              label={preferredMessageTiming === "scheduled" ? "예약" : "알림톡"}
              onClick={() => setBulkAction("message")}
            />
            <BulkBtn icon={<Tag size={ICON.xs} />} label="태그" onClick={() => setBulkAction("tag")} />
            <BulkBtn icon={<Lock size={ICON.xs} />} label="비번초기화" onClick={() => setBulkAction("password")} />
            <BulkBtn icon={<Trash2 size={ICON.xs} />} label="삭제" tone="danger"
              onClick={async () => {
                const ok = await confirm({ title: `학생 ${selectedCount}명 삭제`, message: "30일 동안 계정 로그인을 정지합니다. 수강·학습 데이터와 삭제 전 수강 상태는 보존됩니다.", confirmText: "삭제", danger: true });
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
          <FilterGroup label="관리 대상" options={[{ v: "", l: "전체" }, { v: "active", l: "관리 중" }, { v: "inactive", l: "관리 제외" }]} value={filters.status ?? ""} onChange={(v) => setFilters((f) => ({ ...f, status: v || undefined }))} />
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

      <ExcelImportSheet
        open={!!excelImportFile}
        file={excelImportFile}
        onClose={() => setExcelImportFile(null)}
        onDone={async (jobId, expectsCredentialDownload) => {
          asyncStatusStore.addWorkerJob(
            "학생 일괄 등록",
            jobId,
            "excel_parsing",
            undefined,
            { expectsCredentialDownload },
          );
          await qc.invalidateQueries({ queryKey: teacherStudentsQueryKeys.students });
        }}
      />

      {/* Create student sheet */}
      <CreateStudentSheet open={createOpen} onClose={() => setCreateOpen(false)} />

      {/* Bulk action sheets */}
      <BulkMessageSheet open={bulkAction === "message"} onClose={() => setBulkAction(null)}
        students={selectedStudents} initialSendTiming={preferredMessageTiming} onDone={exitSelectMode} />
      <BulkTagSheet open={bulkAction === "tag"} onClose={() => setBulkAction(null)}
        students={selectedStudents} onDone={exitSelectMode} />
      <BulkPasswordSheet open={bulkAction === "password"} onClose={() => setBulkAction(null)}
        students={selectedStudents} onDone={exitSelectMode} />
    </div>
  );
}

function ExcelImportSheet({ open, file, onClose, onDone }: {
  open: boolean;
  file: File | null;
  onClose: () => void;
  onDone: (jobId: string, expectsCredentialDownload: boolean) => Promise<void>;
}) {
  const [passwordSettings, setPasswordSettings] = useState<StudentInitialPasswordSettings>(
    () => ({ ...DEFAULT_STUDENT_INITIAL_PASSWORD_SETTINGS }),
  );
  const [parsed, setParsed] = useState<ParseStudentExcelResult | null>(null);
  const [parseError, setParseError] = useState("");
  const [parsing, setParsing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !file) return;
    let cancelled = false;
    setPasswordSettings({ ...DEFAULT_STUDENT_INITIAL_PASSWORD_SETTINGS });
    setParsed(null);
    setParseError("");
    setParsing(true);
    void parseStudentExcel(file)
      .then((result) => {
        if (cancelled) return;
        if (!result.rows.length) {
          setParseError("등록할 학생 데이터가 없습니다.");
          return;
        }
        setParsed(result);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setParseError(error instanceof Error ? error.message : "엑셀 파일을 읽지 못했습니다.");
        }
      })
      .finally(() => {
        if (!cancelled) setParsing(false);
      });
    return () => {
      cancelled = true;
    };
  }, [file, open]);

  if (!file) return null;

  const handleClose = () => {
    if (submitting) return;
    onClose();
  };

  const handleSubmit = async () => {
    if (!parsed) {
      teacherToast.error(parseError || "엑셀 파일을 확인하고 있습니다.");
      return;
    }
    if (!isStudentInitialPasswordReady(passwordSettings)) {
      teacherToast.error(
        passwordSettings.mode === "fixed"
          ? "공통 초기 비밀번호를 4자 이상 입력해 주세요."
          : "초기 비밀번호 방식을 확인해 주세요.",
      );
      return;
    }
    setSubmitting(true);
    try {
      const { job_id } = await uploadStudentBulkExcel(file, passwordSettings);
      if (!job_id) {
        teacherToast.error("작업 ID를 받지 못했습니다. 다시 시도해 주세요.");
        return;
      }
      await onDone(job_id, passwordSettings.mode === "random");
      teacherToast.success("백그라운드에서 진행됩니다. 완료까지 몇 분 걸릴 수 있으며 작업박스에서 확인할 수 있습니다.");
      onClose();
    } catch (err) {
      teacherToast.error(extractApiError(err, "학생 일괄 업로드에 실패했습니다."));
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit =
    parsed != null
    && !parsing
    && !submitting
    && isStudentInitialPasswordReady(passwordSettings);

  return (
    <BottomSheet open={open} onClose={handleClose} title="엑셀 가져오기">
      <div className="flex flex-col gap-3" style={{ padding: "var(--tc-space-3) 0" }}>
        <div
          className="flex items-center gap-2"
          style={{
            padding: "10px 12px",
            borderRadius: "var(--tc-radius)",
            border: "1px solid var(--tc-border)",
            background: "var(--tc-surface-soft)",
          }}>
          <Upload size={ICON.xs} style={{ color: "var(--tc-primary)" }} />
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-semibold truncate" style={{ color: "var(--tc-text)" }}>
              {file.name}
            </div>
            <div className="text-[11px]" style={{ color: "var(--tc-text-muted)" }}>
              {Math.max(1, Math.round(file.size / 1024)).toLocaleString()}KB
            </div>
          </div>
        </div>

        <InitialPasswordMethodSelector
          value={passwordSettings}
          onChange={setPasswordSettings}
          disabled={submitting || parsing}
        />

        {parsing ? (
          <div className="text-[11px] leading-5" style={{ color: "var(--tc-text-muted)" }}>
            학생 정보를 확인하고 있습니다…
          </div>
        ) : null}
        {parseError ? (
          <div className="text-[11px] leading-5" style={{ color: "var(--tc-danger)" }} role="alert">
            {parseError}
          </div>
        ) : null}

        <div className="text-[11px] leading-5" style={{ color: "var(--tc-text-muted)" }}>
          오류가 있는 행은 제외하고 정상 행만 등록합니다. 작업박스에서 실패 행과 사유를 확인할 수 있습니다.
        </div>

        <div className="flex items-center justify-between"
          style={{
            padding: "10px 12px",
            borderRadius: "var(--tc-radius-sm)",
            border: "1px solid var(--tc-border-subtle)",
            background: "var(--tc-primary-bg)",
          }}>
          <div className="flex items-center gap-2">
            <MessageSquare size={ICON.xs} style={{ color: "var(--tc-primary)" }} />
            <div>
              <div className="text-[13px] font-semibold" style={{ color: "var(--tc-text)" }}>첫 수강 확정 시 계정 안내 발송</div>
              <div className="text-[11px]" style={{ color: "var(--tc-text-muted)" }}>
                학생 명부 등록만으로는 발송되지 않으며, 실제 강의의 수강생으로 처음 확정될 때 학생·학부모에게 알림톡이 발송됩니다.
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="w-full text-sm font-bold cursor-pointer"
          style={{
            padding: "12px",
            borderRadius: "var(--tc-radius)",
            border: "none",
            background: canSubmit ? "var(--tc-primary)" : "var(--tc-surface-soft)",
            color: canSubmit ? "#fff" : "var(--tc-text-muted)",
          }}>
          {submitting ? "업로드 중..." : "업로드 시작"}
        </button>
      </div>
    </BottomSheet>
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
function BulkMessageSheet({ open, onClose, students, initialSendTiming, onDone }: {
  open: boolean; onClose: () => void; students: ClientStudent[]; initialSendTiming: SendTiming; onDone: () => void;
}) {
  const navigate = useNavigate();
  const [body, setBody] = useState("");
  const [sendTo, setSendTo] = useState<MessageRecipient>("parent");
  const [alimtalkType, setAlimtalkType] = useState<(typeof ALIMTALK_TYPE_OPTIONS)[number]["value"]>("attendance");
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [sendTiming, setSendTiming] = useState<SendTiming>("now");
  const [scheduledAt, setScheduledAt] = useState(defaultScheduledLocalValue);
  const [preflight, setPreflight] = useState<MessageSendPreflight | null>(null);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [review, setReview] = useState<MessageReview | null>(null);
  const [previewStudentId, setPreviewStudentId] = useState<number | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const requestIdRef = useRef(0);
  const sendRequestRef = useRef(false);
  const { data: templates = [], isLoading: templatesLoading, isError: templatesError, refetch: refetchTemplates } = useQuery({
    queryKey: teacherMessageTemplatesQueryKey,
    queryFn: fetchAllTemplates,
    enabled: open,
  });
  const savedTemplates = templates.filter((template) =>
    !template.is_system
    && template.category !== "grades"
    && template.alimtalk_envelope_type !== "score"
    && template.alimtalk_envelope_type !== "clinic_change");
  const hasPersonalizedOnlyTemplates = templates.some((template) =>
    !template.is_system && (template.category === "grades" || template.alimtalk_envelope_type === "score" || template.alimtalk_envelope_type === "clinic_change"));
  const tooManyRecipients = students.length > 200;
  const recipientLabel = sendTo === "parent" ? "학부모" : "학생";
  const scheduledDate = sendTiming === "scheduled" && scheduledAt ? new Date(scheduledAt) : null;
  const scheduleError = (() => {
    if (sendTiming !== "scheduled") return null;
    if (!scheduledAt) return "예약 시각을 선택해 주세요";
    if (!scheduledDate || Number.isNaN(scheduledDate.getTime())) return "예약 시각을 확인해 주세요";
    if (scheduledDate.getTime() <= Date.now()) return "현재 이후 시각으로 예약해 주세요";
    return null;
  })();
  const scheduledSendAtIso = sendTiming === "scheduled" && !scheduleError && scheduledDate
    ? scheduledDate.toISOString()
    : null;
  const scheduleLabel = scheduledDate && !Number.isNaN(scheduledDate.getTime())
    ? scheduledDate.toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
    : "예약 시각";
  const draftKey = JSON.stringify({ studentIds: students.map((student) => student.id), sendTo, alimtalkType, body, scheduledSendAtIso });
  const draftKeyRef = useRef(draftKey);
  draftKeyRef.current = draftKey;
  const previewRecipients = review?.preflight.preview_recipients.filter((recipient) => !recipient.excluded) ?? [];
  const previewRecipient = previewRecipients.find((recipient) => recipient.student_id === previewStudentId)
    ?? previewRecipients[0] ?? null;

  useEffect(() => {
    setPreflight(null);
    setCheckError(null);
  }, [draftKey]);

  useEffect(() => {
    if (!open) return;
    setSendTiming(initialSendTiming);
    setScheduledAt(defaultScheduledLocalValue());
    setPreflight(null);
    setCheckError(null);
    setReview(null);
    setSendError(null);
  }, [initialSendTiming, open]);

  const sendMut = useMutation({
    mutationFn: sendMessage,
    onSuccess: (res) => {
      sendRequestRef.current = false;
      const accepted = (res.enqueued ?? 0) + (res.scheduled ?? 0);
      teacherToast.success(sendTiming === "scheduled"
        ? `${res.scheduled ?? accepted}건 예약되었습니다.`
        : `${accepted}건 발송 요청이 접수되었습니다.`);
      setBody("");
      setSelectedTemplateId(null);
      setReview(null);
      onDone();
      onClose();
    },
    onError: (error) => {
      sendRequestRef.current = false;
      setSendError(extractApiError(error, "발송 결과를 확인하지 못했습니다."));
      teacherToast.error("발송 결과를 확인하지 못했습니다. 발송 내역에서 상태를 확인해 주세요.");
    },
  });

  const closeSheet = () => {
    if (sendMut.isPending) return;
    requestIdRef.current += 1;
    setReview(null);
    setChecking(false);
    onClose();
  };

  const requestSend = async () => {
    if (!body.trim() || sendMut.isPending || checking || tooManyRecipients || scheduleError) return;
    const payload: Parameters<typeof sendMessage>[0] = {
      student_ids: students.map((student) => student.id),
      send_to: sendTo,
      message_mode: "alimtalk",
      raw_body: body,
      block_category: alimtalkType,
      scheduled_send_at: scheduledSendAtIso,
    };
    const requestId = ++requestIdRef.current;
    const requestKey = draftKey;
    setCheckError(null);
    setPreflight(null);
    setChecking(true);
    let checked: MessageSendPreflight;
    try {
      checked = await preflightMessage(payload);
    } catch (error) {
      if (requestId === requestIdRef.current && requestKey === draftKeyRef.current) {
        setCheckError(extractApiError(error, "발송 준비 상태를 확인하지 못했습니다."));
      }
      return;
    } finally {
      if (requestId === requestIdRef.current) setChecking(false);
    }
    if (requestId !== requestIdRef.current || requestKey !== draftKeyRef.current) return;
    setPreflight(checked);
    if (!checked.can_send) {
      const blocker = checked.blockers[0];
      setCheckError(blocker ? `${blocker.title}: ${blocker.detail}` : "현재 알림톡을 발송할 수 없습니다.");
      return;
    }
    if (!Array.isArray(checked.preview_recipients)
      || checked.preview_recipients.length !== checked.recipient.resolved
      || !checked.preview_recipients.some((recipient) => !recipient.excluded && recipient.full_message_body.trim())
      || checked.preview_recipients.some((recipient) => !recipient.excluded && !recipient.full_message_body.trim())) {
      setCheckError("수신자별 실제 발송 문구를 확인하지 못했습니다. 다시 확인해 주세요.");
      return;
    }
    setPreviewStudentId(checked.preview_recipients.find((recipient) => !recipient.excluded)?.student_id ?? null);
    setSendError(null);
    setReview({ preflight: checked, payload });
  };

  return (
    <BottomSheet open={open} onClose={closeSheet} title={review ? "보내기 전 마지막 확인" : `${students.length}명에게 알림톡`}>
      {review ? (
        <div className="flex flex-col gap-3" style={{ padding: "var(--tc-space-3) 0" }}>
          <p className="text-xs" style={{ color: "var(--tc-text-secondary)" }}>
            {recipientLabel} {review.preflight.recipient.valid_phone}건 · {sendTiming === "scheduled" ? `${scheduleLabel} 예약` : "지금 발송"}
          </p>
          {(review.preflight.recipient.skipped_no_phone + review.preflight.recipient.invalid_or_deleted > 0) && (
            <p className="text-xs" style={{ color: "var(--tc-warning, #9a6700)" }}>
              연락처 없음·대상 변경 {review.preflight.recipient.skipped_no_phone + review.preflight.recipient.invalid_or_deleted}건 제외
            </p>
          )}
          {review.preflight.recipient.duplicate_phone > 0 && (
            <p className="text-xs" style={{ color: "var(--tc-text-secondary)" }}>
              동일 번호 {review.preflight.recipient.duplicate_phone}건도 학생별 안내로 각각 포함됩니다.
            </p>
          )}
          {previewRecipients.length > 1 && (
            <div>
              <label htmlFor="bulk-message-preview-student" className="text-xs font-semibold block mb-1">문구를 확인할 학생</label>
              <select id="bulk-message-preview-student" value={previewRecipient?.student_id ?? ""}
                onChange={(event) => setPreviewStudentId(Number(event.target.value))}
                className="w-full text-sm" style={{ padding: "10px", borderRadius: "var(--tc-radius-sm)", border: "1px solid var(--tc-border-strong)" }}>
                {previewRecipients.map((recipient) => (
                  <option key={recipient.student_id} value={recipient.student_id}>{recipient.student_name} · {recipient.phone}</option>
                ))}
              </select>
            </div>
          )}
          {previewRecipient && (
            <>
              <p className="text-xs font-semibold">{previewRecipient.student_name}에게 들어갈 전체 문구</p>
              <KakaoAlimtalkPreview>{previewRecipient.full_message_body}</KakaoAlimtalkPreview>
            </>
          )}
          <p className="text-[11px]" style={{ color: "var(--tc-text-muted)" }}>
            현재 수신자 정보로 서버가 조립한 문구입니다. 카카오톡 화면 배치는 기기에 따라 다를 수 있습니다.
          </p>
          {sendError && <p role="alert" className="text-xs" style={{ color: "var(--tc-danger)" }}>
            {sendError} 발송 내역에서 접수 여부를 확인한 뒤 다시 시도해 주세요.
          </p>}
          {sendError && <button type="button" onClick={() => { closeSheet(); navigate("/workspace/mobile/message-log"); }}
            className="text-xs font-semibold underline self-start" style={{ color: "var(--tc-primary)" }}>발송 내역 보기</button>}
          <div className="flex gap-2">
            <button type="button" onClick={() => setReview(null)} disabled={sendMut.isPending}
              className="flex-1 text-sm font-semibold" style={{ padding: "12px", borderRadius: "var(--tc-radius)", border: "1px solid var(--tc-border-strong)" }}>문구 수정</button>
            <button type="button" onClick={() => {
              if (sendRequestRef.current || sendError) return;
              sendRequestRef.current = true;
              sendMut.mutate(review.payload);
            }} disabled={sendMut.isPending || !!sendError}
              className="flex-1 text-sm font-bold" style={{ padding: "12px", borderRadius: "var(--tc-radius)", border: "none", background: "var(--tc-primary)", color: "#fff" }}>
              {sendMut.isPending ? "접수 중…" : sendTiming === "scheduled" ? "예약 확정" : "발송하기"}
            </button>
          </div>
        </div>
      ) : (
      <div className="flex flex-col gap-2.5" style={{ padding: "var(--tc-space-3) 0" }}>
        <p className="text-xs" style={{ color: "var(--tc-text-secondary)" }}>
          1. 문구 작성 → 2. 학생별 실제 문구 확인 → 3. 발송 확정
        </p>
        <div>
          <span id="bulk-message-recipient-label" className="text-[11px] font-semibold block mb-1" style={{ color: "var(--tc-text-muted)" }}>수신자</span>
          <div className="flex gap-1.5" role="group" aria-labelledby="bulk-message-recipient-label">
            {MESSAGE_RECIPIENT_OPTIONS.map(({ value, label }) => (
              <button key={value} onClick={() => setSendTo(value)} type="button"
                aria-pressed={sendTo === value}
                className="flex-1 text-[12px] font-semibold cursor-pointer"
                style={{
                  padding: "8px 10px", borderRadius: "var(--tc-radius-sm)",
                  border: `1px solid ${sendTo === value ? "var(--tc-primary)" : "var(--tc-border-strong)"}`,
                  background: sendTo === value ? "var(--tc-primary-bg)" : "var(--tc-surface-soft)",
                  color: sendTo === value ? "var(--tc-primary)" : "var(--tc-text-secondary)",
                }}>{label}</button>
            ))}
          </div>
        </div>
        <div>
          <label htmlFor="bulk-message-template" className="text-[11px] font-semibold block mb-1" style={{ color: "var(--tc-text-muted)" }}>저장한 문구 불러오기</label>
          <select id="bulk-message-template" value={selectedTemplateId ?? ""}
            onChange={(event) => {
              const template = savedTemplates.find((item) => item.id === Number(event.target.value));
              setSelectedTemplateId(template?.id ?? null);
              if (template) {
                setBody(stripInternalAlimtalkMemoToken(template.body));
                setAlimtalkType(template.alimtalk_envelope_type === "clinic_info" || template.category === "clinic"
                  ? "clinic" : "attendance");
              }
              setPreflight(null);
              setCheckError(null);
            }}
            className="w-full text-sm"
            style={{ padding: "9px 10px", borderRadius: "var(--tc-radius-sm)", border: "1px solid var(--tc-border-strong)", background: "var(--tc-surface-soft)", color: "var(--tc-text)" }}>
            <option value="">직접 작성 또는 현재 문구 유지</option>
            {savedTemplates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
          </select>
          {templatesLoading ? <p className="text-[11px] mt-1">저장한 문구를 불러오는 중…</p>
            : templatesError ? <p role="alert" className="text-[11px] mt-1">저장한 문구를 불러오지 못했습니다. <button type="button" onClick={() => void refetchTemplates()} className="underline">다시 시도</button></p>
              : savedTemplates.length === 0 ? <p className="text-[11px] mt-1">저장한 문구가 없습니다. 아래에서 직접 작성할 수 있습니다.</p> : null}
          {hasPersonalizedOnlyTemplates && <p className="text-[11px] mt-1" style={{ color: "var(--tc-text-muted)" }}>
            성적·일정 변경용 문구는 학생별 정보가 필요한 전용 발송 화면에서 사용합니다.
          </p>}
          <button type="button" onClick={() => { closeSheet(); navigate("/workspace/mobile/message-templates"); }}
            className="text-xs font-semibold underline mt-1" style={{ color: "var(--tc-primary)" }}>저장 문구 만들기·수정하기</button>
        </div>
        <div>
          <span id="bulk-message-type-label" className="text-[11px] font-semibold block mb-1" style={{ color: "var(--tc-text-muted)" }}>알림톡 유형</span>
          <div className="grid grid-cols-1 gap-1.5" role="group" aria-labelledby="bulk-message-type-label">
            {ALIMTALK_TYPE_OPTIONS.map(({ value, label }) => (
              <button key={value} onClick={() => { setAlimtalkType(value); setPreflight(null); }} type="button"
                aria-pressed={alimtalkType === value}
                className="text-left text-[12px] font-semibold cursor-pointer"
                style={{
                  padding: "8px 10px", borderRadius: "var(--tc-radius-sm)",
                  border: `1px solid ${alimtalkType === value ? "var(--tc-primary)" : "var(--tc-border-strong)"}`,
                  background: alimtalkType === value ? "var(--tc-primary-bg)" : "var(--tc-surface-soft)",
                  color: alimtalkType === value ? "var(--tc-primary)" : "var(--tc-text-secondary)",
                }}>{label}</button>
            ))}
          </div>
          <p className="text-[11px] mt-1" style={{ color: "var(--tc-text-muted)" }}>
            안내문은 자유롭게 수정할 수 있습니다. 선택한 종류의 승인된 카카오 알림톡에 담아 보냅니다.
          </p>
        </div>
        <div>
          <span id="bulk-message-timing-label" className="text-[11px] font-semibold block mb-1" style={{ color: "var(--tc-text-muted)" }}>발송 시점</span>
          <div className="flex gap-1.5" role="group" aria-labelledby="bulk-message-timing-label">
            <button type="button" onClick={() => setSendTiming("now")}
              aria-pressed={sendTiming === "now"}
              className="flex-1 text-[12px] font-semibold cursor-pointer"
              style={{
                padding: "8px 10px", borderRadius: "var(--tc-radius-sm)",
                border: `1px solid ${sendTiming === "now" ? "var(--tc-primary)" : "var(--tc-border-strong)"}`,
                background: sendTiming === "now" ? "var(--tc-primary-bg)" : "var(--tc-surface-soft)",
                color: sendTiming === "now" ? "var(--tc-primary)" : "var(--tc-text-secondary)",
              }}>지금</button>
            <button type="button" onClick={() => setSendTiming("scheduled")}
              aria-pressed={sendTiming === "scheduled"}
              className="flex-1 text-[12px] font-semibold cursor-pointer"
              style={{
                padding: "8px 10px", borderRadius: "var(--tc-radius-sm)",
                border: `1px solid ${sendTiming === "scheduled" ? "var(--tc-primary)" : "var(--tc-border-strong)"}`,
                background: sendTiming === "scheduled" ? "var(--tc-primary-bg)" : "var(--tc-surface-soft)",
                color: sendTiming === "scheduled" ? "var(--tc-primary)" : "var(--tc-text-secondary)",
              }}>예약</button>
          </div>
          {sendTiming === "scheduled" && (
            <div className="mt-2">
              <input
                id="bulk-message-scheduled-at"
                aria-label="예약 발송 시각"
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="w-full text-sm"
                style={{
                  padding: "8px 10px",
                  borderRadius: "var(--tc-radius-sm)",
                  border: "1px solid var(--tc-border-strong)",
                  background: "var(--tc-surface-soft)",
                  color: "var(--tc-text)",
                  outline: "none",
                }}
              />
              {scheduleError && (
                <div className="text-[11px] font-semibold mt-1" style={{ color: "var(--tc-danger)" }}>
                  {scheduleError}
                </div>
              )}
            </div>
          )}
        </div>
        <div>
          <label htmlFor="bulk-message-body" className="text-[11px] font-semibold block mb-1" style={{ color: "var(--tc-text-muted)" }}>선생님 안내문 (자유롭게 수정)</label>
          <textarea value={body} onChange={(e) => { setBody(e.target.value); setPreflight(null); }} rows={5}
            id="bulk-message-body"
            placeholder="학생·학부모에게 전할 안내를 작성하세요. 예: #{학생이름} 학생의 이번 주 과제를 확인해 주세요."
            className="w-full text-sm"
            style={{ padding: "8px 10px", borderRadius: "var(--tc-radius-sm)", border: "1px solid var(--tc-border-strong)", background: "var(--tc-surface-soft)", color: "var(--tc-text)", outline: "none", resize: "vertical" }} />
          <div className="text-[11px] mt-0.5" style={{ color: "var(--tc-text-muted)" }}>
            {body.length}자 · 여기서 고친 내용은 이번 발송에만 적용됩니다. 저장 문구를 바꾸려면 위의 문구 관리로 이동하세요.
          </div>
        </div>
        {tooManyRecipients && (
          <div className="text-[11px] font-semibold" style={{ color: "var(--tc-danger)" }}>
            한 번에 최대 200명까지 발송할 수 있습니다.
          </div>
        )}
        {preflight && preflight.blockers.map((issue) => (
          <div key={issue.code} className="text-[11px] font-semibold" role="alert" style={{ color: "var(--tc-danger)" }}>
            {issue.title}: {issue.detail}
          </div>
        ))}
        {preflight && preflight.warnings.map((issue) => (
          <div key={issue.code} className="text-[11px]" style={{ color: "var(--tc-warning, #9a6700)" }}>
            {issue.title}: {issue.detail}
          </div>
        ))}
        {checkError && <div role="alert" className="text-xs" style={{ color: "var(--tc-danger)" }}>{checkError}</div>}
        <button onClick={requestSend} disabled={!body.trim() || sendMut.isPending || checking || tooManyRecipients || !!scheduleError}
          className="w-full text-sm font-bold cursor-pointer mt-1"
          style={{ padding: "12px", borderRadius: "var(--tc-radius)", border: "none", background: body.trim() && !tooManyRecipients && !scheduleError ? "var(--tc-primary)" : "var(--tc-surface-soft)", color: body.trim() && !tooManyRecipients && !scheduleError ? "#fff" : "var(--tc-text-muted)" }}>
          {checking ? "발송 문구 확인 중…" : "실제 문구 확인하기"}
        </button>
      </div>
      )}
    </BottomSheet>
  );
}

/* ─── Bulk Tag Sheet ─── */
function BulkTagSheet({ open, onClose, students, onDone }: {
  open: boolean; onClose: () => void; students: ClientStudent[]; onDone: () => void;
}) {
  const qc = useQueryClient();
  const [newTagName, setNewTagName] = useState("");

  const { data: tags } = useQuery({ queryKey: teacherStudentsQueryKeys.allTags, queryFn: fetchTags, enabled: open });

  const attachMut = useMutation({
    mutationFn: (tagId: number) => bulkAttachTag(students.map((s) => s.id), tagId),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: teacherStudentsQueryKeys.students });
      teacherToast.success(`태그 적용 ${res.ok}건${res.fail > 0 ? `, 실패 ${res.fail}건` : ""}`);
      onDone();
      onClose();
    },
    onError: (e) => teacherToast.error(extractApiError(e, "태그 적용에 실패했습니다.")),
  });

  const createMut = useMutation({
    mutationFn: () => createTag(newTagName.trim()),
    onSuccess: (tag) => { setNewTagName(""); qc.invalidateQueries({ queryKey: teacherStudentsQueryKeys.allTags }); attachMut.mutate(tag.id); },
    onError: (e) => teacherToast.error(extractApiError(e, "태그를 생성하지 못했습니다.")),
  });

  return (
    <BottomSheet open={open} onClose={onClose} title={`${students.length}명에 태그`}>
      <div className="flex flex-col gap-3" style={{ padding: "var(--tc-space-3) 0" }}>
        <div>
          <label className="text-[11px] font-semibold block mb-1.5" style={{ color: "var(--tc-text-muted)" }}>기존 태그 선택</label>
          {tags && tags.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {tags.map((t) => (
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
  open: boolean; onClose: () => void; students: ClientStudent[]; onDone: () => void;
}) {
  const [target, setTarget] = useState<"student" | "parent" | "both">("student");
  const [tempPw, setTempPw] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setTarget("student");
      setTempPw("");
    }
  }, [open]);

  const handleSubmit = async () => {
    const password = tempPw.trim();
    if (password.length < 4) {
      teacherToast.error("설정할 임시 비밀번호를 4자 이상 입력해 주세요.");
      return;
    }
    setSubmitting(true);
    const targets: ("student" | "parent")[] = target === "both" ? ["student", "parent"] : [target];
    let ok = 0; let fail = 0;
    try {
      for (const s of students) {
        for (const t of targets) {
          try {
            const baseParams = {
              student_name: s.name ?? s.displayName ?? "",
              temp_password: password,
            };
            if (t === "student") {
              if (!s.psNumber && !s.studentPhone) { fail++; continue; }
              await sendPasswordReset({
                ...baseParams,
                target: "student",
                ...(s.psNumber ? { student_ps_number: s.psNumber } : {}),
                ...(s.studentPhone ? { student_phone: s.studentPhone } : {}),
              });
            } else {
              const pp = s.parentPhone;
              if (!pp) { fail++; continue; }
              await sendPasswordReset({
                ...baseParams,
                target: "parent",
                parent_phone: pp,
              });
            }
            ok++;
          } catch { fail++; }
        }
      }
      teacherToast.success(`비밀번호 변경 ${ok}건${fail > 0 ? `, 실패 ${fail}건` : ""}. 알림톡이 발송됩니다.`);
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
          <input type="password" autoComplete="new-password" value={tempPw} onChange={(e) => setTempPw(e.target.value)} placeholder="4자 이상 직접 입력"
            className="w-full text-sm"
            style={{ padding: "8px 10px", borderRadius: "var(--tc-radius-sm)", border: "1px solid var(--tc-border-strong)", background: "var(--tc-surface-soft)", color: "var(--tc-text)", outline: "none" }} />
          <p className="text-[11px] mt-1" style={{ color: "var(--tc-text-muted)" }}>필수 입력이며 모든 대상에 동일 비밀번호가 설정됩니다.</p>
        </div>
        <div className="flex items-center justify-between"
          style={{ padding: "10px 12px", borderRadius: "var(--tc-radius-sm)", border: "1px solid var(--tc-border-subtle)", background: "var(--tc-primary-bg)" }}>
          <div className="flex items-center gap-2">
            <MessageSquare size={ICON.xs} style={{ color: "var(--tc-primary)" }} />
            <div>
              <div className="text-[13px] font-semibold" style={{ color: "var(--tc-text)" }}>임시 비밀번호 알림톡 자동 발송</div>
              <div className="text-[11px]" style={{ color: "var(--tc-text-muted)" }}>
                변경된 비밀번호 안내는 계정 보호를 위해 자동 발송됩니다.
              </div>
            </div>
          </div>
        </div>
        <button onClick={handleSubmit} disabled={submitting || tempPw.trim().length < 4}
          className="w-full text-sm font-bold cursor-pointer mt-1"
          style={{ padding: "12px", borderRadius: "var(--tc-radius)", border: "none", background: "var(--tc-primary)", color: "#fff", opacity: submitting || tempPw.trim().length < 4 ? 0.6 : 1 }}>
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
