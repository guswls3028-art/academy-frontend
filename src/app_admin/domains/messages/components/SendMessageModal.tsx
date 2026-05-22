// PATH: src/app_admin/domains/messages/components/SendMessageModal.tsx
//
// 공용 메시지 발송 모달 — 알림톡 단독 SSOT (학원장 임근혁 보고: SMS 경로 폐기, 2026-05-12)
//
// 좌: 수신자/일괄안내/적용양식/카톡 미리보기/변수 상태 (단일 카드 묶음)
// 우: 양식 선택 바 → 본문 textarea → (접이식 변수 팔레트)
// footer: [취소] [발송하기]
//
// 모든 진입점(학생·출결·성적·클리닉·직원)에서 동일 UX. 단발성 발송 SSOT.
//
// 2026-05-13 양식 선택 분리:
//   - 인라인 양식 패널/검색/카드리스트 제거 — `TemplatePickerModal`로 분리 (별도 1040px 팝업)
//   - 학원장 임근혁 보고: "양식 지정·선택 영역이 좁고 불편" → 별도 큰 모달로 격리
//   - 카테고리 필터 + "전체 보기" 토글로 다른 카테고리 양식 섞임 방지
//   - 자동 선택 우선순위: 본 테넌트 양식 (카테고리 일치 + 기본 지정) > 시스템 기본

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Input } from "antd";
import { Check, AlertCircle, AlertTriangle, Edit3, Tag, Shield } from "lucide-react";
import { AdminModal, ModalHeader, ModalBody, ModalFooter } from "@/shared/ui/modal";
import { Badge, Button, ICON } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import { useConfirm } from "@/shared/ui/confirm";
import { asyncStatusStore } from "@/shared/ui/asyncStatus/asyncStatusStore";
import {
  fetchMessageTemplates,
  sendMessage,
  createMessageTemplate,
  updateMessageTemplate,
  deleteMessageTemplate,
  setTemplateDefault,
  duplicateMessageTemplate,
  type MessageTemplateItem,
  type SendToType,
} from "../api/messages.api";
import {
  TEMPLATE_CATEGORY_LABELS,
  getBlocksForCategory,
  getBlockColor,
  renderPreviewWithActualData,
  ALWAYS_AVAILABLE_VARS,
} from "../constants/templateBlocks";
import type { TemplateCategory } from "../constants/templateBlocks";
import {
  getDefaultTemplatePreset,
  getTemplatePresetsForCategory,
  toPersistedTemplateCategory,
  type ProvidedTemplatePreset,
} from "../constants/templatePresets";
import GradesBlockPanel from "./GradesBlockPanel";
import TemplatePickerModal from "./TemplatePickerModal";
import {
  getAlimtalkTemplateTypeFromCategory,
  renderAlimtalkFullPreview,
} from "./AlimtalkTemplateInfoPanel";
import { lintAlimtalkTemplateQuality } from "../utils/templateQuality";
import "../styles/templateEditor.css";

// ─── Types ───

export type SendMessageModalProps = {
  open: boolean;
  onClose: () => void;
  initialStudentIds?: number[];
  initialStaffIds?: number[];
  recipientLabel?: string;
  blockCategory?: TemplateCategory;
  initialBody?: string;
  initialTemplateId?: number | null;
  initialLetterPresetId?: string | null;
  alimtalkExtraVars?: Record<string, string>;
  /** 학생별 개별 치환 변수 — key: student_id (대량 성적 발송 등) */
  alimtalkExtraVarsPerStudent?: Record<number, Record<string, string>>;
  /**
   * 학원장이 textarea에서 본문 수정 시 학생별 변수(_body_subst 포함) 재계산 callback.
   * 제공 시 body 변경마다 호출 → 최신 본문 기반 학생별 substituted body 생성.
   * 미제공 시 alimtalkExtraVarsPerStudent prop을 그대로 사용 (사전 계산값 고정).
   * ref 형태로 받아 SendMessageModalContext가 close 시 자동 cleanup.
   */
  recomputePerStudentVarsRef?: React.MutableRefObject<((currentBody: string) => Record<number, Record<string, string>>) | undefined>;
};

// ─── Helpers ───

function isSystemTpl(t: MessageTemplateItem): boolean {
  return t.is_system || t.name.startsWith("[HakwonPlus]") || t.name.startsWith("[학원플러스]");
}

