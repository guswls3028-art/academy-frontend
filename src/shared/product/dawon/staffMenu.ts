export type StaffRoom = "admin" | "teacher";

const teacher = [
  { label: "수업 운영", items: [["수업 대시보드", "dashboard"], ["반별 강의", "lectures"], ["반 편성", "students/class-groups"], ["학생 명단", "students/home"]] },
  { label: "시험·성적", items: [["시험", "exams"], ["성적", "results"], ["성적취합", "students/surveys/school-reports"]] },
  { label: "클리닉·상담·알림", items: [["클리닉", "clinic/operations?panel=unresolved&focus=pending"], ["상담", "community/counsel"], ["학습 알림", "teacher-alerts"]] },
];
const admin = [{ label: "학원 운영", items: [["반 운영 현황", "dashboard"], ["반 편성", "students/class-groups"], ["시험 결과", "results"], ["직원 관리", "staff"]] }];
const settings = { label: "환경 설정", items: [["설정", "settings/profile"]] };

export const staffMenus = { teacher: [...teacher, settings], admin: [...admin, settings] };
export const staffGuide = (role: StaffRoom) => ({
  title: role === "admin" ? "관리자 이용 안내" : "선생님용 이용 안내",
  subtitle: role === "admin" ? "반별 현황과 담당 직원의 기록을 확인합니다." : "담당 반을 선택해 수업을 시작합니다.",
  fullGuidePath: "/workspace/dashboard", fullGuideLabel: "대시보드 열기",
  sections: [{ title: "주요 업무", items: role === "admin" ? [
    {title: "반별 학습 알림", description: "반을 선택해 성적과 과제 현황을 확인합니다.", path: "/workspace/dashboard?panel=alerts"},
    {title: "직원 근태·급여", description: "담당 직원을 검색하고 조회할 월을 선택합니다.", path: "/workspace/staff"},
  ] : [
    {title: "수업 진행", description: "담당 반에서 강의와 차시를 선택해 출결·시험·과제를 기록합니다.", path: "/workspace/lectures"},
    {title: "반 인원 배정", description: "반 명단에서 이름으로 찾거나 엑셀로 학생을 배정합니다.", path: "/workspace/students/class-groups"},
  ]}],
});
