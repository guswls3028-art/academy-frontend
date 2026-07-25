export type PromoMeta = {
  title: string;
  description: string;
};

export const PROMO_META: Record<string, PromoMeta> = {
  "/promo": {
    title: "학원플러스 | 대치 강사·원장을 위한 학원 운영 SaaS",
    description:
      "시험지 캡처부터 유사문제 매치업, 수업 PPT, 출결·성적·영상·알림톡까지 실제 수업 흐름으로 확인하세요.",
  },
  "/promo/features": {
    title: "기능과 실제 화면 | 학원플러스",
    description:
      "매치업·PPT, 시험·성적, 학생앱 영상, 알림톡, 보강 관리의 실제 제품 화면과 사용 순서를 확인하세요.",
  },
  "/promo/matchup-ppt": {
    title: "시험지 매치업에서 수업 PPT까지 | 학원플러스",
    description:
      "학교 시험지를 올리고 유사문제 후보를 직접 확인한 뒤, 선택한 문제를 수업용 PPT로 만드는 과정을 보여드립니다.",
  },
  "/promo/parent-trust": {
    title: "학부모 상담을 위한 수업 기록 | 학원플러스",
    description:
      "출결·성적·영상·보강 기록을 확인하고, 선생님이 학부모 안내와 상담에 활용하는 흐름을 확인하세요.",
  },
  "/promo/ai-grading": {
    title: "AI 채점 보조와 선생님 검수 | 학원플러스",
    description:
      "명확한 문항은 빠르게 판정하고, 서술형과 중요한 성적은 선생님이 최종 확인하는 채점 흐름을 소개합니다.",
  },
  "/promo/video-platform": {
    title: "학생앱 영상 복습과 시청 이력 | 학원플러스",
    description:
      "학생은 앱에서 영상을 이어 보고, 선생님은 시청 상태를 확인해 필요한 복습 안내를 보낼 수 있습니다.",
  },
  "/promo/pricing": {
    title: "요금제 | 월 159,000원 전체 기능 | 학원플러스",
    description:
      "수강생과 관리자 계정 수 제한 없이 전체 기능과 200GB 저장공간을 월 159,000원에 제공합니다.",
  },
  "/promo/faq": {
    title: "자주 묻는 질문 | 학원플러스",
    description:
      "도입 범위, 요금, 자료 이전, 채점, 영상, 알림톡 등 학원플러스 도입 전에 자주 묻는 질문을 확인하세요.",
  },
  "/promo/contact": {
    title: "도입 문의 | 학원플러스",
    description:
      "현재 수업 방식과 필요한 기능을 알려주시면 학원에 맞는 도입 범위와 일정을 함께 정리해드립니다.",
  },
  "/promo/demo": {
    title: "내 자료로 데모 요청 | 학원플러스",
    description:
      "현재 쓰는 시험지와 수업 방식을 기준으로 매치업·PPT와 학원 운영 화면을 직접 확인해보세요.",
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
