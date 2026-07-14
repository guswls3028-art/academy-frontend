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
import { Search, Check, Edit3, Star, Copy, Trash2, Shield, Tag } from "lucide-react";
import { AdminModal, ModalHeader, ModalBody, ModalFooter } from "@/shared/ui/modal";
import { Badge, Button, ICON } from "@/shared/ui/ds";
import { renderPreviewWithActualData, TEMPLATE_CATEGORY_LABELS } from "../constants/templateBlocks";
import type { TemplateCategory } from "../constants/templateBlocks";
import type { MessageTemplateItem } from "../api/messages.api";
import type { ProvidedTemplatePreset } from "../constants/templatePresets";
import {
  getAlimtalkTemplateLabel,
  getAlimtalkTemplateTypeFromCategory,
  renderAlimtalkFullPreview,
} from "./AlimtalkTemplateInfoPanel";
import { hideInternalAlimtalkMemoToken } from "../constants/alimtalkEnvelope";

export type TemplatePickerModalProps = {
  open: boolean;
  onClose: () => void;
  templates: MessageTemplateItem[];
  defaultPresets?: ProvidedTemplatePreset[];
  blockCategory: TemplateCategory;
  selectedTemplateId: number | null;
  selectedPresetId?: string | null;
  alimtalkExtraVars?: Record<string, string>;
  /** 양식 선택 — 모달은 자동 닫힘 */
  onPick: (t: MessageTemplateItem) => void;
  /** 기본 제공 편지지 선택 — 모달은 자동 닫힘 */
  onPickPreset?: (preset: ProvidedTemplatePreset) => void;
  /** 직접 작성 모드 선택 — 모달은 자동 닫힘 */
  onPickFreeForm: () => void;
  onSetDefault: (id: number) => Promise<void> | void;
  onDuplicate: (id: number) => Promise<void> | void;
  onDelete: (id: number) => Promise<void> | void;
};

function isSystemTpl(t: MessageTemplateItem): boolean {
  return t.is_system || t.name.startsWith("[HakwonPlus]") || t.name.startsWith("[학원플러스]");
}

