// PATH: src/app_admin/domains/messages/components/TemplatePickerModal.tsx
//
// 알림톡 양식 선택 전용 큰 모달 — SendMessageModal에서 분리 (2026-05-13).
// 좁은 인라인 패널 대신 별도 1040px 모달로 띄워 카테고리 필터·검색·미리보기 공간 확보.
//
// 구조:
//   좌: 카테고리 필터 + 검색 + 양식 카드 리스트 (직접 작성 / 내 양식 / 시스템 기본)
//   우: 선택한 양식의 본문 미리보기 + 액션 버튼
//
// 기본 카테고리 필터 = blockCategory 일치 양식만. "전체 보기" 토글로 모든 카테고리 노출.
//
// 부모 책임: templates 목록 fetch + handlers (set default/duplicate/delete) 제공.
// 자식 책임: 필터·검색·미리보기·픽킹 UX만.
//
// SendMessageModal의 좁은 우측 패널을 그대로 이관 + 검색·필터·미리보기 영역 확장.
// 학원장 임근혁 보고: "양식 선택 영역이 좁고 불편" — 별도 큰 팝업으로 격리.

import { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "antd";
import { Search, Check, Edit3, Star, Copy, Trash2, Shield, Tag, RefreshCw } from "lucide-react";
import { AdminModal, ModalHeader, ModalBody, ModalFooter } from "@/shared/ui/modal";
import { Badge, Button, ICON } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import { renderPreviewWithActualData, TEMPLATE_CATEGORY_LABELS } from "../constants/templateBlocks";
import type { TemplateCategory } from "../constants/templateBlocks";
import { syncSolapiTemplates, type MessageTemplateItem } from "../api/messages.api";

export type TemplatePickerModalProps = {
  open: boolean;
  onClose: () => void;
  templates: MessageTemplateItem[];
  blockCategory: TemplateCategory;
  selectedTemplateId: number | null;
  alimtalkExtraVars?: Record<string, string>;
  /** 양식 선택 — 모달은 자동 닫힘 */
  onPick: (t: MessageTemplateItem) => void;
  /** 직접 작성 모드 선택 — 모달은 자동 닫힘 */
  onPickFreeForm: () => void;
  onSetDefault: (id: number) => Promise<void> | void;
  onDuplicate: (id: number) => Promise<void> | void;
  onDelete: (id: number) => Promise<void> | void;
  /** 솔라피 동기화 직후 부모가 templates 재조회 */
  onRefreshTemplates: () => Promise<void> | void;
};

function isSystemTpl(t: MessageTemplateItem): boolean {
  return t.is_system || t.name.startsWith("[HakwonPlus]") || t.name.startsWith("[학원플러스]");
}

export default function TemplatePickerModal({
  open,
  onClose,
  templates,
  blockCategory,
  selectedTemplateId,
  alimtalkExtraVars,
  onPick,
  onPickFreeForm,
  onSetDefault,
  onDuplicate,
  onDelete,
  onRefreshTemplates,
}: TemplatePickerModalProps) {
  const [search, setSearch] = useState("");
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [previewId, setPreviewId] = useState<number | null>(selectedTemplateId);
  const [menuOpenId, setMenuOpenId] = useState<number | null>(null);
  const [syncing, setSyncing] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const prevOpenRef = useRef(false);

  const handleSync = async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      const res = await syncSolapiTemplates();
      await onRefreshTemplates();
      if (res.updated > 0 || res.solapi_only_count > 0) {
        const parts: string[] = [];
        if (res.updated > 0) parts.push(`검수 상태 ${res.updated}건 갱신`);
        if (res.solapi_only_count > 0) parts.push(`솔라피에만 있는 양식 ${res.solapi_only_count}건`);
        feedback.success(`동기화 — ${parts.join(", ")}`);
      } else {
        feedback.success(`동기화 완료 — 모든 양식의 검수 상태가 최신입니다 (${res.unchanged}건 확인).`);
      }
      if (res.errors && res.errors.length > 0) {
        feedback.warning(`동기화 중 ${res.errors.length}건 오류가 있었습니다. 자세한 내용은 관리자에게 문의해 주세요.`);
      }
    } catch (e: unknown) {
      const msg = e && typeof e === "object" && "response" in e
        ? (e as { response?: { data?: { detail?: string } } }).response?.data?.detail
        : null;
      feedback.error((typeof msg === "string" ? msg : "솔라피 동기화에 실패했습니다."));
    } finally {
      setSyncing(false);
    }
  };

  // 발송 모달이 열린 시점의 selectedTemplateId를 미리보기 기본으로
  useEffect(() => {
    const justOpened = open && !prevOpenRef.current;
    prevOpenRef.current = open;
    if (justOpened) {
      setPreviewId(selectedTemplateId);
      setSearch("");
      setShowAllCategories(false);
      setMenuOpenId(null);
    }
  }, [open, selectedTemplateId]);

  useEffect(() => {
    if (menuOpenId == null) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpenId(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpenId]);

  // ─── 카테고리 일치 판정 ───
  // backend가 발송 모달 카테고리와 1:1 매칭되는 카테고리만 보내주는 게 정상이지만
  // 안전망 — 클라이언트도 한 번 더 필터.
  const categoryMatches = (t: MessageTemplateItem): boolean => {
    if (showAllCategories) return true;
    if (t.category === "signup") return false;
    if (blockCategory === "default" || blockCategory === "student") {
      // 학생 일반 발송 — default 양식 + (편의상) 시스템 기본 양식은 보임.
      // MessageTemplateCategory enum 에는 "student" 가 없음 (backend 카테고리는 12종, frontend
      // blockCategory 만 추가로 "student" 보유) — t.category 비교에서는 "default" 만.
      return t.category === "default" || isSystemTpl(t);
    }
    return t.category === blockCategory;
  };

  // ─── 필터링 + 그룹화 ───
  const grouped = useMemo(() => {
    const q = search.toLowerCase().trim();
    const matched = templates.filter((t) => {
      if (!categoryMatches(t)) return false;
      if (!q) return true;
      return t.name.toLowerCase().includes(q) || t.body.toLowerCase().includes(q);
    });
    const my: MessageTemplateItem[] = [];
    const sys: MessageTemplateItem[] = [];
    for (const t of matched) {
      if (isSystemTpl(t)) sys.push(t);
      else my.push(t);
    }
    return { my, sys };
  }, [templates, search, blockCategory, showAllCategories]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── 미리보기 대상 ───
  const previewTpl = useMemo(
    () => templates.find((t) => t.id === previewId) ?? null,
    [templates, previewId],
  );

  const previewBody = previewTpl
    ? renderPreviewWithActualData(previewTpl.body, alimtalkExtraVars)
    : null;

  if (!open) return null;

  const blockLabel = TEMPLATE_CATEGORY_LABELS[blockCategory] ?? "사용자";
  const totalMatched = grouped.my.length + grouped.sys.length;

  // ─── 카드 ───
  const renderCard = (t: MessageTemplateItem) => {
    const isSys = isSystemTpl(t);
    const isPreview = previewId === t.id;
    const isSelected = selectedTemplateId === t.id;
    return (
      <div
        key={t.id}
        className="tpl-picker__card"
        data-preview={isPreview || undefined}
        data-selected={isSelected || undefined}
      >
        <button
          type="button"
          onClick={() => setPreviewId(t.id)}
          onDoubleClick={() => { onPick(t); onClose(); }}
          className="tpl-picker__card-body"
        >
          <div className="tpl-picker__card-title-row">
            {isSys && <Shield size={ICON.xs} className="tpl-picker__icon-sys" />}
            <span className="tpl-picker__card-name">{t.name}</span>
            {t.is_user_default && <Badge tone="primary" size="xs">기본</Badge>}
            {t.solapi_status === "APPROVED" && <Badge tone="success" size="xs">승인</Badge>}
            {isSelected && <Badge tone="info" size="xs">현재 적용</Badge>}
          </div>
          <div className="tpl-picker__card-preview">
            {t.body.replace(/#\{[^}]+\}/g, "•").slice(0, 90)}
          </div>
          <div className="tpl-picker__card-meta">
            <Tag size={ICON.xs} className="tpl-picker__icon-muted" />
            <span>{TEMPLATE_CATEGORY_LABELS[t.category as TemplateCategory] ?? t.category}</span>
          </div>
        </button>

        <div ref={menuOpenId === t.id ? menuRef : undefined} className="tpl-picker__card-menu">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setMenuOpenId(menuOpenId === t.id ? null : t.id); }}
            className="tpl-picker__card-menu-btn"
            aria-label="더보기"
          >
            ⋯
          </button>
          {menuOpenId === t.id && (
            <div className="tpl-picker__card-menu-popup">
              <button type="button" onClick={() => { onSetDefault(t.id); setMenuOpenId(null); }} className="tpl-picker__card-menu-item">
                <Star size={ICON.xs} className={t.is_user_default ? "tpl-picker__menu-star--active" : "tpl-picker__menu-star--idle"} />
                {t.is_user_default ? "기본 해제" : "기본으로 지정"}
              </button>
              <button type="button" onClick={() => { onDuplicate(t.id); setMenuOpenId(null); }} className="tpl-picker__card-menu-item">
                <Copy size={ICON.xs} className="tpl-picker__icon-muted" />
                {isSys ? "복제해서 내 양식으로" : "다른 이름으로 복제"}
              </button>
              {!isSys && (
                <button type="button" onClick={() => { onDelete(t.id); setMenuOpenId(null); }} className="tpl-picker__card-menu-item tpl-picker__card-menu-item--danger">
                  <Trash2 size={ICON.xs} />
                  삭제
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <AdminModal open={open} onClose={onClose} width={1040} zIndex={1100} className="tpl-picker-modal" noMinimize>
      <ModalHeader
        noIcon
        title={
          <div className="tpl-picker__title">
            <span>양식 선택</span>
            <Badge tone="primary" size="sm">{blockLabel}</Badge>
          </div>
        }
        description="발송할 알림톡 양식을 선택하세요. 카드를 클릭하면 미리보기, 두 번 클릭하면 바로 적용됩니다."
      />

      <ModalBody>
        <div className="tpl-picker__layout">

          {/* ═══ 좌측: 검색 + 필터 + 카드 리스트 ═══ */}
          <div className="tpl-picker__left">
            <div className="tpl-picker__sync-bar">
              <div className="tpl-picker__sync-text">
                <div className="tpl-picker__sync-title">검수 상태 동기화</div>
                <div className="tpl-picker__sync-desc">솔라피 콘솔의 카카오 검수 결과(APPROVED/REJECTED)를 가져옵니다. 본문은 학원장 영역이라 절대 덮어쓰지 않습니다.</div>
              </div>
              <Button
                size="sm"
                intent="secondary"
                onClick={handleSync}
                disabled={syncing}
              >
                <RefreshCw size={ICON.xs} className={`tpl-picker__sync-icon${syncing ? " tpl-picker__sync-icon--spinning" : ""}`} />
                {syncing ? "동기화 중…" : "동기화"}
              </Button>
            </div>

            <div className="tpl-picker__search">
              <Search size={ICON.sm} className="tpl-picker__search-icon" />
              <Input
                size="middle"
                placeholder="양식 이름·본문 검색…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="tpl-picker__search-input"
                allowClear
                autoFocus
              />
            </div>

            <div className="tpl-picker__filter-bar">
              <label className="tpl-picker__filter-check">
                <input
                  type="checkbox"
                  checked={showAllCategories}
                  onChange={(e) => setShowAllCategories(e.target.checked)}
                />
                <span>전체 카테고리 보기</span>
              </label>
              <span className="tpl-picker__filter-count">{totalMatched}개</span>
            </div>

            <div className="tpl-picker__list">
              {/* 직접 작성 — 항상 최상단 */}
              <button
                type="button"
                onClick={() => { onPickFreeForm(); onClose(); }}
                className="tpl-picker__freeform-btn"
              >
                <Edit3 size={ICON.sm} className="tpl-picker__icon-primary" />
                <div className="tpl-picker__freeform-text">
                  <div className="tpl-picker__freeform-title">직접 작성하기</div>
                  <div className="tpl-picker__freeform-desc">양식 없이 본문을 처음부터 작성합니다</div>
                </div>
              </button>

              {grouped.my.length > 0 && (
                <>
                  <div className="tpl-picker__group-label">내 양식 · {grouped.my.length}</div>
                  {grouped.my.map(renderCard)}
                </>
              )}

              {grouped.sys.length > 0 && (
                <>
                  <div className="tpl-picker__group-label">시스템 기본 양식 · {grouped.sys.length}</div>
                  {grouped.sys.map(renderCard)}
                </>
              )}

              {totalMatched === 0 && (
                <div className="tpl-picker__empty">
                  {search
                    ? "검색 결과가 없습니다."
                    : showAllCategories
                    ? "저장된 양식이 없습니다."
                    : `'${blockLabel}' 카테고리에 등록된 양식이 없습니다. 위 '전체 카테고리 보기'를 켜면 다른 카테고리 양식도 볼 수 있습니다.`}
                </div>
              )}
            </div>
          </div>

          {/* ═══ 우측: 미리보기 ═══ */}
          <div className="tpl-picker__right">
            {previewTpl ? (
              <>
                <div className="tpl-picker__preview-header">
                  <div className="tpl-picker__preview-title-row">
                    {isSystemTpl(previewTpl) && <Shield size={ICON.sm} className="tpl-picker__icon-sys" />}
                    <span className="tpl-picker__preview-name">{previewTpl.name}</span>
                  </div>
                  <div className="tpl-picker__preview-meta">
                    <span>{TEMPLATE_CATEGORY_LABELS[previewTpl.category as TemplateCategory] ?? previewTpl.category}</span>
                    {previewTpl.solapi_status === "APPROVED" && <Badge tone="success" size="xs">승인</Badge>}
                    {isSystemTpl(previewTpl) && <Badge tone="info" size="xs">시스템</Badge>}
                  </div>
                </div>

                <div className="tpl-picker__preview-card">
                  {previewTpl.subject && (
                    <div className="template-preview-kakao__title">{previewTpl.subject}</div>
                  )}
                  <div className="template-preview-kakao__body">{previewBody}</div>
                </div>

                <div className="tpl-picker__preview-actions">
                  <Button
                    intent="primary"
                    size="lg"
                    onClick={() => { onPick(previewTpl); onClose(); }}
                    className="tpl-picker__apply-btn"
                  >
                    <Check size={ICON.sm} className="tpl-picker__apply-icon" />
                    이 양식 적용
                  </Button>
                </div>
              </>
            ) : (
              <div className="tpl-picker__preview-empty">
                <Tag size={ICON.xl} className="tpl-picker__icon-empty" />
                <div className="tpl-picker__preview-empty-text">
                  좌측에서 양식을 선택하면<br />여기에 미리보기가 표시됩니다
                </div>
              </div>
            )}
          </div>
        </div>
      </ModalBody>

      <ModalFooter
        right={
          <Button intent="secondary" onClick={onClose} size="lg">닫기</Button>
        }
      />
    </AdminModal>
  );
}
