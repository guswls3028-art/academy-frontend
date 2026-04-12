// PATH: src/app_admin/domains/messages/context/SendMessageModalContext.tsx
// 공용 메시지 발송 모달 — 어디서든 openSendMessageModal({ studentIds, recipientLabel }) 호출

import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import SendMessageModal from "../components/SendMessageModal";

import type { TemplateCategory } from "../constants/templateBlocks";

export type OpenSendMessageOptions = {
  studentIds?: number[];
  staffIds?: number[];
  recipientLabel?: string;
  /** 삽입 블록 카테고리. 미지정 시 "default" (모든 블록) */
  blockCategory?: TemplateCategory;
  /** 본문 사전 입력 (성적 발송 등) */
  initialBody?: string;
  /** 알림톡 추가 치환 변수 (성적 발송 시 시험명/강의명/시험성적 등) */
  alimtalkExtraVars?: Record<string, string>;
  /** 학생별 개별 치환 변수 — key: student_id (대량 성적 발송 등) */
  alimtalkExtraVarsPerStudent?: Record<number, Record<string, string>>;
};

type ContextValue = {
  openSendMessageModal: (options: OpenSendMessageOptions) => void;
};

const SendMessageModalContext = createContext<ContextValue | null>(null);

const noopOpen: ContextValue = {
  openSendMessageModal: () => {},
};

export function useSendMessageModal(): ContextValue {
  const ctx = useContext(SendMessageModalContext);
  return ctx ?? noopOpen;
}

export function SendMessageModalProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [studentIds, setStudentIds] = useState<number[]>([]);
  const [staffIds, setStaffIds] = useState<number[]>([]);
  const [recipientLabel, setRecipientLabel] = useState<string | undefined>();
  const [blockCategory, setBlockCategory] = useState<TemplateCategory | undefined>();
  const [initialBody, setInitialBody] = useState<string | undefined>();
  const [alimtalkExtraVars, setAlimtalkExtraVars] = useState<Record<string, string> | undefined>();
  const [alimtalkExtraVarsPerStudent, setAlimtalkExtraVarsPerStudent] = useState<Record<number, Record<string, string>> | undefined>();

  const openSendMessageModal = useCallback((options: OpenSendMessageOptions) => {
    setStudentIds(options.studentIds ?? []);
    setStaffIds(options.staffIds ?? []);
    setRecipientLabel(options.recipientLabel);
    setBlockCategory(options.blockCategory);
    setInitialBody(options.initialBody);
    setAlimtalkExtraVars(options.alimtalkExtraVars);
    setAlimtalkExtraVarsPerStudent(options.alimtalkExtraVarsPerStudent);
    setOpen(true);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    setStudentIds([]);
    setStaffIds([]);
    setRecipientLabel(undefined);
    setBlockCategory(undefined);
    setInitialBody(undefined);
    setAlimtalkExtraVars(undefined);
    setAlimtalkExtraVarsPerStudent(undefined);
  }, []);

  return (
    <SendMessageModalContext.Provider value={{ openSendMessageModal }}>
      {children}
      <SendMessageModal
        open={open}
        onClose={close}
        initialStudentIds={studentIds}
        initialStaffIds={staffIds}
        recipientLabel={recipientLabel}
        blockCategory={blockCategory}
        initialBody={initialBody}
        alimtalkExtraVars={alimtalkExtraVars}
        alimtalkExtraVarsPerStudent={alimtalkExtraVarsPerStudent}
      />
    </SendMessageModalContext.Provider>
  );
}