export default function TemplatePickerModal({
  open,
  onClose,
  templates,
  defaultPresets = [],
  blockCategory,
  selectedTemplateId,
  selectedPresetId,
  alimtalkExtraVars,
  onPick,
  onPickPreset,
  onPickFreeForm,
  onSetDefault,
  onDuplicate,
  onDelete,
}: TemplatePickerModalProps) {
  const [search, setSearch] = useState("");
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [previewKey, setPreviewKey] = useState<string | null>(
    selectedPresetId ? `preset:${selectedPresetId}` : selectedTemplateId ? `template:${selectedTemplateId}` : null,
  );
  const [menuOpenId, setMenuOpenId] = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const prevOpenRef = useRef(false);

  // 발송 모달이 열린 시점의 selectedTemplateId를 미리보기 기본으로
  useEffect(() => {
    const justOpened = open && !prevOpenRef.current;
    prevOpenRef.current = open;
    if (justOpened) {
      setPreviewKey(
        selectedPresetId
          ? `preset:${selectedPresetId}`
          : selectedTemplateId
            ? `template:${selectedTemplateId}`
            : defaultPresets[0]
              ? `preset:${defaultPresets[0].id}`
              : null,
      );
      setSearch("");
      setShowAllCategories(false);
      setMenuOpenId(null);
    }
  }, [open, selectedTemplateId, selectedPresetId, defaultPresets]);

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
    const presets = defaultPresets.filter((preset) => {
      if (!q) return true;
      return (
        preset.name.toLowerCase().includes(q)
        || preset.body.toLowerCase().includes(q)
        || preset.description.toLowerCase().includes(q)
      );
    });
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
    return { presets, my, sys };
  }, [defaultPresets, templates, search, blockCategory, showAllCategories]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── 미리보기 대상 ───
  const previewTpl = useMemo(
    () => previewKey?.startsWith("template:")
      ? templates.find((t) => t.id === Number(previewKey.slice("template:".length))) ?? null
      : null,
    [templates, previewKey],
  );
  const previewPreset = useMemo(
    () => previewKey?.startsWith("preset:")
      ? defaultPresets.find((preset) => preset.id === previewKey.slice("preset:".length)) ?? null
      : null,
    [defaultPresets, previewKey],
  );

  const previewSourceBody = hideInternalAlimtalkMemoToken((previewTpl?.body ?? previewPreset?.body) || "");
  const previewSourceCategory = (previewTpl?.category ?? previewPreset?.category ?? blockCategory) as TemplateCategory;
  const previewTemplateName = previewTpl?.name ?? previewPreset?.name ?? "";
  const previewAlimtalkType = getAlimtalkTemplateTypeFromCategory(
    previewSourceCategory,
    previewTemplateName,
    alimtalkExtraVars,
  );
  const previewDisplayBody = previewAlimtalkType
    ? renderAlimtalkFullPreview(previewAlimtalkType, previewSourceBody)
    : previewSourceBody;
  const previewBody = previewTpl || previewPreset
    ? renderPreviewWithActualData(previewDisplayBody, alimtalkExtraVars)
    : null;
  const previewChannelLabel = getAlimtalkTemplateLabel(previewAlimtalkType);

  if (!open) return null;

  const blockLabel = TEMPLATE_CATEGORY_LABELS[blockCategory] ?? "사용자";
  const totalMatched = grouped.presets.length + grouped.my.length + grouped.sys.length;

  // ─── 카드 ───
  const renderCard = (t: MessageTemplateItem) => {
    const isSys = isSystemTpl(t);
    const isPreview = previewKey === `template:${t.id}`;
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
          onClick={() => setPreviewKey(`template:${t.id}`)}
          onDoubleClick={() => { onPick(t); onClose(); }}
          className="tpl-picker__card-body"
        >
          <div className="tpl-picker__card-title-row">
            {isSys && <Shield size={ICON.xs} className="tpl-picker__icon-sys" />}
            <span className="tpl-picker__card-name">{t.name}</span>
            {t.is_user_default && <Badge tone="primary" size="xs">기본</Badge>}
            {t.alimtalk_readiness === "ready" && <Badge tone="success" size="xs">알림톡 준비됨</Badge>}
            {t.alimtalk_readiness === "provider_template_missing" && <Badge tone="warning" size="xs">발송 준비 필요</Badge>}
            {t.alimtalk_readiness === "envelope_selection_required" && <Badge tone="info" size="xs">발송 시 유형 선택</Badge>}
            {isSelected && <Badge tone="info" size="xs">현재 적용</Badge>}
          </div>
          <div className="tpl-picker__card-preview">
            {hideInternalAlimtalkMemoToken(t.body).replace(/#\{[^}]+\}/g, "•").slice(0, 90)}
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
                {isSys ? "복제해서 내 문구로" : "다른 이름으로 복제"}
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

  const renderPresetCard = (preset: ProvidedTemplatePreset) => {
    const isPreview = previewKey === `preset:${preset.id}`;
    const isSelected = selectedPresetId === preset.id;
    return (
      <div
        key={preset.id}
        className="tpl-picker__card tpl-picker__card--preset"
        data-preview={isPreview || undefined}
        data-selected={isSelected || undefined}
      >
        <button
          type="button"
          onClick={() => setPreviewKey(`preset:${preset.id}`)}
          onDoubleClick={() => { onPickPreset?.(preset); onClose(); }}
          className="tpl-picker__card-body"
        >
          <div className="tpl-picker__card-title-row">
            <Tag size={ICON.xs} className="tpl-picker__icon-primary" />
            <span className="tpl-picker__card-name">{preset.name}</span>
            <Badge tone="primary" size="xs">기본 제공</Badge>
            {preset.recommended && <Badge tone="success" size="xs">추천</Badge>}
            {isSelected && <Badge tone="info" size="xs">현재 적용</Badge>}
          </div>
          <div className="tpl-picker__card-preview">
            {preset.description}
          </div>
          {preset.tags && preset.tags.length > 0 && (
            <div className="tpl-picker__card-meta">
              <span>{preset.tags.join(" · ")}</span>
            </div>
          )}
        </button>
      </div>
    );
  };

  return (
    <AdminModal open={open} onClose={onClose} width={1040} zIndex={1100} className="tpl-picker-modal" noMinimize>
      <ModalHeader
        noIcon
        title={
          <div className="tpl-picker__title">
            <span>문구 선택</span>
            <Badge tone="primary" size="sm">{blockLabel}</Badge>
          </div>
        }
        description="보낼 알림톡 문구를 선택하세요. 기본 제공 문구도 바로 수정해서 보낼 수 있습니다."
      />

      <ModalBody>
        <div className="tpl-picker__layout">

          {/* ═══ 좌측: 검색 + 필터 + 카드 리스트 ═══ */}
          <div className="tpl-picker__left">
            <div className="tpl-picker__search">
              <Search size={ICON.sm} className="tpl-picker__search-icon" />
              <Input
                size="middle"
                placeholder="문구 이름·본문 검색…"
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
                  <div className="tpl-picker__freeform-title">직접 작성</div>
                  <div className="tpl-picker__freeform-desc">보낼 안내문을 처음부터 작성합니다</div>
                </div>
              </button>

              {grouped.presets.length > 0 && (
                <>
                  <div className="tpl-picker__group-label">기본 제공 문구 · {grouped.presets.length}</div>
                  {grouped.presets.map(renderPresetCard)}
                </>
              )}

              {grouped.my.length > 0 && (
                <>
                  <div className="tpl-picker__group-label">내 문구 · {grouped.my.length}</div>
                  {grouped.my.map(renderCard)}
                </>
              )}

              {grouped.sys.length > 0 && (
                <>
                  <div className="tpl-picker__group-label">기본 문구 · {grouped.sys.length}</div>
                  {grouped.sys.map(renderCard)}
                </>
              )}

              {totalMatched === 0 && (
                <div className="tpl-picker__empty">
                  {search
                    ? "검색 결과가 없습니다."
                    : showAllCategories
                    ? "저장된 문구가 없습니다."
                    : `'${blockLabel}' 카테고리에 등록된 문구가 없습니다. 위 '전체 카테고리 보기'를 켜면 다른 카테고리 문구도 볼 수 있습니다.`}
                </div>
              )}
            </div>
          </div>

          {/* ═══ 우측: 미리보기 ═══ */}
          <div className="tpl-picker__right">
            {previewTpl || previewPreset ? (
              <>
                <div className="tpl-picker__preview-header">
                  <div className="tpl-picker__preview-title-row">
                    {previewTpl && isSystemTpl(previewTpl) && <Shield size={ICON.sm} className="tpl-picker__icon-sys" />}
                    {previewPreset && <Tag size={ICON.sm} className="tpl-picker__icon-primary" />}
                    <span className="tpl-picker__preview-name">{previewTpl?.name ?? previewPreset?.name}</span>
                  </div>
                  <div className="tpl-picker__preview-meta">
                    <span>
                      {previewTpl
                        ? (TEMPLATE_CATEGORY_LABELS[previewTpl.category as TemplateCategory] ?? previewTpl.category)
                        : (TEMPLATE_CATEGORY_LABELS[previewPreset!.category] ?? previewPreset!.category)}
                    </span>
                    {previewPreset && <Badge tone="primary" size="xs">기본 제공</Badge>}
                    {previewPreset?.recommended && <Badge tone="success" size="xs">추천</Badge>}
                    {previewTpl?.alimtalk_readiness === "ready" && <Badge tone="success" size="xs">알림톡 준비됨</Badge>}
                    {previewTpl?.alimtalk_readiness === "provider_template_missing" && <Badge tone="warning" size="xs">발송 준비 필요</Badge>}
                    {previewTpl && isSystemTpl(previewTpl) && <Badge tone="info" size="xs">시스템</Badge>}
                  </div>
                </div>

                <div className="tpl-picker__preview-card">
                  <div className="template-preview-kakao__header">
                    <span className="template-preview-kakao__header-label">알림톡 도착</span>
                    <span className="template-preview-kakao__header-channel">{previewChannelLabel}</span>
                  </div>
                  {previewTpl?.subject && (
                    <div className="template-preview-kakao__title">{previewTpl.subject}</div>
                  )}
                  <div className="template-preview-kakao__body">{previewBody}</div>
                </div>

                <div className="tpl-picker__preview-actions">
                  <Button
                    intent="primary"
                    size="lg"
                    onClick={() => {
                      if (previewTpl) onPick(previewTpl);
                      else if (previewPreset) onPickPreset?.(previewPreset);
                      onClose();
                    }}
                    className="tpl-picker__apply-btn"
                  >
                    <Check size={ICON.sm} className="tpl-picker__apply-icon" />
                    이 문구 적용
                  </Button>
                </div>
              </>
            ) : (
              <div className="tpl-picker__preview-empty">
                <Tag size={ICON.xl} className="tpl-picker__icon-empty" />
                <div className="tpl-picker__preview-empty-text">
                  좌측에서 문구를 선택하면<br />여기에 미리보기가 표시됩니다
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
