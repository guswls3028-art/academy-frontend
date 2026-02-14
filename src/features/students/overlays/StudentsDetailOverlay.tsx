// PATH: src/features/students/overlays/StudentsDetailOverlay.tsx
// 학생 상세 오버레이 — 고급 SaaS 스타일, 기능·구성 동일

import { useParams, useNavigate } from "react-router-dom";
import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createPortal } from "react-dom";

import {
  getStudentDetail,
  getTags,
  attachStudentTag,
  detachStudentTag,
  createMemo,
  deleteStudent,
  toggleStudentActive,
} from "../api/students";

import StudentFormModal from "../components/EditStudentModal";
import TagCreateModal from "../components/TagCreateModal";
import StudentNameWithLectureChip from "@/shared/ui/chips/StudentNameWithLectureChip";
import { EmptyState, Button, CloseButton } from "@/shared/ui/ds";
import { formatPhone, formatStudentPhoneDisplay, formatOmrCode } from "@/shared/utils/formatPhone";

const TABS = [
  { key: "enroll", label: "수강 이력" },
  { key: "clinic", label: "클리닉/상담 이력" },
  { key: "question", label: "질문 이력" },
  { key: "score", label: "성적 이력" },
  { key: "schoolScore", label: "학교 성적" },
];

/** 인벤토리 아이콘 프리셋 — 시험/자료 종류별 시각 구분 */
const INVENTORY_ICON_PRESETS = [
  { id: "mid1", label: "1학기 중간", emoji: "📄", color: "#c62828" },
  { id: "final1", label: "1학기 기말", emoji: "📄", color: "#ad1457" },
  { id: "mid2", label: "2학기 중간", emoji: "📄", color: "#6a1b9a" },
  { id: "final2", label: "2학기 기말", emoji: "📄", color: "#1565c0" },
  { id: "mock3", label: "모의고사 3월", emoji: "📋", color: "#00838f" },
  { id: "mock6", label: "모의고사 6월", emoji: "📋", color: "#2e7d32" },
  { id: "mock9", label: "모의고사 9월", emoji: "📋", color: "#ef6c00" },
  { id: "custom", label: "학원 사설", emoji: "📌", color: "#37474f" },
  { id: "misc", label: "기타", emoji: "📎", color: "#757575" },
] as const;

type StudentsDetailOverlayProps = {
  /** 라우트가 아닌 곳(예: 모달)에서 띄울 때 전달. 있으면 onClose로만 닫고 라우트 변경 없음 */
  studentId?: number;
  onClose?: () => void;
};

