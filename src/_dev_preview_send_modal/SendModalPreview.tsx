// 임시 — 발송 모달 시각 검수용 isolated preview (cleanup 예정)
// 인증 우회. import.meta.env.DEV 가드된 라우트에서만 mount.
import { useEffect } from "react";
import { SendMessageModalProvider, useSendMessageModal } from "@admin/domains/messages/context/SendMessageModalContext";

function AutoOpenInner() {
  const { openSendMessageModal } = useSendMessageModal();
  useEffect(() => {
    openSendMessageModal({
      studentIds: [1, 2, 3, 4, 5],
      recipientLabel: "수업결과 발송 — 선택한 수강생 5명",
      blockCategory: "grades",
      initialBody: "안녕하세요 #{학생이름} 학부모님!\n\n#{강의명} #{차시명} 수업결과를 안내드립니다.\n\n이번 시험 성적: #{시험성적}\n\n자세한 사항은 학원으로 문의해 주세요.",
      alimtalkExtraVars: { 강의명: "고1 수학 심화반", 차시명: "12차시 미적분 기초", 시험성적: "1차 92점 / 2차 88점" },
      alimtalkExtraVarsPerStudent: {
        1: { 학생이름: "김민수", 시험성적: "1차 92점 / 2차 88점" },
      },
    });
  }, [openSendMessageModal]);
  return null;
}

export default function SendModalPreview() {
  return (
    <div style={{ minHeight: "100vh", background: "#f3f4f6", padding: 40 }}>
      <SendMessageModalProvider>
        <AutoOpenInner />
      </SendMessageModalProvider>
    </div>
  );
}
