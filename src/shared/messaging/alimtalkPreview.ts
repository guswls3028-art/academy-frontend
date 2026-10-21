import type { AlimtalkTemplateType } from "./alimtalkEnvelope";

export function renderAlimtalkFullPreview(
  templateType: AlimtalkTemplateType | null,
  contentBody: string,
  siteUrl?: string,
  previewData?: Record<string, string>,
): string {
  // 실제 테넌트 URL 사용 (없으면 도메인에서 추출)
  let url = siteUrl || previewData?.사이트링크 || "";
  if (!url) {
    try {
      const host = window.location.hostname;
      url = host === "localhost" || host === "127.0.0.1" ? "https://학원사이트.com" : `https://${host}`;
    } catch { url = "https://학원사이트.com"; }
  }
  const firstValue = (...keys: string[]) => {
    for (const key of keys) {
      const value = previewData?.[key]?.trim();
      if (value) return value;
    }
    return "";
  };
  const academyName = firstValue("학원명", "학원이름") || "[학원 이름]";
  const studentName = firstValue("학생이름", "학생이름3") || "[학생 이름]";
  const studentShortName = firstValue("학생이름2") || (firstValue("학생이름", "학생이름3") ? studentName.slice(-2) : "[학생 이름]");
  const lectureName = firstValue("강의명") || "[강의명]";
  const sessionName = firstValue("차시명") || "[차시명]";
  const lectureDate = firstValue("클리닉날짜", "강의날짜", "날짜") || "[날짜]";
  const lectureTime = firstValue("클리닉시간", "강의시간", "시간") || "[시간]";
  const clinicPlace = firstValue("클리닉장소", "장소") || "[장소]";
  const clinicPreviousSchedule = firstValue("클리닉기존일정") || "[기존 일정]";
  const clinicChanges = firstValue("클리닉변동사항") || "[변경 내용]";
  const clinicModifier = firstValue("클리닉수정자") || "[수정자]";
  if (templateType === "clinic_info") {
    return (
      `${academyName}입니다.\n\n` +
      `${studentName}학생님.\n\n` +
      `클리닉 안내 드립니다.\n` +
      `장소\n${clinicPlace}\n\n` +
      `날짜\n${lectureDate}\n\n` +
      `시간\n${lectureTime}\n\n` +
      `${contentBody || "(안내 문구를 작성하세요)"}\n` +
      url
    );
  }
  if (templateType === "clinic_change") {
    return (
      `${academyName}입니다.\n\n` +
      `${studentName}학생님. 클리닉 일정이 변경되었습니다.\n\n` +
      `일정 변경 안내 드립니다.\n` +
      `기존일정\n${clinicPreviousSchedule}\n\n` +
      `변동사항\n${clinicChanges}\n\n` +
      `수정자\n${clinicModifier}\n\n` +
      `${contentBody || "(안내 문구를 작성하세요)"}\n` +
      url
    );
  }
  if (templateType === "attendance") {
    return (
      `${academyName}입니다.\n\n` +
      `${studentName}학생님.\n\n` +
      `출석 안내 드립니다.\n` +
      `강의\n${lectureName}\n\n` +
      `차시\n${sessionName}\n\n` +
      `날짜\n${lectureDate}\n\n` +
      `시간\n${lectureTime}\n\n` +
      `${contentBody || "(안내 문구를 작성하세요)"}\n` +
      url
    );
  }
  if (templateType === "score") {
    return (
      `${academyName}입니다.\n\n` +
      `${studentName}학생님.\n\n` +
      `성적표 안내 드립니다.\n` +
      `강의\n${lectureName}\n\n` +
      `차시\n${sessionName}\n\n` +
      `${contentBody || "(안내 문구를 작성하세요)"}\n` +
      url
    );
  }
  if (templateType === "notice_withdrawal") {
    return (
      `안녕하세요, ${academyName}입니다.\n\n` +
      `${studentShortName}학생님, 퇴원 처리가 완료되었습니다.\n\n` +
      `그동안 학원을 이용해 주셔서 감사합니다.\n` +
      `재등록을 원하시면 언제든 문의해 주세요.`
    );
  }
  if (templateType === "notice_payment") {
    return (
      `안녕하세요, ${academyName}입니다.\n\n` +
      `${studentShortName}학생님, 결제가 완료되었습니다.\n\n` +
      `수업·결제 내역은 아래 링크에서 확인하실 수 있습니다.\n` +
      url
    );
  }
  return contentBody || "";
}
