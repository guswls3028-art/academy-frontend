export type PromoMeta = {
  title: string;
  description: string;
};

export const PROMO_META: Record<string, PromoMeta> = {
  "/promo": {
    title: "학원플러스 | 학원의 수업과 운영을 한 흐름으로",
    description:
      "강의·학생·출결·성적·보강 관리와 학생앱 영상, 알림톡, 칠판용 PPT·매치업, 학원 홈페이지를 한곳에서 이어갑니다.",
  },
  "/promo/features": {
    title: "기능과 실제 화면 | 학원플러스",
    description:
      "강의·학생·출결·성적·보강 관리와 학생앱 영상, 알림톡, 칠판용 PPT·매치업, 학원 홈페이지를 목적별로 확인하세요.",
  },
  "/promo/matchup-ppt": {
    title: "적중 매치업과 칠판용 PPT | 학원플러스",
    description:
      "매치업의 문항 자동 분리·유사 후보·선생님 확정 과정과 PDF·이미지를 흑백반전 칠판용 PPT로 만드는 과정을 각각 보여드립니다.",
  },
  "/promo/parent-trust": {
    title: "학부모 상담을 위한 수업 기록 | 학원플러스",
    description:
      "출결·성적·영상·보강 기록을 확인하고, 선생님이 학부모 안내와 상담에 활용하는 흐름을 확인하세요.",
  },
  "/promo/ai-grading": {
    title: "자동채점과 성적 관리 | 학원플러스",
    description:
      "객관식·OX형과 일부 수학 단답형(0~999 정수)은 자동으로 채점하고, 서술형은 선생님이 직접 확인하는 성적 관리 흐름을 소개합니다.",
  },
  "/promo/video-platform": {
    title: "학생앱 영상 복습과 시청 이력 | 학원플러스",
    description:
      "학생은 앱에서 영상을 이어 보고, 선생님은 시청 상태를 확인해 필요한 복습 안내를 보낼 수 있습니다.",
  },
  "/promo/pricing": {
    title: "요금 안내 | 8월 14만 5천원·이후 18만원 | 학원플러스",
    description:
      "2026년 8월 가입은 월 14만 5천원, 9월 이후 가입은 월 18만원입니다. 두 금액 모두 부가세 10% 별도이며 8월 가입 공급가는 이용 기간 동안 유지됩니다.",
  },
  "/promo/updates": {
    title: "업데이트 소식 | 학원플러스",
    description:
      "선생님과 학생이 실제 화면에서 체감하는 학원플러스의 새 기능과 운영 개선 내용을 날짜순으로 확인하세요.",
  },
  "/promo/faq": {
    title: "자주 묻는 질문 | 학원플러스",
    description:
      "요금, 자료 이전, 채점, 영상, 알림톡 등 학원플러스를 사용하기 전에 자주 묻는 질문을 확인하세요.",
  },
  "/promo/contact": {
    title: "사용 상담 | 학원플러스",
    description:
      "현재 수업 방식과 필요한 기능을 알려주시면 사용할 내용과 시작 일정을 함께 정리해드립니다.",
  },
  "/promo/demo": {
    title: "내 자료로 데모 요청 | 학원플러스",
    description:
      "현재 수업과 관리 방식을 기준으로 영상, 알림톡, 학생 관리, 칠판용 PPT·매치업과 학원 홈페이지 화면을 확인해보세요.",
  },
};

function setMeta(selector: string, content: string) {
  const element = document.querySelector<HTMLMetaElement>(selector);
  element?.setAttribute("content", content);
}

function setCanonical(href: string) {
  const element = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  element?.setAttribute("href", href);
}

export function applyPromoMeta(pathname: string) {
  const meta = PROMO_META[pathname] ?? PROMO_META["/promo"];
  const canonicalPath = PROMO_META[pathname] ? pathname : "/promo";
  const canonical = `${window.location.origin}${canonicalPath}`;

  document.title = meta.title;
  setMeta('meta[name="description"]', meta.description);
  setMeta('meta[property="og:title"]', meta.title);
  setMeta('meta[property="og:description"]', meta.description);
  setMeta('meta[property="og:url"]', canonical);
  setMeta('meta[name="twitter:title"]', meta.title);
  setMeta('meta[name="twitter:description"]', meta.description);
  setCanonical(canonical);
}