export default function StudentsDetailOverlay(props?: StudentsDetailOverlayProps) {
  const routeParams = useParams();
  const navigate = useNavigate();
  const id = props?.studentId ?? Number(routeParams.studentId);
  const onClose = props?.onClose ?? (() => navigate(-1));
  const qc = useQueryClient();

  const [tab, setTab] = useState("enroll");
  const [editOpen, setEditOpen] = useState(false);
  const [tagCreateOpen, setTagCreateOpen] = useState(false);
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [inventoryTab, setInventoryTab] = useState<"score" | "misc" | "video" | "image">("score");
  const [viewerItem, setViewerItem] = useState<{ type: "pdf" | "image" | "video"; url: string; name: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const addFileTabRef = useRef<"score" | "misc">("score");

  type UploadedInventoryItem = {
    id: string;
    title: string;
    description: string;
    fileName: string;
    fileUrl: string;
    fileType: "pdf" | "image";
    iconPreset: string;
  };
  const [uploadedScoreItems, setUploadedScoreItems] = useState<UploadedInventoryItem[]>([]);
  const [uploadedMiscItems, setUploadedMiscItems] = useState<UploadedInventoryItem[]>([]);
  const [addFileModal, setAddFileModal] = useState<{
    tab: "score" | "misc";
    file: File;
    title: string;
    description: string;
    iconPreset: string;
  } | null>(null);
  const [editItem, setEditItem] = useState<{ item: UploadedInventoryItem; tab: "score" | "misc" } | null>(null);
  const [inventoryMultiSelect, setInventoryMultiSelect] = useState(false);
  const [inventorySelectedId, setInventorySelectedId] = useState<string | null>(null);
  const [inventorySelectedIds, setInventorySelectedIds] = useState<Set<string>>(new Set());

  const handleInventoryFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const tab = addFileTabRef.current;
    const baseName = file.name.replace(/\.[^.]+$/, "") || file.name;
    setAddFileModal({ tab, file, title: baseName, description: "", iconPreset: INVENTORY_ICON_PRESETS[0].id });
    e.target.value = "";
  };

  const triggerAddFile = (tab: "score" | "misc") => {
    addFileTabRef.current = tab;
    fileInputRef.current?.click();
  };

  const confirmAddFile = () => {
    if (!addFileModal) return;
    const { tab, file, title, description, iconPreset } = addFileModal;
    const fileUrl = URL.createObjectURL(file);
    const fileType = file.type.startsWith("image/") ? "image" as const : "pdf" as const;
    const item: UploadedInventoryItem = {
      id: crypto.randomUUID(),
      title: title.trim() || file.name,
      description,
      fileName: file.name,
      fileUrl,
      fileType,
      iconPreset,
    };
    if (tab === "score") setUploadedScoreItems((prev) => [...prev, item]);
    else setUploadedMiscItems((prev) => [...prev, item]);
    setAddFileModal(null);
  };

  const currentList = inventoryTab === "score" ? uploadedScoreItems : uploadedMiscItems;
  const setCurrentList = inventoryTab === "score" ? setUploadedScoreItems : setUploadedMiscItems;
  const selectedIds = inventoryMultiSelect ? inventorySelectedIds : (inventorySelectedId ? new Set([inventorySelectedId]) : new Set());
  const hasSelection = selectedIds.size > 0;

  const toggleInventorySelection = (id: string) => {
    if (inventoryMultiSelect) {
      setInventorySelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    } else {
      setInventorySelectedId((prev) => (prev === id ? null : id));
    }
  };

  const openEditModal = () => {
    if (!inventorySelectedId || selectedIds.size !== 1) return;
    const item = [...uploadedScoreItems, ...uploadedMiscItems].find((i) => i.id === inventorySelectedId);
    if (item)
      setEditItem({
        item,
        tab: uploadedScoreItems.some((i) => i.id === inventorySelectedId) ? "score" : "misc",
      });
  };

  const confirmEditItem = () => {
    if (!editItem) return;
    const { item, tab } = editItem;
    const updater = (prev: UploadedInventoryItem[]) =>
      prev.map((i) => (i.id === item.id ? { ...i, title: item.title, description: item.description, iconPreset: item.iconPreset } : i));
    if (tab === "score") setUploadedScoreItems(updater);
    else setUploadedMiscItems(updater);
    setEditItem(null);
  };

  const deleteSelectedInventory = () => {
    const toDelete = Array.from(selectedIds);
    toDelete.forEach((id) => {
      const item = [...uploadedScoreItems, ...uploadedMiscItems].find((i) => i.id === id);
      if (item?.fileUrl.startsWith("blob:")) URL.revokeObjectURL(item.fileUrl);
    });
    setCurrentList((prev) => prev.filter((i) => !toDelete.includes(i.id)));
    setInventorySelectedId(null);
    setInventorySelectedIds(new Set());
  };

  const { data: student, isLoading } = useQuery({
    queryKey: ["student", id],
    queryFn: () => getStudentDetail(id),
    enabled: !!id,
  });

  const { data: tags } = useQuery({
    queryKey: ["tags"],
    queryFn: getTags,
  });

  const addTag = useMutation({
    mutationFn: (tagId: number) => attachStudentTag(id, tagId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["student", id] });
      qc.invalidateQueries({ queryKey: ["tags"] });
    },
  });

  const removeTag = useMutation({
    mutationFn: (tagId: number) => detachStudentTag(id, tagId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["student", id] }),
  });

  const updateMemo = useMutation({
    mutationFn: (memo: string) => createMemo(id, memo),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["student", id] }),
  });

  const toggleActive = useMutation({
    mutationFn: (nextActive: boolean) => toggleStudentActive(id, nextActive),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["student", id] });
      qc.invalidateQueries({ queryKey: ["students"] });
    },
  });

  async function handleDelete() {
    if (!confirm("이 학생을 삭제하시겠습니까?")) return;
    await deleteStudent(id);
    qc.invalidateQueries({ queryKey: ["students"] });
    onClose();
  }

  if (isLoading || !student) return null;

  return (
    <>
      <div className="ds-overlay-backdrop" onClick={onClose} aria-hidden />

      <div className="ds-overlay-wrap">
        <div className="ds-overlay-panel" onClick={(e) => e.stopPropagation()}>
          {/* 우상단 닫기 X — 전역 SSOT */}
          <CloseButton
            className="ds-overlay-panel__close"
            onClick={onClose}
          />
          {/* 헤더 — 1행: 아바타(큼) | 이름 | 강의딱지 | 2행: 아이디·OMR 블럭(SSOT 뱃지 스타일) + 액션 */}
          <header className="ds-overlay-header">
            <div className="ds-overlay-header__inner">
              <div className="ds-overlay-header__left">
                <div className="ds-overlay-header__accent" aria-hidden />
                <div className="ds-overlay-header__title-block">
                  <h1 className="ds-overlay-header__title">
                    <StudentNameWithLectureChip
                      name={student.name ?? ""}
                      profilePhotoUrl={student.profilePhotoUrl}
                      avatarSize={88}
                      chipSize={40}
                      lectures={
                        Array.isArray(student.enrollments) && student.enrollments.length > 0
                          ? student.enrollments.map((en: { lectureName?: string | null; lectureColor?: string | null; lectureChipLabel?: string | null }) => ({
                              lectureName: en.lectureName ?? "—",
                              color: en.lectureColor ?? undefined,
                              chipLabel: en.lectureChipLabel ?? undefined,
                            }))
                          : undefined
                      }
                    />
                  </h1>
                  <div className="ds-overlay-header__pills">
                    <span className="ds-overlay-header__pill ds-overlay-header__pill--id" title="아이디">
                      {student.psNumber ?? "—"}
                    </span>
                    <span className="ds-overlay-header__pill ds-overlay-header__pill--code" title="시험 식별코드">
                      {formatOmrCode(student.omrCode)}
                    </span>
                  </div>
                </div>
              </div>
              <div className="ds-overlay-header__right">
                <div className="ds-overlay-header__actions">
                  <button
                    type="button"
                    onClick={() => toggleActive.mutate(!student.active)}
                    disabled={toggleActive.isPending}
                    className="ds-status-badge"
                    data-status={student.active ? "active" : "inactive"}
                  >
                    {toggleActive.isPending ? "…" : student.active ? "활성" : "비활성"}
                  </button>
                  <Button type="button" intent="primary" size="sm" onClick={() => setEditOpen(true)}>
                    수정
                  </Button>
                  <Button type="button" intent="danger" size="sm" onClick={handleDelete}>
                    삭제
                  </Button>
                </div>
              </div>
            </div>
          </header>

          <div className="ds-overlay-body">
            <div className="ds-overlay-body__grid">
              {/* Left panel — 정보·태그·메모 */}
              <div
                style={{
                  borderRadius: 12,
                  padding: 16,
                  background: "var(--bg-surface-soft)",
                  border: "1px solid var(--color-border-divider)",
                }}
              >
                <div className="ds-overlay-info-rows">
                  <InfoRow
                    label="식별코드"
                    value={formatOmrCode(student.omrCode)}
                    accent
                  />
                  <InfoRow label="학부모 전화" value={formatPhone(student.parentPhone)} />
                  <InfoRow
                    label="학생 전화"
                    value={formatStudentPhoneDisplay(student.studentPhone)}
                  />
                  <InfoRow label="성별" value={student.gender} />
                  <InfoRow label="학교" value={student.school} />
                  <InfoRow
                    label="학년"
                    value={student.grade ? `${student.grade}학년` : "-"}
                  />
                  <InfoRow label="반" value={student.schoolClass} />
                  <InfoRow label="계열" value={student.major} />
                </div>

                <div style={{ marginTop: 20 }}>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 800,
                      marginBottom: 8,
                      color: "var(--color-text-muted)",
                      letterSpacing: "0.04em",
                      textTransform: "uppercase",
                    }}
                  >
                    태그
                  </div>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {student.tags?.length ? (
                      student.tags.map((t: any) => {
                        const c = String(t.color || "").toLowerCase();
                        const lightColors = ["#eab308", "#06b6d4"];
                        const isLight = lightColors.some((x) => c === x);
                        return (
                        <span
                          key={t.id}
                          className="inline-flex items-center gap-1 group cursor-default"
                          style={{
                            padding: "6px 10px 6px 12px",
                            borderRadius: "6px 6px 6px 2px",
                            fontSize: 12,
                            fontWeight: 700,
                            background: t.color,
                            color: isLight ? "#1a1a1a" : "#fff",
                            border: "none",
                            boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
                            textShadow: isLight ? "none" : "0 0 1px rgba(0,0,0,0.2)",
                          }}
                        >
                          {t.name}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeTag.mutate(t.id);
                            }}
                            disabled={removeTag.isPending}
                            aria-label={`${t.name} 태그 제거`}
                            style={{
                              marginLeft: 4,
                              padding: 0,
                              width: 16,
                              height: 16,
                              borderRadius: 999,
                              border: "none",
                              background: "rgba(0,0,0,0.2)",
                              color: "#fff",
                              fontSize: 12,
                              cursor: removeTag.isPending ? "wait" : "pointer",
                              display: "grid",
                              placeItems: "center",
                              lineHeight: 1,
                            }}
                          >
                            ×
                          </button>
                        </span>
                        );
                      })
                    ) : (
                      <span
                        style={{
                          fontSize: 12,
                          color: "var(--color-text-muted)",
                          fontWeight: 600,
                        }}
                      >
                        태그 없음
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      intent="primary"
                      size="sm"
                      onClick={() => setTagCreateOpen(true)}
                    >
                      + 태그 추가
                    </Button>
                    {tags?.filter((t: any) => !student.tags?.some((st: any) => st.id === t.id)).length > 0 && (
                      <select
                        className="ds-input"
                        style={{ fontSize: 13, minWidth: 140 }}
                        onChange={(e) => {
                          const tagId = Number(e.target.value);
                          if (tagId) addTag.mutate(tagId);
                          e.currentTarget.value = "";
                        }}
                      >
                        <option value="">기존 태그 선택…</option>
                        {tags
                          ?.filter((t: any) => !student.tags?.some((st: any) => st.id === t.id))
                          .map((tag: any) => (
                            <option key={tag.id} value={tag.id}>
                              {tag.name}
                            </option>
                          ))}
                      </select>
                    )}
                  </div>
                </div>

                <div style={{ marginTop: 20 }}>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 800,
                      marginBottom: 8,
                      color: "var(--color-text-muted)",
                      letterSpacing: "0.04em",
                      textTransform: "uppercase",
                    }}
                  >
                    메모
                  </div>
                  <textarea
                    className="ds-textarea w-full"
                    rows={4}
                    defaultValue={student.memo}
                    placeholder="메모..."
                    onBlur={(e) => updateMemo.mutate(e.target.value)}
                    style={{
                      fontSize: 13,
                      borderRadius: 12,
                      border: "1px solid var(--color-border-divider)",
                    }}
                  />
                </div>
              </div>

              {/* Right panel — 탭 + 콘텐츠 (페이지형 플랫탭) */}
              <div
                style={{
                  borderRadius: 12,
                  padding: 16,
                  background: "color-mix(in srgb, var(--color-brand-primary) 4%, var(--bg-surface-soft))",
                  border: "1px solid var(--color-border-divider)",
                }}
              >
                <div className="ds-overlay-tabs">
                  <div className="ds-tabs ds-tabs--flat">
                    {TABS.map((t) => (
                      <button
                        key={t.key}
                        type="button"
                        className={`ds-tab ${tab === t.key ? "is-active" : ""}`}
                        onClick={() => setTab(t.key)}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ minHeight: 260, marginTop: 16 }}>
                  {tab === "enroll" ? (
                    <EnrollmentsTab enrollments={student.enrollments} />
                  ) : (
                    <EmptyState title="데이터가 없습니다." />
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 우하단 인벤토리 트리거 — 아이콘만 큼지막하게, 클릭 시 좌측 패널 */}
          <div className="ds-overlay-inventory-wrap">
            <button
              type="button"
              className="ds-inventory-trigger-btn"
              onClick={() => setInventoryOpen(true)}
              title="인벤토리"
              aria-label="인벤토리 열기"
            >
              📁
            </button>
          </div>
        </div>
      </div>

      {inventoryOpen &&
        createPortal(
          <>
            <div className="ds-overlay-backdrop" onClick={() => setInventoryOpen(false)} aria-hidden />
            <div
              className="ds-inventory-panel"
              role="dialog"
              aria-label="학생 인벤토리"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="ds-inventory-panel__header">
                <span className="ds-inventory-panel__title">인벤토리 — {student.name}</span>
                <div className="ds-inventory-panel__header-actions">
                  <CloseButton onClick={() => setInventoryOpen(false)} />
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.gif,.webp"
                className="ds-sr-only"
                aria-hidden
                onChange={handleInventoryFileChange}
              />
              <div className="ds-inventory-panel__tabs-wrap">
                <div className="ds-inventory-panel__multi-check">
                  <input
                    id="inv-multi"
                    type="checkbox"
                    checked={inventoryMultiSelect}
                    onChange={(e) => {
                      setInventoryMultiSelect(e.target.checked);
                      if (!e.target.checked) setInventorySelectedIds(new Set());
                    }}
                    aria-label="다중 선택"
                  />
                  <label htmlFor="inv-multi">다중</label>
                </div>
                <div className="ds-inventory-panel__tabs">
                  {(["score", "misc", "video", "image"] as const).map((key) => (
                    <button
                      key={key}
                      type="button"
                      className={`ds-inventory-panel__tab ${inventoryTab === key ? "is-active" : ""}`}
                      onClick={() => setInventoryTab(key)}
                    >
                      {key === "score" && "성적표"}
                      {key === "misc" && "기타"}
                      {key === "video" && "제출영상"}
                      {key === "image" && "제출이미지"}
                    </button>
                  ))}
                </div>
              </div>
              <div className="ds-inventory-panel__body">
                <div className="ds-inventory-panel__grid">
                  {inventoryTab === "score" && (
                    <>
                      <div
                        className="ds-inventory-panel__item ds-inventory-panel__item--add"
                        role="button"
                        tabIndex={0}
                        onClick={() => triggerAddFile("score")}
                        onKeyDown={(e) => e.key === "Enter" && triggerAddFile("score")}
                        title="파일 추가"
                      >
                        +
                      </div>
                      {uploadedScoreItems.map((item) => {
                        const preset = INVENTORY_ICON_PRESETS.find((p) => p.id === item.iconPreset) ?? INVENTORY_ICON_PRESETS[0];
                        const isSelected = selectedIds.has(item.id);
                        return (
                          <div
                            key={item.id}
                            className={`ds-inventory-panel__item ds-inventory-panel__item--uploaded ${isSelected ? "is-selected" : ""}`}
                            title={item.description || item.title}
                            onClick={() => toggleInventorySelection(item.id)}
                            onDoubleClick={(e) => {
                              e.stopPropagation();
                              setViewerItem({ type: item.fileType, url: item.fileUrl, name: item.title });
                            }}
                          >
                            <span
                              className="ds-inventory-panel__item-icon-badge"
                              style={{ backgroundColor: preset.color + "22", color: preset.color }}
                            >
                              {preset.emoji}
                            </span>
                            <span className="ds-inventory-panel__item-title">{item.title}</span>
                            {item.description && <span className="ds-inventory-panel__item-desc">{item.description}</span>}
                            <span className="ds-inventory-panel__item-filename">{item.fileName}</span>
                          </div>
                        );
                      })}
                    </>
                  )}
                  {inventoryTab === "misc" && (
                    <>
                      <div
                        className="ds-inventory-panel__item ds-inventory-panel__item--add"
                        role="button"
                        tabIndex={0}
                        onClick={() => triggerAddFile("misc")}
                        onKeyDown={(e) => e.key === "Enter" && triggerAddFile("misc")}
                        title="파일 추가"
                      >
                        +
                      </div>
                      {uploadedMiscItems.map((item) => {
                        const preset = INVENTORY_ICON_PRESETS.find((p) => p.id === item.iconPreset) ?? INVENTORY_ICON_PRESETS[0];
                        const isSelected = selectedIds.has(item.id);
                        return (
                          <div
                            key={item.id}
                            className={`ds-inventory-panel__item ds-inventory-panel__item--uploaded ${isSelected ? "is-selected" : ""}`}
                            title={item.description || item.title}
                            onClick={() => toggleInventorySelection(item.id)}
                            onDoubleClick={(e) => {
                              e.stopPropagation();
                              setViewerItem({ type: item.fileType, url: item.fileUrl, name: item.title });
                            }}
                          >
                            <span
                              className="ds-inventory-panel__item-icon-badge"
                              style={{ backgroundColor: preset.color + "22", color: preset.color }}
                            >
                              {preset.emoji}
                            </span>
                            <span className="ds-inventory-panel__item-title">{item.title}</span>
                            {item.description && <span className="ds-inventory-panel__item-desc">{item.description}</span>}
                            <span className="ds-inventory-panel__item-filename">{item.fileName}</span>
                          </div>
                        );
                      })}
                    </>
                  )}
                  {inventoryTab === "video" && (
                    <>
                      <div
                        className="ds-inventory-panel__item"
                        title="학생 앱 제출분 (더블클릭)"
                        onDoubleClick={() => setViewerItem({ type: "video", url: "#", name: "제출 영상 1" })}
                      >
                        <span className="ds-inventory-panel__item-icon">🎬</span>
                        <span>제출 영상 1</span>
                      </div>
                    </>
                  )}
                  {inventoryTab === "image" && (
                    <>
                      <div
                        className="ds-inventory-panel__item"
                        title="학생 앱 제출분 (더블클릭)"
                        onDoubleClick={() => setViewerItem({ type: "image", url: "#", name: "제출 이미지 1" })}
                      >
                        <span className="ds-inventory-panel__item-icon">🖼️</span>
                        <span>제출 이미지 1</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </>,
          document.body
        )}

      {addFileModal &&
        createPortal(
          <>
            <div className="ds-overlay-backdrop" onClick={() => setAddFileModal(null)} aria-hidden />
            <div className="ds-inventory-add-modal" role="dialog" aria-label="파일 추가" onClick={(e) => e.stopPropagation()}>
              <div className="ds-inventory-add-modal__title">{addFileModal.tab === "score" ? "성적표 추가" : "기타 자료 추가"}</div>
              <div className="ds-inventory-add-modal__field">
                <label htmlFor="inv-add-title">제목</label>
                <input
                  id="inv-add-title"
                  type="text"
                  value={addFileModal.title}
                  onChange={(e) => setAddFileModal((m) => (m ? { ...m, title: e.target.value } : null))}
                  placeholder="제목"
                />
              </div>
              <div className="ds-inventory-add-modal__field">
                <label htmlFor="inv-add-desc">설명</label>
                <textarea
                  id="inv-add-desc"
                  value={addFileModal.description}
                  onChange={(e) => setAddFileModal((m) => (m ? { ...m, description: e.target.value } : null))}
                  placeholder="설명 (선택)"
                />
              </div>
              <div className="ds-inventory-add-modal__actions">
                <Button type="button" intent="secondary" size="sm" onClick={() => setAddFileModal(null)}>
                  취소
                </Button>
                <Button type="button" intent="primary" size="sm" onClick={confirmAddFile}>
                  추가
                </Button>
              </div>
            </div>
          </>,
          document.body
        )}

      {viewerItem &&
        createPortal(
          <>
            <div className="ds-overlay-backdrop" onClick={() => setViewerItem(null)} aria-hidden />
            <div className="ds-inventory-viewer" role="dialog" aria-label="보기" onClick={(e) => e.stopPropagation()}>
              <div className="ds-inventory-viewer__header">
                <span className="ds-inventory-viewer__title">{viewerItem.name}</span>
                <CloseButton onClick={() => setViewerItem(null)} />
              </div>
              <div className="ds-inventory-viewer__body">
                {viewerItem.type === "pdf" && (
                  viewerItem.url.startsWith("blob:") ? (
                    <iframe src={viewerItem.url} title={viewerItem.name} className="ds-inventory-viewer__iframe" />
                  ) : (
                    <div className="ds-inventory-viewer__placeholder">PDF 뷰어 (URL 연동 시 iframe 표시)</div>
                  )
                )}
                {viewerItem.type === "image" && (
                  viewerItem.url.startsWith("blob:") ? (
                    <img src={viewerItem.url} alt={viewerItem.name} className="ds-inventory-viewer__img" />
                  ) : (
                    <div className="ds-inventory-viewer__placeholder">이미지 뷰어 (URL 연동 시 img 표시)</div>
                  )
                )}
                {viewerItem.type === "video" && (
                  viewerItem.url.startsWith("blob:") ? (
                    <video src={viewerItem.url} controls className="ds-inventory-viewer__video" />
                  ) : (
                    <div className="ds-inventory-viewer__placeholder">영상 뷰어 (URL 연동 시 video 표시)</div>
                  )
                )}
              </div>
            </div>
          </>,
          document.body
        )}

      {editOpen &&
        createPortal(
          <StudentFormModal
            open={true}
            initialValue={student}
            onClose={() => setEditOpen(false)}
            onSuccess={() => {
              setEditOpen(false);
              qc.invalidateQueries({ queryKey: ["student", id] });
            }}
          />,
          document.body
        )}

      {tagCreateOpen &&
        createPortal(
          <TagCreateModal
            open={true}
            onClose={() => setTagCreateOpen(false)}
            onSuccess={(tag) => {
              addTag.mutate(tag.id);
              setTagCreateOpen(false);
            }}
            usedColors={tags?.map((t: any) => t.color).filter(Boolean) ?? []}
          />,
          document.body
        )}
    </>
  );
}

function InfoRow({
  label,
  value,
  accent,
}: {
  label: string;
  value: any;
  accent?: boolean;
}) {
  return (
    <div
      className="ds-overlay-info-row"
      style={{
        display: "grid",
        gridTemplateColumns: "1fr auto",
        alignItems: "center",
        padding: "6px 10px",
        borderRadius: 8,
        background: accent
          ? "color-mix(in srgb, var(--color-brand-primary) 10%, var(--color-bg-surface))"
          : "var(--color-bg-surface)",
        border: "1px solid var(--color-border-divider)",
        fontSize: 13,
      }}
    >
      <span
        style={{
          fontWeight: 600,
          color: "var(--color-text-muted)",
          fontSize: 12,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontWeight: 700,
          color: "var(--color-text-primary)",
          textAlign: "right",
        }}
      >
        {value || "-"}
      </span>
    </div>
  );
}

function EnrollmentsTab({ enrollments }: { enrollments: any[] }) {
  if (!enrollments?.length) return <EmptyState title="수강 이력이 없습니다." />;

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {enrollments.map((en: any) => (
        <div
          key={en.id}
          style={{
            padding: "14px 16px",
            borderRadius: 12,
            background: "var(--color-bg-surface)",
            border: "1px solid var(--color-border-divider)",
            fontSize: 13,
            fontWeight: 700,
            transition: "border-color 0.15s, box-shadow 0.15s",
          }}
          className="hover:border-[var(--color-primary)]/30 hover:shadow-sm"
        >
          {en.lectureName || "-"}
        </div>
      ))}
    </div>
  );
}
