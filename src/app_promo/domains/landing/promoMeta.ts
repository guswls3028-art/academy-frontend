export type PromoMeta = {
  title: string;
  description: string;
};

export const PROMO_META: Record<string, PromoMeta> = {
  "/promo": {
    title: "학원플러스 | 수업 준비와 학원 운영을 한곳에서",
    description:
      "실제 시험과 사전 대비 자료를 비교하는 적중 매치업, 흑백반전 칠판용 PPT, 출결·성적·영상·알림톡을 확인하세요.",
  },
  "/promo/features": {
    title: "기능과 실제 화면 | 학원플러스",
    description:
      "적중 매치업·칠판용 PPT, 시험·성적, 학생앱 영상, 알림톡, 보강 관리의 실제 사용 화면을 확인하세요.",
  },
  "/promo/matchup-ppt": {
    title: "적중 매치업과 칠판용 PPT | 학원플러스",
    description:
      "실제 시험과 우리 학원 사전 대비 자료를 비교해 적중 근거를 남기고, 문제·개념 자료를 흑백반전 칠판용 PPT로 만드는 과정을 보여드립니다.",
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
    title: "요금 안내 | 기본 198,000원 · 8월 가입 159,000원 | 학원플러스",
    description:
      "평소 월 198,000원이며, 2026년 8월에 가입하면 이용하는 동안 월 159,000원이 계속 적용됩니다.",
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
      "현재 쓰는 시험지와 수업자료로 적중 매치업·칠판용 PPT와 학원 운영 화면을 직접 확인해보세요.",
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
