// PATH: src/app_admin/domains/messages/context/SendMessageModalContext.tsx
// 알림톡 발송 모달 — 명시적인 학생/학부모 알림톡 경로에서만 호출

import { createContext, useContext, useState, useCallback, useRef, ReactNode } from "react";
import SendMessageModal from "../components/SendMessageModal";

import type { TemplateCategory } from "../constants/templateBlocks";

export type OpenSendMessageOptions = {
  studentIds?: number[];
  recipientLabel?: string;
  /** 삽입 블록 카테고리. 미지정 시 "default" (모든 블록) */
  blockCategory?: TemplateCategory;
  /** 본문 사전 입력 (성적 발송 등) */
  initialBody?: string;
  /** 사전 적용된 저장 양식 ID */
  initialTemplateId?: number | null;
  /** 사전 적용된 기본 제공 편지지 프리셋 ID */
  initialLetterPresetId?: string | null;
  /** 알림톡 추가 치환 변수 (성적 발송 시 시험명/강의명/시험성적 등) */
  alimtalkExtraVars?: Record<string, string>;
  /** 학생별 개별 치환 변수 — key: student_id (대량 성적 발송 등) */
  alimtalkExtraVarsPerStudent?: Record<number, Record<string, string>>;
  /**
   * 학원장이 모달 textarea에서 본문 수정 시 학생별 변수(_body_subst 포함)를 재계산하는 callback.
   * 제공 시 modal이 body 변경 감지마다 호출 → 최신 본문 기반 학생별 substituted body 생성.
   * 미제공 시 alimtalkExtraVarsPerStudent prop을 그대로 사용 (사전 계산된 값 고정).
   * 일괄 성적/출결 path에서 학원장 본문 수정이 silently discard되던 결함 fix (2026-05-14).
   */
  recomputePerStudentVars?: (currentBody: string) => Record<number, Record<string, string>>;
  /** 모달이 닫힐 때 호출되는 콜백 */
  onModalClose?: () => void;
};

type ContextValue = {
  openSendMessageModal: (options: OpenSendMessageOptions) => void;
};

const SendMessageModalContext = createContext<ContextValue | null>(null);

const noopOpen: ContextValue = {
  openSendMessageModal: () => {},
};

// eslint-disable-next-line react-refresh/only-export-components -- hook + provider 한 파일 SSOT 의도
export function useSendMessageModal(): ContextValue {
  const ctx = useContext(SendMessageModalContext);
  return ctx ?? noopOpen;
}

export function SendMessageModalProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [studentIds, setStudentIds] = useState<number[]>([]);
  const [recipientLabel, setRecipientLabel] = useState<string | undefined>();
  const [blockCategory, setBlockCategory] = useState<TemplateCategory | undefined>();
  const [initialBody, setInitialBody] = useState<string | undefined>();
  const [initialTemplateId, setInitialTemplateId] = useState<number | null | undefined>();
  const [initialLetterPresetId, setInitialLetterPresetId] = useState<string | null | undefined>();
  const [alimtalkExtraVars, setAlimtalkExtraVars] = useState<Record<string, string> | undefined>();
  const [alimtalkExtraVarsPerStudent, setAlimtalkExtraVarsPerStudent] = useState<Record<number, Record<string, string>> | undefined>();
  const recomputePerStudentVarsRef = useRef<((currentBody: string) => Record<number, Record<string, string>>) | undefined>(undefined);
  const onModalCloseRef = useRef<(() => void) | undefined>(undefined);

  const openSendMessageModal = useCallback((options: OpenSendMessageOptions) => {
    setStudentIds(options.studentIds ?? []);
    setRecipientLabel(options.recipientLabel);
    setBlockCategory(options.blockCategory);
    setInitialBody(options.initialBody);
    setInitialTemplateId(options.initialTemplateId);
    setInitialLetterPresetId(options.initialLetterPresetId);
    setAlimtalkExtraVars(options.alimtalkExtraVars);
    setAlimtalkExtraVarsPerStudent(options.alimtalkExtraVarsPerStudent);
    recomputePerStudentVarsRef.current = options.recomputePerStudentVars;
    onModalCloseRef.current = options.onModalClose;
    setOpen(true);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    setStudentIds([]);
    setRecipientLabel(undefined);
    setBlockCategory(undefined);
    setInitialBody(undefined);
    setInitialTemplateId(undefined);
    setInitialLetterPresetId(undefined);
    setAlimtalkExtraVars(undefined);
    setAlimtalkExtraVarsPerStudent(undefined);
    recomputePerStudentVarsRef.current = undefined;
    onModalCloseRef.current?.();
    onModalCloseRef.current = undefined;
  }, []);

  return (
    <SendMessageModalContext.Provider value={{ openSendMessageModal }}>
      {children}
      <SendMessageModal
        open={open}
        onClose={close}
        initialStudentIds={studentIds}
        recipientLabel={recipientLabel}
        blockCategory={blockCategory}
        initialBody={initialBody}
        initialTemplateId={initialTemplateId}
        initialLetterPresetId={initialLetterPresetId}
        alimtalkExtraVars={alimtalkExtraVars}
        alimtalkExtraVarsPerStudent={alimtalkExtraVarsPerStudent}
        recomputePerStudentVarsRef={recomputePerStudentVarsRef}
      />
    </SendMessageModalContext.Provider>
  );
}
