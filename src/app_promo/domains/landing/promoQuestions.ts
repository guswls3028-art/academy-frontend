import { AUGUST_PRICE_GUARANTEE, CONSULT_CALLBACK_NOTICE, PLANNED_PAYMENT_NOTICE, POST_AUGUST_PRICE_POLICY, START_GUIDANCE_NOTICE } from "./business";

export type PromoQuestion = { id: string; group: "cost" | "start" | "use"; question: string; paragraphs: string[]; href: string; linkLabel: string };
/** Public answers follow business.ts and existing product guides; no contract or entitlement changes. */
export const PROMO_QUESTIONS: PromoQuestion[] = [
  { id: "monthly-price", group: "cost", question: "월 요금과 포함 기능은 어떻게 되나요?", paragraphs: [POST_AUGUST_PRICE_POLICY, "현재 제공 중인 기능과 기본 저장공간 200GB를 포함합니다. 수강생 수나 계정 수에 따른 추가 요금은 없습니다."], href: "/promo/pricing", linkLabel: "요금과 포함 범위 보기" },
  { id: "additional-cost", group: "cost", question: "별도 비용이 드는 항목은 무엇인가요?", paragraphs: ["알림톡 발송비, 저장공간 200GB 초과, 대량 데이터 이전과 맞춤 개발은 별도 협의합니다. 필요한 분량과 작업 범위를 알려주시면 이용 전에 확인할 수 있습니다."], href: "/promo/pricing#additional-cost", linkLabel: "별도 비용 기준 보기" },
  { id: "existing-price", group: "cost", question: "2026년 8월에 가입한 학원의 요금은 유지되나요?", paragraphs: [AUGUST_PRICE_GUARANTEE, "8월 가입 혜택의 신규 적용은 종료되었습니다."], href: "/promo/pricing#existing-contract", linkLabel: "기존 가입 조건 보기" },
  { id: "online-payment", group: "cost", question: "원비나 교재비를 온라인으로 결제할 수 있나요?", paragraphs: [PLANNED_PAYMENT_NOTICE, "현재 제공하는 수납 기록 관리와 학원플러스 서비스 이용료 결제는 별개입니다."], href: "/promo/guide?role=admin&q=수납", linkLabel: "현재 수납 관리 방법 보기" },
  { id: "getting-started", group: "start", question: "처음 사용하면 직원·강사도 설명을 받을 수 있나요?", paragraphs: [START_GUIDANCE_NOTICE], href: "/promo/demo", linkLabel: "시연 신청" },
  { id: "demo-process", group: "start", question: "시연 신청 후에는 어떻게 진행되나요?", paragraphs: ["현재 수업 방식과 필요한 기능을 확인한 뒤 실제 화면 시연, 가격·일정 상담, 계정 설정 순서로 안내합니다. 신청할 때 보고 싶은 기능을 적어주셔도 됩니다."], href: "/promo/demo", linkLabel: "시연 신청서 열기" },
  { id: "import-data", group: "start", question: "기존 학생 명부와 영상은 옮길 수 있나요?", paragraphs: ["학생 명부는 CSV·엑셀로 한꺼번에 등록할 수 있고, 기존 영상 파일도 올릴 수 있습니다. 파일의 열을 맞추고 오류와 등록 인원을 확인한 뒤 진행합니다.", "모든 엑셀 양식을 그대로 지원하는 것은 아닙니다. 자료가 많으면 분량·일정·이전 비용을 먼저 확인합니다."], href: "/promo/features/tour?guideBook=detail&guidePage=16", linkLabel: "엑셀 등록 화면 보기" },
  { id: "callback", group: "start", question: "전화가 연결되지 않으면 어떻게 문의하나요?", paragraphs: [CONSULT_CALLBACK_NOTICE, "문의 폼에도 질문을 남길 수 있습니다."], href: "/promo/contact", linkLabel: "문의 남기기" },
  { id: "roles", group: "use", question: "강사나 스태프 권한을 나눌 수 있나요?", paragraphs: ["역할에 따라 사용할 업무와 권한을 나눌 수 있습니다. 관리자와 직원·강사, 학생이 보는 사용 방법을 각각 확인할 수 있습니다."], href: "/promo/guide", linkLabel: "역할별 사용 가이드 보기" },
  { id: "student-video", group: "use", question: "학생전용앱에서 실제로 영상을 볼 수 있나요?", paragraphs: ["네. 강의별 영상 목록에서 재생하고 마지막으로 보던 위치부터 이어볼 수 있습니다. 영상 플레이어, 댓글과 재생 목록을 학생앱에서 이용합니다."], href: "/promo/video-platform", linkLabel: "학생 영상 화면 보기" },
  { id: "video-progress", group: "use", question: "선생님은 영상 시청 여부를 확인할 수 있나요?", paragraphs: ["학생별 미시청·시청 중·완료 상태와 마지막 재생 위치를 확인할 수 있습니다. 미시청 학생에게는 영상 확인 안내를 알림톡으로 보낼 수 있습니다."], href: "/promo/features#student-video-flow", linkLabel: "영상 관리 기능 보기" },
  { id: "automatic-messages", group: "use", question: "어떤 알림톡이 자동 또는 수동으로 발송되나요?", paragraphs: ["가입·비밀번호 안내는 계정 처리와 함께 발송됩니다. 클리닉·질문 답변 안내는 승인 양식과 학원 설정이 준비된 항목만 자동으로 발송됩니다.", "출결·성적·수업 결과·과제 안내는 기본적으로 대상과 학생별 최종 문구를 확인한 뒤 직접 발송합니다."], href: "/promo/features#alimtalk-guide", linkLabel: "알림톡 발송 방식 보기" },
  { id: "message-preview", group: "use", question: "발송 전에 학생별 알림톡 문구를 볼 수 있나요?", paragraphs: ["네. 발송 가능 인원과 제외 대상을 확인하고, 학생을 선택해 이름·강의·차시가 들어간 최종 문구를 미리 볼 수 있습니다. 실제 성공·실패는 발송 내역에서 확인합니다.", "현재 내 번호로 테스트 받아보기는 별도 기능으로 제공하지 않습니다."], href: "/promo/features/tour?guideBook=detail&guidePage=8", linkLabel: "학생별 미리보기 화면 보기" },
  { id: "score-messages", group: "use", question: "수업 결과나 성적도 알림톡으로 보낼 수 있나요?", paragraphs: ["가능합니다. 저장된 성적·피드백·수업 결과로 안내문을 만들고, 학생별 최종 문구와 받는 사람을 확인한 뒤 발송합니다."], href: "/promo/features/tour?guideBook=detail&guidePage=4", linkLabel: "안내문 작성 순서 보기" },
  { id: "auto-grading", group: "use", question: "자동채점은 어떤 유형의 문제를 지원하나요?", paragraphs: ["객관식, OX형과 일부 수학 단답형(정답이 0~999 정수인 문항)을 자동으로 채점합니다. 서술형은 선생님이 직접 답안을 확인하고 점수를 입력합니다."], href: "/promo/ai-grading", linkLabel: "채점 기능과 지원 범위 보기" },
  { id: "written-grading", group: "use", question: "서술형도 완전 자동으로 채점되나요?", paragraphs: ["아닙니다. 현재 서술형은 자동채점하지 않습니다. 선생님이 답안을 직접 확인하고 점수를 확정합니다."], href: "/promo/features/tour?guideBook=detail&guidePage=23", linkLabel: "문항별 채점 방법 보기" },
];
