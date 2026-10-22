// PATH: src/app_admin/domains/messages/components/AlimtalkTemplateInfoPanel.tsx
// 통합 알림톡 템플릿 — 자동 채움 변수 안내 + #{내용} 편집 가이드
// 솔라피 리스트형 템플릿의 하드코딩 구조를 선생님에게 시각적으로 보여줌

/* eslint-disable react-refresh/only-export-components -- helper 함수 + 컴포넌트 한 파일 SSOT */

import { getBlockColor } from "../constants/templateBlocks";
import { useMessageAcademyName } from "../hooks/useMessageAcademyName";
import "./AlimtalkTemplateInfoPanel.css";
import {
  getAlimtalkTemplateLabel,
  getAlimtalkTemplateType,
  getAlimtalkTemplateTypeFromCategory,
  isAlimtalkTemplateBodyEditable,
  type AlimtalkTemplateType,
} from "../constants/alimtalkEnvelope";

export {
  getAlimtalkTemplateLabel,
  getAlimtalkTemplateType,
  getAlimtalkTemplateTypeFromCategory,
  isAlimtalkTemplateBodyEditable,
};
export type { AlimtalkTemplateType };

// ── 템플릿 타입별 자동 채움 변수 ──

const TEMPLATE_TYPE_LABELS: Record<string, string> = {
  clinic_info: "클리닉 안내",
  clinic_change: "클리닉 일정 변경",
  score: "성적 안내",
  attendance: "출석 안내",
  notice_withdrawal: "퇴원 처리 안내",
  notice_payment: "결제 완료 안내",
};

const TEMPLATE_TYPE_DESCRIPTIONS: Record<string, string> = {
  clinic_info: "학원이름, 학생이름, 장소, 날짜, 시간은 자동으로 채워집니다. 선생님은 안내문만 작성하면 됩니다.",
  clinic_change: "학원이름, 학생이름, 기존일정, 변동사항, 수정자는 자동으로 채워집니다. 선생님은 안내문만 작성하면 됩니다.",
  score: "학원이름, 학생이름, 강의명, 차시명은 자동으로 채워집니다. 선생님은 성적 안내문만 작성하면 됩니다.",
  attendance: "학원이름, 학생이름, 강의명, 차시명, 날짜, 시간은 자동으로 채워집니다. 선생님은 안내문만 작성하면 됩니다.",
  notice_withdrawal: "학원명과 학생 이름이 자동으로 표시되는 고정 안내입니다. 별도 안내문 작성은 필요하지 않습니다.",
  notice_payment: "학원명, 학생 이름, 사이트 링크가 자동으로 표시되는 고정 안내입니다. 별도 안내문 작성은 필요하지 않습니다.",
};

type AutoVar = { label: string; example: string; color: string; bg: string; border: string };

