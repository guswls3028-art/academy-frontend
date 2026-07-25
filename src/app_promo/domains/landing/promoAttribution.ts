const ATTRIBUTION_KEY = "hakwonplus:promo-attribution";
const ATTRIBUTION_FIELDS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;

type AttributionField = (typeof ATTRIBUTION_FIELDS)[number];
type PromoAttribution = Partial<Record<AttributionField, string>>;

function sanitize(value: string) {
  return value.trim().replace(/[\r\n]/g, " ").slice(0, 120);
}

export function capturePromoAttribution(search: string) {
  try {
    const params = new URLSearchParams(search);
    const incoming = ATTRIBUTION_FIELDS.reduce<PromoAttribution>((result, field) => {
      const value = params.get(field);
      if (value) result[field] = sanitize(value);
      return result;
    }, {});

    if (Object.keys(incoming).length > 0) {
      sessionStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(incoming));
    }
  } catch {
    // 브라우저 저장소가 차단되어도 문의 흐름은 그대로 유지합니다.
  }
}

export function getPromoAttributionLabel() {
  try {
    const stored = sessionStorage.getItem(ATTRIBUTION_KEY);
    if (!stored) return "";
    const parsed = JSON.parse(stored) as PromoAttribution;
    return ATTRIBUTION_FIELDS
      .map((field) => [field, sanitize(String(parsed[field] ?? ""))] as const)
      .filter(([, value]) => value.length > 0)
      .map(([field, value]) => `${field}=${value}`)
      .join(", ");
  } catch {
    return "";
  }
}