function extractVars(body: string): string[] {
  const matches = body.match(/#\{([^}]+)\}/g) ?? [];
  return [...new Set(matches.map((m) => m.slice(2, -1)))];
}

type VarStatus = { name: string; status: "auto" | "provided" | "missing"; value?: string };

function getVarStatuses(
  templateBody: string,
  extraVars?: Record<string, string>,
  freeContent?: string,
): VarStatus[] {
  return extractVars(templateBody).map((name) => {
    if (name === "내용") {
      return { name, status: freeContent?.trim() ? "provided" : "missing", value: freeContent?.trim() || undefined };
    }
    if (ALWAYS_AVAILABLE_VARS.has(name)) return { name, status: "auto" as const };
    if (extraVars && name in extraVars && extraVars[name]) {
      return { name, status: "provided" as const, value: extraVars[name] };
    }
    return { name, status: "missing" as const };
  });
}

/**
 * 자동 선택 우선순위:
 *   1. 본 테넌트 양식: 카테고리 일치 + 기본 지정
 *   2. 본 테넌트 양식: 카테고리 일치 (가장 최근)
 *   3. 기본 제공 편지지
 *   4. 시스템 기본 (최후 호환)
 */
function pickAutoSelectTemplate(
  list: MessageTemplateItem[],
  blockCategory: TemplateCategory,
  systemOnly = false,
): MessageTemplateItem | undefined {
  const systemCategoryMap: Record<string, string> = {
    clinic: "clinic", attendance: "attendance", exam: "exam",
    grades: "grades", assignment: "assignment", payment: "payment",
    lecture: "attendance", // 강의 발송도 출석 시스템 양식 fallback
    student: "default", default: "default",
    notice: "default", community: "default", staff: "default",
  };
  const systemCat = systemCategoryMap[blockCategory] || "default";
  const userCat = blockCategory === "student" ? "default" : blockCategory;

  if (!systemOnly) {
    const myMatchDefault = list.find((t) => !isSystemTpl(t) && t.category === userCat && t.is_user_default);
    if (myMatchDefault) return myMatchDefault;

    const myMatch = list.find((t) => !isSystemTpl(t) && t.category === userCat);
    if (myMatch) return myMatch;
  }

  const sysMatch = list.find((t) => isSystemTpl(t) && t.category === systemCat);
  if (sysMatch) return sysMatch;

  const sysDefault = list.find((t) => isSystemTpl(t) && t.is_user_default);
  if (sysDefault) return sysDefault;

  return list.find((t) => isSystemTpl(t));
}

// ═══════════════════════════════════════════════════════════════
// ─── Main Component ───
// ═══════════════════════════════════════════════════════════════

export default function SendMessageModal({
  open,
  onClose,
  initialStudentIds = [],
  initialStaffIds = [],
  recipientLabel,
  blockCategory = "default",
  initialBody,
  initialTemplateId,
  initialLetterPresetId,
  alimtalkExtraVars,
  alimtalkExtraVarsPerStudent,
  recomputePerStudentVarsRef,
}: SendMessageModalProps) {
  const queryClient = useQueryClient();
  const confirm = useConfirm();

  // ─── State ───
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [freeContent] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [sendToParent, setSendToParent] = useState(true);
  const [sendToStudent, setSendToStudent] = useState(true);
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);
  const [templates, setTemplates] = useState<MessageTemplateItem[]>([]);
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [saveTemplateName, setSaveTemplateName] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);
  /** 양식 선택 모달 open */
  const [showPickerModal, setShowPickerModal] = useState(false);
  /** 양식 없이 자유 입력 모드 */
  const [alimtalkFreeForm, setAlimtalkFreeForm] = useState(false);
  const [templateBodySnapshot, setTemplateBodySnapshot] = useState<string | null>(null);
  // 변수 팔레트 default 접힘 (학원장 임근혁 보고 — 본문 편집 영역이 좁아 보임)
  const [showVarPalette, setShowVarPalette] = useState(false);
  const bodyWrapRef = useRef<HTMLDivElement>(null);
  const prevOpenRef = useRef(false);
  const getNativeTextarea = useCallback(
    () => bodyWrapRef.current?.querySelector("textarea") ?? null, [],
  );

  // ─── Derived ───
  const isStaffMode = (initialStaffIds?.length ?? 0) > 0;
  const studentIds = initialStudentIds;
  const staffIds = initialStaffIds ?? [];
  const hasRecipients = isStaffMode ? staffIds.length > 0 : studentIds.length > 0;
  const recipientCount = isStaffMode ? staffIds.length : studentIds.length;
  const sendToTargets: SendToType[] = isStaffMode
    ? ["staff"]
    : (() => {
        const t: SendToType[] = [];
        if (sendToParent) t.push("parent");
        if (sendToStudent) t.push("student");
        return t;
      })();

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);
  const providedPresets = useMemo(() => getTemplatePresetsForCategory(blockCategory), [blockCategory]);
  const selectedPreset = providedPresets.find((p) => p.id === selectedPresetId) ?? null;
  const bodyModified = selectedTemplate != null && templateBodySnapshot != null && body !== templateBodySnapshot;
  const presetBodyModified = selectedPreset != null && templateBodySnapshot != null && body !== templateBodySnapshot;
  const hasSelectedBodySource = !!selectedTemplate || !!selectedPreset || alimtalkFreeForm;

  // 변수 상태는 selectedTemplate.body 기준 (이전 logic 복원, 2026-05-14 hotfix).
  // 직전 fix에서 body 기준으로 변경했더니 학원장 양식의 #{시험1명}/#{시험1}/#{시험1만점} 등
  // score sub-변수가 ALWAYS_AVAILABLE_VARS에 없어 missing으로 잡혀 발송 버튼 disabled 됨
  // (학원장 limglish 보고). 양식 변수는 backend가 학생별 자동 치환 → frontend가 차단할 이유 없음.
  // body 수정 path 의도(학원장이 양식 변수 일부 제거해도 발송 가능)는 양식 자체 편집 UI로 따로 해결.
  const varStatuses = useMemo(() => {
    const sourceBody = selectedTemplate?.body ?? selectedPreset?.body ?? "";
    if (!sourceBody) return [];
    return getVarStatuses(sourceBody, alimtalkExtraVars, freeContent);
  }, [selectedTemplate, selectedPreset, alimtalkExtraVars, freeContent]);

  // ─── Can Send ───
  // missing 변수 — #{내용}/#{공지내용}/#{선생님메모} 등 학원장 편집 영역(편지)이 비어있거나
  // 자동 채움 외 카테고리 변수가 missing 이면 카카오 발송 시 빈 슬롯 또는 backend 차단.
  // 학원장이 발송 후 silent fail 보지 않도록 사전 차단.
  const missingVarNames = varStatuses
    .filter((v) => v.status === "missing")
    .map((v) => v.name);
  const hasMissingVars = missingVarNames.length > 0;
  const qualityIssues = useMemo(() => {
    if (!body.trim()) return [];
    return lintAlimtalkTemplateQuality({
      body,
      renderedBody: body,
      blockCategory,
      templateCategory: selectedTemplate?.category ?? (selectedPreset ? toPersistedTemplateCategory(selectedPreset.category) : undefined),
      templateName: selectedTemplate?.name ?? selectedPreset?.name,
      extraVars: alimtalkExtraVars,
    });
  }, [body, blockCategory, selectedTemplate, selectedPreset, alimtalkExtraVars]);
  const qualityBlockers = qualityIssues.filter((issue) => issue.severity === "blocker");
  const hasQualityBlockers = qualityBlockers.length > 0;

  const canSend = (() => {
    if (!hasRecipients || sendToTargets.length === 0 || sending) return false;
    if (!hasSelectedBodySource) return false;
    if (!body.trim()) return false;
    if (hasMissingVars) return false;
    if (hasQualityBlockers) return false;
    return true;
  })();

  const blocks = useMemo(() => getBlocksForCategory(blockCategory), [blockCategory]);

  // ─── Preview ───
  // SSOT (2026-05-14): preview는 학원장이 textarea에 친 body 기준 (selectedTemplate.body 무시).
  // 직전 결함: 양식 자동 매칭 시 preview가 DB 원본 template 고정 → 학원장 본문 수정이 preview에 안 보임.
  // 학원장이 친 본문이 곧 발송 본문 → 그대로 preview에 노출되어야 일치.
  const previewBody = renderPreviewWithActualData(body, alimtalkExtraVars, freeContent);

  // 카카오 봉투 미리보기용 letterBody.
  // 성적 발송은 선생님이 양식 자체를 검수해야 하므로 raw template을 보여주고,
  // 그 외 단건 알림은 기존처럼 첫 수신자 기준 치환 미리보기를 유지한다.
  const previewLetterBody = useMemo(() => {
    if (!body) return "";
    if (blockCategory === "grades") return body;
    if (!recomputePerStudentVarsRef?.current) return body;
    try {
      const perStudent = recomputePerStudentVarsRef.current(body);
      const firstKey = Object.keys(perStudent)[0];
      const subst = firstKey ? perStudent[Number(firstKey)]?._body_subst : undefined;
      return subst || body;
    } catch {
      return body;
    }
  }, [body, blockCategory, recomputePerStudentVarsRef]);
  const previewSubject = subject
    ? renderPreviewWithActualData(subject, alimtalkExtraVars)
    : selectedTemplate
      ? renderPreviewWithActualData(selectedTemplate.subject || "", alimtalkExtraVars)
      : subject;

  const [showConfirm, setShowConfirm] = useState(false);

  // ─── Reset on open ───
  useEffect(() => {
    const justOpened = open && !prevOpenRef.current;
    prevOpenRef.current = open;
    if (!justOpened) return;
    setSubject("");
    setBody(initialBody ?? "");
    setSelectedTemplateId(initialTemplateId ?? null);
    setSelectedPresetId(initialLetterPresetId ?? null);
    setSendToParent(true);
    setSendToStudent(true);
    setShowSaveForm(false);
    setSaveTemplateName("");
    setShowPickerModal(false);
    setAlimtalkFreeForm(Boolean(initialBody && !initialTemplateId && !initialLetterPresetId));
    setTemplateBodySnapshot(initialBody ?? null);
    setShowConfirm(false);
    sendingRef.current = false;
  }, [open, initialBody, initialTemplateId, initialLetterPresetId]);

  // 자동 선택: 본 테넌트 양식 (카테고리 일치) > 시스템 기본.
  // initialBody가 있어도 봉투(카카오 검수 통과 4종)는 카테고리에 맞춰 자동 선택해야 함.
  // 학원장 mental model: 봉투는 시스템이 매칭, #{선생님메모}만 학원장 자유 작성.
  // initialBody는 양식 body 대신 #{선생님메모} 자리에 들어가도록 body로 유지.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetchMessageTemplates(undefined, true).then((list) => {
      if (cancelled) return;
      setTemplates(list);
      if (!selectedTemplateId && !selectedPresetId && !initialBody) {
        const match = pickAutoSelectTemplate(list, blockCategory);
        if (match) {
          setSelectedTemplateId(match.id);
          setSelectedPresetId(null);
          setBody(match.body);
          // initialBody가 있으면 학원장 작성 본문이 곧 발송 본문 → snapshot 동기화로 "수정됨" 오인 방지
          setTemplateBodySnapshot(match.body);
          setAlimtalkFreeForm(false);
        } else {
          const preset = getDefaultTemplatePreset(blockCategory);
          if (preset) {
            setSelectedPresetId(preset.id);
            setBody(preset.body);
            setTemplateBodySnapshot(preset.body);
            setAlimtalkFreeForm(false);
          } else {
            const systemMatch = pickAutoSelectTemplate(list, blockCategory, true);
            if (systemMatch) {
              setSelectedTemplateId(systemMatch.id);
              setSelectedPresetId(null);
              setBody(systemMatch.body);
              setTemplateBodySnapshot(systemMatch.body);
              setAlimtalkFreeForm(false);
            }
          }
        }
      }
    }).catch(() => { if (!cancelled) setTemplates([]); });
    return () => { cancelled = true; };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // 솔라피 동기화 후 picker가 부모에게 templates 재조회 요청
  const refreshTemplates = useCallback(async () => {
    try {
      const list = await fetchMessageTemplates(undefined, true);
      setTemplates(list);
      // 현재 적용 중인 양식이 sync 후에도 유지되도록 body/snapshot 갱신
      if (selectedTemplateId) {
        const fresh = list.find((t) => t.id === selectedTemplateId);
        if (fresh && fresh.body !== templateBodySnapshot) {
          setBody(fresh.body);
          setTemplateBodySnapshot(fresh.body);
        }
      }
    } catch {
      // refresh 실패는 silent — 다음 모달 open 시 재시도됨
    }
  }, [selectedTemplateId, templateBodySnapshot]);

  // ─── Actions ───
  const insertBlock = useCallback((insertText: string) => {
    const ta = getNativeTextarea();
    if (!ta) { setBody((prev) => prev + insertText); return; }
    const start = ta.selectionStart ?? ta.value.length;
    const end = ta.selectionEnd ?? start;
    setBody((prev) => prev.slice(0, start) + insertText + prev.slice(end));
    const newPos = start + insertText.length;
    requestAnimationFrame(() => { ta.focus(); ta.setSelectionRange(newPos, newPos); });
  }, [getNativeTextarea]);

  const selectTemplate = useCallback((t: MessageTemplateItem) => {
    setSelectedTemplateId(t.id);
    setSelectedPresetId(null);
    setSubject(t.subject ?? "");
    setBody(t.body ?? "");
    setTemplateBodySnapshot(t.body ?? "");
    setAlimtalkFreeForm(false);
  }, []);

  const selectPreset = useCallback((preset: ProvidedTemplatePreset) => {
    setSelectedTemplateId(null);
    setSelectedPresetId(preset.id);
    setSubject("");
    setBody(preset.body);
    setTemplateBodySnapshot(preset.body);
    setAlimtalkFreeForm(false);
  }, []);

  const selectFreeForm = useCallback(() => {
    setSelectedTemplateId(null);
    setSelectedPresetId(null);
    setBody("");
    setSubject("");
    setTemplateBodySnapshot(null);
    setAlimtalkFreeForm(true);
  }, []);

  const handleSaveTemplate = async () => {
    if (!saveTemplateName.trim() || !body.trim() || savingTemplate) return;
    setSavingTemplate(true);
    try {
      const created = await createMessageTemplate({
        category: toPersistedTemplateCategory(blockCategory),
        name: saveTemplateName.trim(),
        subject: subject || "",
        body,
      });
      setTemplates((prev) => [created, ...prev]);
      setSelectedTemplateId(created.id);
      setSelectedPresetId(null);
      setTemplateBodySnapshot(created.body);
      feedback.success(`"${created.name}" 양식이 저장되었습니다.`);
      setShowSaveForm(false);
      setSaveTemplateName("");
    } catch {
      feedback.error("양식 저장에 실패했습니다.");
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleUpdateTemplate = async () => {
    if (!selectedTemplate || isSystemTpl(selectedTemplate) || !body.trim()) return;
    try {
      const updated = await updateMessageTemplate(selectedTemplate.id, { body, subject });
      setTemplates((prev) => prev.map((t) => t.id === updated.id ? updated : t));
      setTemplateBodySnapshot(updated.body);
      feedback.success(`"${updated.name}" 양식이 업데이트되었습니다.`);
    } catch {
      feedback.error("양식 업데이트에 실패했습니다.");
    }
  };

  const handleSetDefault = async (id: number) => {
    try {
      const updated = await setTemplateDefault(id);
      setTemplates((prev) => prev.map((t) => {
        if (t.id === id) return updated;
        if (t.category === updated.category && t.is_user_default && t.id !== id) {
          return { ...t, is_user_default: false };
        }
        return t;
      }));
      feedback.success(updated.is_user_default ? `"${updated.name}" 을(를) 기본 양식으로 지정했습니다.` : "기본 양식 지정을 해제했습니다.");
    } catch {
      feedback.error("기본 양식 지정에 실패했습니다.");
    }
  };

  const handleDuplicate = async (id: number) => {
    try {
      const dup = await duplicateMessageTemplate(id);
      setTemplates((prev) => [dup, ...prev]);
      feedback.success(`"${dup.name}" 양식이 복제되었습니다.`);
    } catch {
      feedback.error("양식 복제에 실패했습니다.");
    }
  };

  const handleDeleteTemplate = async (id: number) => {
    const target = templates.find((t) => t.id === id);
    if (!target) return;
    const ok = await confirm({
      title: "양식 삭제",
      message: `"${target.name}" 양식을 삭제할까요? 삭제하면 복구할 수 없습니다.`,
      confirmText: "삭제",
      cancelText: "취소",
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteMessageTemplate(id);
      setTemplates((prev) => prev.filter((t) => t.id !== id));
      if (selectedTemplateId === id) {
        setSelectedTemplateId(null);
        setTemplateBodySnapshot(null);
      }
      feedback.success("양식이 삭제되었습니다.");
    } catch {
      feedback.error("양식 삭제에 실패했습니다.");
    }
  };

  const requestSend = () => {
    if (!canSend) return;
    setShowConfirm(true);
  };

  const handleSend = async () => {
    if (!canSend || sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    setShowConfirm(false);
    const taskId = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    asyncStatusStore.addWorkerJob(`알림톡 발송`, taskId, "messaging");
    try {
      let totalEnqueued = 0;
      let totalSkipped = 0;
      let completedCalls = 0;
      const totalCalls = isStaffMode ? 1 : sendToTargets.length;

      const buildPayload = (sendTo: SendToType) => {
        const payload: Parameters<typeof sendMessage>[0] = { send_to: sendTo, message_mode: "alimtalk" };
        if (isStaffMode) payload.staff_ids = staffIds; else payload.student_ids = studentIds;
        if (selectedTemplateId) payload.template_id = selectedTemplateId;
        // SSOT (2026-05-14 domain-policy §5): 학원장 본문 어떻게 수정해도 봉투(검수 양식) 유지.
        // template_id race / 양식 변경으로 누락돼도 block_category 로 backend 가 unified 매칭.
        if (blockCategory) payload.block_category = blockCategory;
        const currentBody = body.trim();
        payload.raw_body = currentBody;
        if (subject.trim()) payload.raw_subject = subject.trim();
        if (alimtalkExtraVars) payload.alimtalk_extra_vars = alimtalkExtraVars;
        // SSOT (2026-05-14): 학원장이 textarea에서 본문 수정 시 학생별 substituted body 재계산.
        // callback이 있으면 currentBody 기반으로 재호출 → 학생별 _body_subst가 학원장 수정본 반영.
        // 미제공 시 사전 계산된 alimtalkExtraVarsPerStudent 그대로 사용 (legacy + 1명 path 호환).
        const perStudentVars = recomputePerStudentVarsRef?.current
          ? recomputePerStudentVarsRef.current(currentBody)
          : alimtalkExtraVarsPerStudent;
        if (perStudentVars && Object.keys(perStudentVars).length > 0) {
          payload.alimtalk_extra_vars_per_student = perStudentVars;
        }
        return payload;
      };

      const targets = isStaffMode ? ["staff" as SendToType] : sendToTargets;
      for (const sendTo of targets) {
        const res = await sendMessage(buildPayload(sendTo));
        totalEnqueued += res.enqueued ?? 0;
        totalSkipped += res.skipped_no_phone ?? 0;
        completedCalls++;
        asyncStatusStore.updateProgress(taskId, Math.round((completedCalls / totalCalls) * 90));
      }

      const sendToLabel = isStaffMode ? "직원" : sendToTargets.length === 2 ? "학부모·학생" : sendToTargets[0] === "parent" ? "학부모" : "학생";
      if (totalEnqueued > 0) {
        const skippedNote = totalSkipped > 0 ? ` (전화번호 없음 ${totalSkipped}건 제외)` : "";
        feedback.success(`${sendToLabel} 알림톡 ${totalEnqueued}건 발송 예정${skippedNote} — 발송 내역에서 결과를 확인하세요.`);
        asyncStatusStore.completeTask(taskId, "success");
      } else {
        const hint = totalSkipped > 0
          ? `${sendToLabel} 대상 중 전화번호가 없어 큐에 등록된 건이 0건입니다.`
          : `${sendToLabel} 알림톡 발송이 큐에 등록되지 않았습니다. 알림톡 연동·승인 템플릿·수신 번호를 확인해 주세요.`;
        feedback.warning(hint);
        asyncStatusStore.completeTask(taskId, "error", "발송 큐 0건");
      }
      queryClient.invalidateQueries({ queryKey: ["messaging", "info"] });
      onClose();
    } catch (e: unknown) {
      const msg = e && typeof e === "object" && "response" in e
        ? (e as { response?: { data?: { detail?: string } } }).response?.data?.detail : null;
      const errMsg = (msg && typeof msg === "string" ? msg : "발송 요청에 실패했습니다.") as string;
      asyncStatusStore.completeTask(taskId, "error", errMsg);
      feedback.error(errMsg);
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  if (!open) return null;

  // ─── Labels ───
  const fallbackLabel = isStaffMode
    ? (hasRecipients ? `선택한 직원 ${staffIds.length}명` : "수신자 없음")
    : (hasRecipients ? `선택한 학생 ${studentIds.length}명` : "수신자 없음");
  const rawLabel = recipientLabel ?? fallbackLabel;
  const labelParts = rawLabel.split(" — ");
  const labelContext = labelParts.length > 1 ? labelParts[0] : null;
  const labelName = labelParts.length > 1 ? labelParts.slice(1).join(" — ") : rawLabel;
  const domainLabel = TEMPLATE_CATEGORY_LABELS[blockCategory] ?? "사용자";

  const sendButtonText = (() => {
    if (sending) return "발송 중…";
    if (isStaffMode) return `직원 ${staffIds.length}명에게 알림톡 발송`;
    const parts: string[] = [];
    if (sendToParent) parts.push(`학부모 ${recipientCount}명`);
    if (sendToStudent) parts.push(`학생 ${recipientCount}명`);
    if (parts.length === 0) return "대상 선택 필요";
    return `${parts.join(" + ")}에게 알림톡 발송`;
  })();

  const disableReason = (() => {
    if (!hasRecipients) return "수신자를 선택해 주세요";
    if (sendToTargets.length === 0) return "발송 대상을 선택해 주세요";
    if (!hasSelectedBodySource) return "양식을 선택하거나 직접 작성해 주세요";
    if (!body.trim()) return "본문을 입력해 주세요";
    if (hasMissingVars) {
      const list = missingVarNames.map((n) => `#{${n}}`).join(", ");
      return `미입력 변수: ${list} — 본문/변수 팔레트에서 채워 주세요`;
    }
    if (hasQualityBlockers) return qualityBlockers[0]?.title ?? "양식 품질 확인 필요";
    return null;
  })();

  // ─── Render ───
  return (
    <>
    <AdminModal open={open} onClose={onClose} width={920} onEnterConfirm={requestSend} className="send-message-modal" noMinimize>
      <ModalHeader
        noIcon
        title={
          <div className="send-modal__title">
            <span>알림톡 발송</span>
            <Badge tone="primary" size="sm">{domainLabel}</Badge>
          </div>
        }
        description={
          hasRecipients
            ? (recipientCount > 1
                ? "양식이 자동 적용됐습니다. 본문을 확인·수정한 뒤 발송하세요. 학생별 점수는 자동 치환됩니다."
                : "양식이 자동 적용됐습니다. 본문을 확인·수정한 뒤 발송하세요.")
            : "왼쪽에서 수신자를 먼저 선택해 주세요."
        }
      />

      <ModalBody>
        <div className="send-modal__layout">

          {/* ═══ 좌측: 수신자 + 미리보기 (2 카드 통합) ═══ */}
          <div className="send-modal__left">
            {/* 카드 1 — 수신자 (대상 토글 + 일괄안내 + 적용양식 통합) */}
            <section className="send-modal__card send-modal__card--recipient">
              <div className="send-modal__card-label">수신자</div>
              {labelContext && (
                <div className="send-modal__recipient-context">{labelContext}</div>
              )}
              <div className="send-modal__recipient-name">{labelName}</div>

              {!hasRecipients && (
                <div className="send-modal__hint send-modal__hint--warn">
                  수신자를 선택한 뒤 발송해 주세요.
                </div>
              )}

              {/* 학부모/학생 대상 토글 (학생 모드일 때만) */}
              {hasRecipients && !isStaffMode && (
                <div className="send-modal__recipient-targets">
                  <label className="send-modal__check">
                    <input type="checkbox" checked={sendToParent} onChange={(e) => setSendToParent(e.target.checked)} disabled={sending} />
                    <span>학부모</span>
                  </label>
                  <label className="send-modal__check">
                    <input type="checkbox" checked={sendToStudent} onChange={(e) => setSendToStudent(e.target.checked)} disabled={sending} />
                    <span>학생</span>
                  </label>
                  {sendToTargets.length === 0 && (
                    <span className="send-modal__targets-warn">선택 필요</span>
                  )}
                </div>
              )}

              {/* 적용된 양식 — inline */}
              {hasRecipients && (selectedTemplate || selectedPreset) && (
                <div className="send-modal__applied-tpl">
                  <Check size={ICON.xs} className="send-modal__icon-success" />
                  <span className="send-modal__applied-tpl-name">{selectedTemplate?.name ?? selectedPreset?.name}</span>
                  {selectedTemplate?.is_user_default && <Badge tone="primary" size="xs">기본</Badge>}
                  {selectedPreset && <Badge tone="primary" size="xs">기본 제공</Badge>}
                  {selectedTemplate && isSystemTpl(selectedTemplate) && <Badge tone="info" size="xs">시스템</Badge>}
                </div>
              )}

              {/* 일괄 발송 안내 — 변수 치환 인지 보조 */}
              {hasRecipients && recipientCount > 1 && (
                <div className="send-modal__bulk-hint">
                  <div className="send-modal__bulk-hint-title">
                    일괄 발송 · {recipientCount}명
                  </div>
                  <div className="send-modal__bulk-hint-desc">
                    {blockCategory === "grades"
                      ? <>미리보기는 양식 기준입니다. <strong>{`#{학생이름}`}</strong>, <strong>{`#{시험성적}`}</strong> 등 변수는 학생별로 자동 치환됩니다.</>
                      : <>미리보기는 첫 번째 학생 기준입니다. <strong>{`#{학생이름}`}</strong>, <strong>{`#{시험성적}`}</strong> 등 변수는 학생별로 자동 치환됩니다.</>}
                  </div>
                </div>
              )}
            </section>

            {/* 카드 2 — 미리보기 + 변수 상태 통합
                봉투(카카오 자동 채움) + 편지(학원장 작성) 시각 분리.
                blockCategory 또는 selectedTemplate.category 로 봉투 타입 판별 → renderAlimtalkFullPreview 사용. */}
            <section className="send-modal__card send-modal__card--preview">
              <div className="send-modal__card-label">
                카카오톡 미리보기
                {hasRecipients && recipientCount > 1 && (
                  <span className="send-modal__card-sublabel">
                    {blockCategory === "grades" ? " · 양식 기준 · 학생별 자동 치환" : " · 첫 학생 기준 · 학생별로 자동 치환됨"}
                  </span>
                )}
              </div>
              {(() => {
                const tplCategory = (selectedTemplate?.category as TemplateCategory | undefined) ?? blockCategory;
                const alimtalkType = getAlimtalkTemplateTypeFromCategory(tplCategory);
                // SSOT (2026-05-14): preview body는 학원장이 textarea에 친 body가 진실.
                // 직전엔 selectedTemplate.body의 substituted ReactNode[]를 letterBody로 썼는데
                // (a) renderAlimtalkFullPreview는 raw string body를 받아 자체 렌더, (b) 학원장 수정 반영 안 됨.
                // 둘 다 해결 위해 body raw string 그대로 전달.
                // 성적 발송은 callback 결과 대신 raw 양식을 표시해 다수 학생에게 공통 적용될 모양을 검수한다.
                const letterBody = body && hasSelectedBodySource ? previewLetterBody : "";
                const channelLabel = alimtalkType
                  ? alimtalkType === "score" ? "성적표 안내"
                    : alimtalkType === "attendance" ? "출석 안내"
                    : alimtalkType === "clinic_info" ? "클리닉 안내"
                    : alimtalkType === "clinic_change" ? "일정 변경 안내"
                    : "알림톡"
                  : "알림톡";
                if (alimtalkType) {
                  return (
                    <div className="template-preview-kakao">
                      <div className="template-preview-kakao__helper">
                        봉투(카카오 자동 채움) + 학원장님 편지 — 학생별 변수 자동 치환
                      </div>
                      <div className="template-preview-kakao__card">
                        <div className="template-preview-kakao__header">
                          <span className="template-preview-kakao__header-label">알림톡 도착</span>
                          <span className="template-preview-kakao__header-channel">{channelLabel}</span>
                        </div>
                        <div className="template-preview-kakao__body">
                          {letterBody
                            ? renderAlimtalkFullPreview(alimtalkType, letterBody)
                            : <span className="send-modal__preview-placeholder">{alimtalkFreeForm ? "내용을 입력하세요" : "양식을 선택하세요"}</span>}
                        </div>
                      </div>
                    </div>
                  );
                }
                return (
                  <div className="template-preview-kakao">
                    <div className="template-preview-kakao__card">
                      <div className="template-preview-kakao__header">
                        <span className="template-preview-kakao__header-label">알림톡 도착</span>
                        <span className="template-preview-kakao__header-channel">{channelLabel}</span>
                      </div>
                      {(selectedTemplate?.subject || subject) && (
                        <div className="template-preview-kakao__title">{previewSubject}</div>
                      )}
                      <div className="template-preview-kakao__body">
                        {letterBody
                          ? previewBody
                          : <span className="send-modal__preview-placeholder">{alimtalkFreeForm ? "내용을 입력하세요" : "양식을 선택하세요"}</span>}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* 변수 상태 — 미리보기 카드 하단 inline */}
              {(selectedTemplate || selectedPreset) && varStatuses.length > 0 && (
                <div className="send-modal__var-status">
                  {varStatuses.map((v) => (
                    <div key={v.name} className="send-modal__var-row" data-status={v.status}>
                      {v.status === "missing"
                        ? <AlertCircle size={ICON.xs} className="send-modal__icon-warning" />
                        : <Check size={ICON.xs} className="send-modal__icon-success" />}
                      <span className="send-modal__var-name">{v.name}</span>
                      <span className="send-modal__var-value">
                        {v.status === "auto" ? "자동" : v.status === "provided" ? (v.value ? `"${v.value}"` : "제공됨") : "미제공"}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {qualityIssues.length > 0 && (
                <div className="send-modal__quality-status">
                  <div className="send-modal__quality-title">
                    <AlertTriangle size={ICON.xs} />
                    발송 전 확인
                  </div>
                  {qualityIssues.map((issue) => (
                    <div key={issue.id} className="send-modal__quality-row" data-severity={issue.severity}>
                      <span className="send-modal__quality-row-title">{issue.title}</span>
                      <span className="send-modal__quality-row-detail">{issue.detail}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* ═══ 우측: 양식 선택 + 본문 편집 ═══ */}
          <div className="send-modal__right">
            {/* ── 양식 바 — 양식 정보 + 저장 액션 + 변경 액션 (학원장 호소 2026-05-13: 칸 효율 통합) ── */}
            <div className="send-modal__tpl-bar">
              {selectedTemplate && isSystemTpl(selectedTemplate) ? (
                <Shield size={ICON.sm} className="send-modal__icon-info" />
              ) : (
                <Tag size={ICON.sm} className="send-modal__icon-primary" />
              )}
              <div className="send-modal__tpl-bar-label">
                {selectedTemplate ? (
                  <div className="send-modal__tpl-bar-name-row">
                    <span className="send-modal__tpl-bar-name">{selectedTemplate.name}</span>
                    {selectedTemplate.solapi_status === "APPROVED" && <Badge tone="success" size="xs">승인</Badge>}
                    {isSystemTpl(selectedTemplate) && <Badge tone="info" size="xs">시스템</Badge>}
                    {bodyModified && <Badge tone="warning" size="xs">수정됨</Badge>}
                  </div>
                ) : selectedPreset ? (
                  <div className="send-modal__tpl-bar-name-row">
                    <span className="send-modal__tpl-bar-name">{selectedPreset.name}</span>
                    <Badge tone="primary" size="xs">기본 제공</Badge>
                    {selectedPreset.recommended && <Badge tone="success" size="xs">추천</Badge>}
                    {presetBodyModified && <Badge tone="warning" size="xs">수정됨</Badge>}
                  </div>
                ) : alimtalkFreeForm ? (
                  <span className="send-modal__tpl-bar-freeform">직접 작성 모드</span>
                ) : (
                  <span className="send-modal__tpl-bar-empty">양식을 선택하거나 직접 작성하세요</span>
                )}
              </div>

              {/* 저장 액션 — 양식/본문 상태에 따라 분기. 양식 변경 버튼과 같은 라인에 묶어 칸 효율. */}
              {!showSaveForm && body.trim() && hasSelectedBodySource && (
                <div className="send-modal__tpl-bar-save">
                  {bodyModified && selectedTemplate && !isSystemTpl(selectedTemplate) ? (
                    <>
                      <Button size="sm" intent="secondary" onClick={handleUpdateTemplate} disabled={sending || savingTemplate}>
                        양식 덮어쓰기
                      </Button>
                      <button
                        type="button"
                        onClick={() => { setShowSaveForm(true); setSaveTemplateName(""); }}
                        disabled={sending}
                        className="send-modal__save-bar-link"
                      >
                        다른 이름으로
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => { setShowSaveForm(true); setSaveTemplateName(""); }}
                      disabled={sending}
                      className="send-modal__save-bar-link"
                    >
                      내 양식으로 저장
                    </button>
                  )}
                </div>
              )}

              <Button
                size="sm"
                intent="primary"
                onClick={() => setShowPickerModal(true)}
                disabled={sending}
              >
                {hasSelectedBodySource ? "양식 변경" : "양식 선택"}
              </Button>
            </div>

            {/* ── 양식 이름 입력 form — 저장 액션 클릭 시에만 노출 ── */}
            {showSaveForm && (
              <div className="send-modal__save-form">
                <div className="send-modal__save-form-label">새 양식 이름을 입력하세요</div>
                <div className="send-modal__save-form-row">
                  <Input
                    size="small"
                    placeholder="예: 출결 알림, 성적표 양식"
                    value={saveTemplateName}
                    onChange={(e) => setSaveTemplateName(e.target.value)}
                    onPressEnter={handleSaveTemplate}
                    className="send-modal__save-form-input"
                    autoFocus
                  />
                  <Button size="sm" intent="primary" onClick={handleSaveTemplate} disabled={!saveTemplateName.trim() || !body.trim() || savingTemplate}>
                    {savingTemplate ? "저장 중…" : "저장"}
                  </Button>
                  <Button size="sm" intent="secondary" onClick={() => setShowSaveForm(false)}>취소</Button>
                </div>
              </div>
            )}

            {/* ── 본문 영역 라벨 — 일괄 발송 의도 명시 ── */}
            <div className="send-modal__editor-label">
              <span className="send-modal__editor-label-title">봉투 안 편지 (학원장 자유 편집)</span>
              {hasRecipients && recipientCount > 1 ? (
                <span className="send-modal__editor-label-hint">
                  학원장님 작성한 그대로 학생 {recipientCount}명 전원에게 발송 · <strong>{`#{학생이름}`}</strong>·<strong>{`#{시험성적}`}</strong> 등 변수는 학생별 자동 치환
                </span>
              ) : (
                <span className="send-modal__editor-label-hint">
                  카카오 양식의 <strong>봉투 장식</strong>(학원명/학생명/강의명 등)은 자동 채움. 여기에는 <strong>학원장님 메시지만</strong> 자유롭게 작성하세요.
                </span>
              )}
            </div>

            {/* ── 본문 + 변수 팔레트 ── */}
            <div className="send-modal__editor">
              <div ref={bodyWrapRef} className="send-modal__editor-body">
                {/* 빈 상태 오버레이 */}
                {!body && !hasSelectedBodySource && (
                  <div className="send-modal__editor-empty">
                    <Edit3 size={ICON.xl} className="send-modal__icon-muted-faded" />
                    <div className="send-modal__editor-empty-text">
                      <div>양식을 선택하거나</div>
                      <div>직접 내용을 작성하세요</div>
                    </div>
                    <Button size="sm" intent="primary" onClick={() => setShowPickerModal(true)}>
                      양식 선택하기
                    </Button>
                    <button
                      type="button"
                      onClick={() => setAlimtalkFreeForm(true)}
                      className="send-modal__editor-empty-link"
                    >
                      직접 작성하기
                    </button>
                  </div>
                )}
                <Input.TextArea
                  value={body}
                  onChange={(e) => { setBody(e.target.value); if (!alimtalkFreeForm && !selectedTemplate && !selectedPreset) setAlimtalkFreeForm(true); }}
                  disabled={sending}
                  className="message-domain-input send-modal__editor-textarea"
                  placeholder="학원장님이 학생/학부모에게 전할 안내 메시지를 자유롭게 입력하세요. (봉투 장식은 카카오에서 자동으로 더해집니다)"
                  // 빈 상태 오버레이가 위에 떠 있을 때 textarea 클릭이 통과되지 않도록 동적 차단.
                  // eslint-disable-next-line no-restricted-syntax
                  style={{
                    pointerEvents: !body && !hasSelectedBodySource ? "none" : undefined,
                  }}
                />
              </div>

              {showVarPalette ? (
                <div className="send-modal__var-palette">
                  <button
                    type="button"
                    onClick={() => setShowVarPalette(false)}
                    className="send-modal__var-palette-close"
                    title="변수 팔레트 접기"
                    aria-label="변수 팔레트 접기"
                  >✕</button>
                  <div className="send-modal__var-palette-title">변수 삽입</div>
                  <div className="send-modal__var-palette-desc">클릭하면 커서 위치에 추가됩니다</div>
                  {blockCategory === "grades" ? (
                    <GradesBlockPanel blocks={blocks} onInsert={insertBlock} disabled={sending} currentBody={body} />
                  ) : (
                    <div className="send-modal__var-palette-list">
                      {blocks.map((block) => {
                        const bc = getBlockColor(block.id);
                        return (
                          <div key={block.id}>
                            <button
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => { if (!alimtalkFreeForm && !selectedTemplate && !selectedPreset) setAlimtalkFreeForm(true); insertBlock(block.insertText); }}
                              disabled={sending}
                              className="template-editor__block-tag send-modal__var-palette-block-btn"
                              // 블록 ID별 고유 색상 동적 적용 — getBlockColor() 반환값(static SSOT). className 으로는 N종 색상 표현 불가.
                              // eslint-disable-next-line no-restricted-syntax
                              style={{ background: bc.bg, color: bc.color, borderColor: bc.border }}
                            >
                              {block.label}
                            </button>
                            {block.description && <div className="send-modal__var-palette-block-desc">{block.description}</div>}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowVarPalette(true)}
                  className="send-modal__var-palette-toggle"
                  title="변수 팔레트 열기"
                >
                  <Tag size={ICON.xs} />
                  변수 삽입
                </button>
              )}
            </div>
          </div>
        </div>
      </ModalBody>

      {/* ─── 발송 확인 오버레이 ─── */}
      {showConfirm && (
        <div className="send-modal__confirm-overlay">
          <div className="send-modal__confirm-card">
            <div className="send-modal__confirm-title">발송을 확인해 주세요</div>
            <div className="send-modal__confirm-meta">
              <div className="send-modal__confirm-row">
                <span className="send-modal__confirm-key">채널</span>
                <span className="send-modal__confirm-val">카카오 알림톡</span>
              </div>
              <div className="send-modal__confirm-row">
                <span className="send-modal__confirm-key">대상</span>
                <span className="send-modal__confirm-val">
                  {isStaffMode ? `직원 ${staffIds.length}명` : (() => {
                    const parts: string[] = [];
                    if (sendToParent) parts.push(`학부모 ${recipientCount}명`);
                    if (sendToStudent) parts.push(`학생 ${recipientCount}명`);
                    return parts.join(" + ");
                  })()}
                </span>
              </div>
              {hasSelectedBodySource && (
                <div className="send-modal__confirm-row">
                  <span className="send-modal__confirm-key">템플릿</span>
                  <span className="send-modal__confirm-val send-modal__confirm-val--ellipsis">
                    {selectedTemplate?.name ?? selectedPreset?.name ?? "직접 작성"}
                  </span>
                </div>
              )}
              <div className="send-modal__confirm-row">
                <span className="send-modal__confirm-key">본문</span>
                <span className="send-modal__confirm-val">{body.length}자</span>
              </div>
              <div className="send-modal__confirm-preview">
                {/* 성적 발송은 양식 기준, 그 외는 첫 수신자 기준 previewLetterBody를 사용한다. */}
                {previewLetterBody.slice(0, 200)}{previewLetterBody.length > 200 ? "…" : ""}
              </div>
              {qualityIssues.length > 0 && (
                <div className="send-modal__confirm-quality">
                  {qualityIssues.map((issue) => (
                    <div key={issue.id} className="send-modal__confirm-quality-row" data-severity={issue.severity}>
                      <AlertTriangle size={ICON.xs} />
                      <span>{issue.title}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="send-modal__confirm-actions">
              <Button intent="secondary" onClick={() => setShowConfirm(false)} className="send-modal__confirm-back-btn">
                돌아가기
              </Button>
              <Button intent="primary" onClick={handleSend} disabled={sending} className="send-modal__confirm-send-btn">
                {sending ? "발송 중…" : "발송하기"}
              </Button>
            </div>
          </div>
        </div>
      )}

      <ModalFooter
        right={
          <div className="send-modal__footer-right">
            {disableReason && !sending && (
              <span className="send-modal__footer-warn">
                <AlertTriangle size={ICON.xs} />
                {disableReason}
              </span>
            )}
            <Button intent="secondary" onClick={onClose} disabled={sending} size="lg">취소</Button>
            <Button
              intent="primary"
              onClick={requestSend}
              disabled={!canSend || sending}
              size="lg"
              className="send-modal__send-btn"
            >
              {sendButtonText}
            </Button>
          </div>
        }
      />
    </AdminModal>

    {/* ─── 양식 선택 큰 모달 (별도 1040px 팝업) ─── */}
    <TemplatePickerModal
      open={showPickerModal}
      onClose={() => setShowPickerModal(false)}
      templates={templates}
      defaultPresets={providedPresets}
      blockCategory={blockCategory}
      selectedTemplateId={selectedTemplateId}
      selectedPresetId={selectedPresetId}
      alimtalkExtraVars={alimtalkExtraVars}
      onPick={selectTemplate}
      onPickPreset={selectPreset}
      onPickFreeForm={selectFreeForm}
      onSetDefault={handleSetDefault}
      onDuplicate={handleDuplicate}
      onDelete={handleDeleteTemplate}
      onRefreshTemplates={refreshTemplates}
    />
    </>
  );
}