const TEMPLATE_AUTO_VARS: Record<string, AutoVar[]> = {
  clinic_info: [
    { label: "학원이름", example: "학원플러스", ...getBlockColor("academy_name") },
    { label: "학생이름", example: "홍길동", ...getBlockColor("student_name") },
    { label: "클리닉 장소", example: "3층 세미나실", ...getBlockColor("clinic_place") },
    { label: "클리닉 날짜", example: "2026-04-06", ...getBlockColor("clinic_date") },
    { label: "클리닉 시간", example: "14:00", ...getBlockColor("clinic_time") },
  ],
  clinic_change: [
    { label: "학원이름", example: "학원플러스", ...getBlockColor("academy_name") },
    { label: "학생이름", example: "홍길동", ...getBlockColor("student_name") },
    { label: "기존일정", example: "4/6(일) 14:00 3층", ...getBlockColor("clinic_old_sched") },
    { label: "변동사항", example: "4/7(월) 15:00으로 변경", ...getBlockColor("clinic_changes") },
    { label: "수정자", example: "김선생님", ...getBlockColor("clinic_modifier") },
  ],
  score: [
    { label: "학원이름", example: "학원플러스", ...getBlockColor("academy_name") },
    { label: "학생이름", example: "홍길동", ...getBlockColor("student_name") },
    { label: "강의명", example: "수학 심화반", ...getBlockColor("lecture_name") },
    { label: "차시명", example: "3회차", ...getBlockColor("session_name") },
  ],
  attendance: [
    { label: "학원이름", example: "학원플러스", ...getBlockColor("academy_name") },
    { label: "학생이름", example: "홍길동", ...getBlockColor("student_name") },
    { label: "강의명", example: "수학 심화반", ...getBlockColor("lecture_name") },
    { label: "차시명", example: "3회차", ...getBlockColor("session_name") },
    { label: "날짜", example: "2026-04-06", ...getBlockColor("date") },
    { label: "시간", example: "14:00", ...getBlockColor("time") },
  ],
  notice_withdrawal: [
    { label: "학원명", example: "학원플러스", ...getBlockColor("academy_name") },
    { label: "학생이름", example: "길동", ...getBlockColor("student_name_2") },
  ],
  notice_payment: [
    { label: "학원명", example: "학원플러스", ...getBlockColor("academy_name") },
    { label: "학생이름", example: "길동", ...getBlockColor("student_name_2") },
    { label: "사이트 링크", example: "https://academy.example", ...getBlockColor("site_link") },
  ],
};

/** 알림톡 자동 채움 변수의 block ID 목록 — 본문 변수 삽입에서 중복 제거용 */
const AUTO_VAR_BLOCK_IDS: Record<string, Set<string>> = {
  clinic_info: new Set(["academy_name", "student_name", "clinic_place", "clinic_date", "clinic_time"]),
  clinic_change: new Set(["academy_name", "student_name", "clinic_old_sched", "clinic_changes", "clinic_modifier"]),
  score: new Set(["academy_name", "student_name", "lecture_name", "session_name"]),
  attendance: new Set(["academy_name", "student_name", "lecture_name", "session_name", "date", "time"]),
  notice_withdrawal: new Set(["academy_name", "student_name_2"]),
  notice_payment: new Set(["academy_name", "student_name_2", "site_link"]),
};

export function getAutoFillBlockIds(templateType: AlimtalkTemplateType | null): Set<string> {
  if (!templateType) return new Set();
  return AUTO_VAR_BLOCK_IDS[templateType] ?? new Set();
}

/** 알림톡 미리보기용 전체 메시지 렌더링 */
export { renderAlimtalkFullPreview } from "@/shared/messaging/alimtalkPreview";

export default function AlimtalkTemplateInfoPanel({
  templateType,
}: {
  templateType: AlimtalkTemplateType;
  /** caller 호환 — 본 컴포넌트는 readonly 안내라 비활성 상태 표시 안 함 */
  disabled?: boolean;
}) {
  const { data: academyName } = useMessageAcademyName();
  if (!templateType) return null;

  const autoVars = TEMPLATE_AUTO_VARS[templateType] || [];
  const description = TEMPLATE_TYPE_DESCRIPTIONS[templateType] || "";
  const typeLabel = TEMPLATE_TYPE_LABELS[templateType] || getAlimtalkTemplateLabel(templateType);
  return (
    <section className="alimtalk-template-info" aria-label={`${typeLabel} 자동 입력 정보`}>
      <p className="alimtalk-template-info__title">알림톡 · {typeLabel}</p>
      <p className="alimtalk-template-info__description">{description}</p>
      <p className="alimtalk-template-info__label">자동으로 들어가는 정보</p>
      <dl className="alimtalk-template-info__values">
        {autoVars.map((v) => (
          <div key={v.label} className="alimtalk-template-info__row">
            <dt>{v.label}</dt>
            <dd>
              {v.label === "학원이름" || v.label === "학원명" ? academyName || "학원 정보 확인 중" : "자동 입력"}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
