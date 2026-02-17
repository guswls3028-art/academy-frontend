// PATH: src/features/messages/context/SendMessageModalContext.tsx
// 공용 메시지 발송 모달 — 어디서든 openSendMessageModal({ studentIds, recipientLabel }) 호출

import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import SendMessageModal from "../components/SendMessageModal";

export type OpenSendMessageOptions = {
  studentIds: number[];
  recipientLabel?: string;
};

type ContextValue = {
  openSendMessageModal: (options: OpenSendMessageOptions) => void;
};

const SendMessageModalContext = createContext<ContextValue | null>(null);

export function useSendMessageModal(): ContextValue {
  const ctx = useContext(SendMessageModalContext);
  if (!ctx) {
    throw new Error("useSendMessageModal must be used within SendMessageModalProvider");
  }
  return ctx;
}

export function SendMessageModalProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [studentIds, setStudentIds] = useState<number[]>([]);
  const [recipientLabel, setRecipientLabel] = useState<string | undefined>();

  const openSendMessageModal = useCallback((options: OpenSendMessageOptions) => {
    setStudentIds(options.studentIds);
    setRecipientLabel(options.recipientLabel);
    setOpen(true);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    setStudentIds([]);
    setRecipientLabel(undefined);
  }, []);

  return (
    <SendMessageModalContext.Provider value={{ openSendMessageModal }}>
      {children}
      <SendMessageModal
        open={open}
        onClose={close}
        initialStudentIds={studentIds}
        recipientLabel={recipientLabel}
      />
    </SendMessageModalContext.Provider>
  );
}
