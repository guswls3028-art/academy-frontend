import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { bulkCreateEnrollments, fetchLectureEnrollments } from "@/shared/api/contracts/enrollments";
import { fetchStudents, type ClientStudent } from "@/shared/api/contracts/students";
import { AdminModal, ModalBody, ModalFooter, ModalHeader } from "@/shared/ui/modal";
import { Badge, Button, EmptyState } from "@/shared/ui/ds";
import { useConfirm } from "@/shared/ui/confirm";
import { feedback } from "@/shared/ui/feedback";
import { formatPhone } from "@/shared/utils/formatPhone";
import { adminStudentsQueryKeys } from "@admin/domains/students/public/queryKeys";
import { adminLectureQueryKeys } from "../queryKeys";
import "./LectureEnrollStudentModal.css";

interface Props {
  lectureId: number;
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  onChooseExcelUpload?: () => void;
}

const MAX_SELECTION = 200;

// Closing or switching lectures discards this picker instance and its selection.
export default function LectureEnrollStudentModal(props: Props) {
  return props.open ? <LectureStudentPicker key={props.lectureId} {...props} /> : null;
}

function LectureStudentPicker({ lectureId, onClose, onSuccess, onChooseExcelUpload }: Props) {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Map<number, ClientStudent>>(new Map());
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [saveError, setSaveError] = useState("");
  const [selectionMessage, setSelectionMessage] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      const trimmed = searchInput.trim();
      setSearch(/^[\d\s()+-]+$/.test(trimmed) ? trimmed.replace(/\D/g, "") : trimmed);
      setPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const studentsQ = useQuery({
    queryKey: adminLectureQueryKeys.lectureEnrollStudents(lectureId, search, page),
    queryFn: () => fetchStudents(search, {}, "name", page),
  });
  const enrollmentsQ = useQuery({
    queryKey: adminLectureQueryKeys.lectureEnrollments(lectureId),
    queryFn: () => fetchLectureEnrollments(lectureId),
    staleTime: 0,
  });
  const enrollmentStatus = useMemo(() => new Map(
    (enrollmentsQ.data ?? []).map((row) => [row.student?.id, row.status]),
  ), [enrollmentsQ.data]);
  const loading = studentsQ.isPending || enrollmentsQ.isPending;
  const loadError = studentsQ.isError || enrollmentsQ.isError;
  const busy = saving || loading || loadError || enrollmentsQ.isFetching;
  const rows = studentsQ.data?.data ?? [];
  const eligible = rows.filter((student) => !student.deletedAt && enrollmentStatus.get(student.id) !== "ACTIVE");
  const totalPages = Math.max(1, Math.ceil((studentsQ.data?.count ?? 0) / (studentsQ.data?.pageSize ?? 50)));

  const toggle = (student: ClientStudent) => {
    if (busy || savingRef.current) return;
    if (!selected.has(student.id) && selected.size >= MAX_SELECTION) {
      setSelectionMessage("한 번에 200명까지 등록할 수 있습니다. 선택한 학생을 등록한 뒤 이어서 추가해 주세요.");
      return;
    }
    setSelectionMessage("");
    setSelected((previous) => {
      const next = new Map(previous);
      if (next.has(student.id)) next.delete(student.id);
      else next.set(student.id, student);
      return next;
    });
  };

  const selectPage = () => {
    const additions = eligible.filter((student) => !selected.has(student.id));
    if (selected.size + additions.length > MAX_SELECTION) {
      setSelectionMessage("한 번에 200명까지 선택할 수 있습니다. 필요한 학생을 개별 선택하거나 먼저 등록해 주세요.");
      return;
    }
    setSelectionMessage("");
    setSelected(new Map([...selected, ...additions.map((student) => [student.id, student] as const)]));
  };

  const leave = async (next: () => void) => {
    if (savingRef.current) return;
    if (selected.size && !await confirm({
      title: saveError ? "등록 결과 확인을 종료할까요?" : "선택한 학생을 등록하지 않고 나갈까요?",
      message: saveError
        ? "등록 여부가 불확실할 수 있습니다. 나간 뒤 강의 명단에서 등록 결과를 확인해 주세요."
        : `선택한 ${selected.size}명은 아직 이 강의에 등록되지 않았습니다.`,
      confirmText: "선택 취소하고 나가기",
      danger: true,
    })) return;
    next();
  };

  const save = async () => {
    if (savingRef.current || busy || !selected.size) return;
    savingRef.current = true;
    setSaving(true);
    setSaveError("");
    const studentIds = [...selected.keys()];
    let submitted = false;
    try {
      await bulkCreateEnrollments(lectureId, studentIds);
      submitted = true;
      const saved = await fetchLectureEnrollments(lectureId);
      const active = new Set(saved.filter((row) => row.status === "ACTIVE").map((row) => row.student?.id));
      if (studentIds.some((id) => !active.has(id))) throw new Error("incomplete-readback");
      qc.setQueryData(adminLectureQueryKeys.lectureEnrollments(lectureId), saved);
      await Promise.all([
        qc.invalidateQueries({ queryKey: adminLectureQueryKeys.attendanceMatrix(lectureId) }),
        qc.invalidateQueries({ queryKey: adminLectureQueryKeys.lecture(lectureId) }),
        qc.invalidateQueries({ queryKey: adminLectureQueryKeys.lectures }),
        qc.invalidateQueries({ queryKey: adminStudentsQueryKeys.students }),
        qc.invalidateQueries({ queryKey: adminStudentsQueryKeys.student }),
        qc.invalidateQueries({ queryKey: adminLectureQueryKeys.sessionEnrollModalStudents }),
      ]);
      feedback.success(`${studentIds.length}명을 강의에 등록했습니다.`);
      onSuccess?.();
      onClose();
    } catch {
      setSaveError(submitted
        ? "등록 요청은 완료됐지만 저장된 명단을 확인하지 못했습니다. 선택은 유지됩니다. 다시 등록하면 중복 없이 확인합니다."
        : "등록을 완료하지 못했습니다. 선택은 유지됩니다. 학생의 현재 상태와 연결을 확인한 뒤 다시 시도해 주세요.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <AdminModal open onClose={() => { void leave(onClose); }} type="action" width={840}
      className="lecture-enroll-picker" noMinimize trapFocus closeDisabled={saving}>
      <ModalHeader type="action" title="수강생 등록"
        description="기존 학생을 골라 이 강의에 바로 추가하세요. 차시 없이도 등록할 수 있습니다." />
      <ModalBody>
        <div className="lecture-enroll-picker__body">
          <div className="lecture-enroll-picker__search">
            <label className="sr-only" htmlFor="lecture-enroll-search">학생 검색</label>
            <input id="lecture-enroll-search" className="ds-input" autoFocus value={searchInput}
              placeholder="이름 / 전화번호 / 학교 검색" disabled={saving}
              onChange={(event) => setSearchInput(event.target.value)} />
            {onChooseExcelUpload && <Button intent="secondary" disabled={saving} onClick={() => {
              void leave(() => { onClose(); onChooseExcelUpload(); });
            }}>엑셀로 일괄 등록</Button>}
          </div>
          <div className="lecture-enroll-picker__toolbar">
            <span>{loading ? "명단 확인 중…" : loadError ? "명단 확인 필요" : `검색 결과 ${studentsQ.data?.count ?? 0}명`}</span>
            <Button size="sm" disabled={busy || !eligible.some((student) => !selected.has(student.id))}
              onClick={selectPage}>현재 페이지 선택</Button>
          </div>
          <div className="lecture-enroll-picker__list" aria-label="기존 학생 명단" aria-busy={loading}>
            {loading ? <EmptyState scope="panel" tone="loading" title="학생 명단을 불러오는 중…" />
              : loadError ? <EmptyState scope="panel" tone="error" title="학생 명단을 불러오지 못했습니다"
                description="선택한 학생은 유지됩니다. 명단을 다시 불러와 주세요."
                actions={<Button onClick={() => { void studentsQ.refetch(); void enrollmentsQ.refetch(); }}>다시 불러오기</Button>} />
                : rows.length === 0 ? <EmptyState scope="panel" tone="empty"
                  title={search ? "검색 결과가 없습니다" : "등록된 학생이 없습니다"}
                  description={search ? "다른 이름이나 전화번호로 검색해 주세요." : "학생 관리에서 학생을 먼저 등록해 주세요."} />
                  : rows.map((student) => {
                    const status = enrollmentStatus.get(student.id);
                    const enrolled = status === "ACTIVE";
                    return (
                      <label key={student.id} className="lecture-enroll-picker__row"
                        data-selected={selected.has(student.id)} data-enrolled={enrolled}>
                        <input type="checkbox" checked={selected.has(student.id)}
                          disabled={busy || enrolled || !!student.deletedAt}
                          aria-label={`${student.name} 선택`} onChange={() => toggle(student)} />
                        <span className="lecture-enroll-picker__identity">
                          <strong>{student.displayName || student.name}</strong>
                          <span>{[student.school, student.grade ? `${student.grade}학년` : null].filter(Boolean).join(" · ") || "학교 정보 없음"}</span>
                        </span>
                        <span className="lecture-enroll-picker__contact">
                          <span>학부모 {formatPhone(student.parentPhone) || "—"}</span>
                          <span>학생 {formatPhone(student.studentPhone) || "—"}</span>
                        </span>
                        {enrolled ? <Badge tone="neutral">등록됨</Badge>
                          : status === "INACTIVE" ? <Badge tone="warning">재등록</Badge>
                            : status === "PENDING" ? <Badge tone="warning">등록 대기</Badge> : null}
                      </label>
                    );
                  })}
          </div>
          <nav className="lecture-enroll-picker__pagination" aria-label="학생 명단 페이지">
            <Button size="sm" disabled={saving || loading || page <= 1} onClick={() => setPage(page - 1)}>이전</Button>
            <span>{page} / {totalPages} 페이지</span>
            <Button size="sm" disabled={saving || loading || loadError || page >= totalPages} onClick={() => setPage(page + 1)}>다음</Button>
          </nav>
          <section className="lecture-enroll-picker__selection" aria-label="선택한 학생">
            <div className="lecture-enroll-picker__toolbar">
              <strong role="status">{selected.size}명 선택</strong>
              <Button size="sm" intent="ghost" disabled={saving || !selected.size}
                onClick={() => { setSelected(new Map()); setSelectionMessage(""); }}>전체 선택 해제</Button>
            </div>
            {selected.size > 0 ? <div className="lecture-enroll-picker__chips">
              {[...selected.values()].map((student) => <button key={student.id} type="button" disabled={saving}
                aria-label={`${student.name} 선택 해제`} onClick={() => {
                  setSelected((previous) => { const next = new Map(previous); next.delete(student.id); return next; });
                  setSelectionMessage("");
                }}>{student.displayName || student.name}<span aria-hidden> ×</span></button>)}
            </div> : <p>학생을 클릭해 선택하세요. 검색·페이지를 바꿔도 선택은 유지됩니다.</p>}
          </section>
          {selectionMessage && <p role="status" className="lecture-enroll-picker__notice">{selectionMessage}</p>}
          {saveError && <p role="alert" className="lecture-enroll-picker__error">{saveError}</p>}
          <p className="lecture-enroll-picker__hint">강의 명단에만 추가됩니다. 출결 대상은 각 차시에서 배정하세요. 첫 수강 등록 시 기존 설정에 따라 계정 안내가 발송될 수 있습니다.</p>
        </div>
      </ModalBody>
      <ModalFooter left={<span className="lecture-enroll-picker__hint">한 번에 최대 200명</span>} right={<>
        <Button intent="secondary" disabled={saving} onClick={() => { void leave(onClose); }}>취소</Button>
        <Button intent="primary" disabled={busy || !selected.size} loading={saving} onClick={() => { void save(); }}>
          {saving ? "등록 확인 중…" : `${selected.size}명 강의에 추가`}
        </Button>
      </>} />
    </AdminModal>
  );
}
