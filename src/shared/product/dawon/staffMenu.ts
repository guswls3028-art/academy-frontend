export type StaffRoom = "admin" | "teacher";

const teacher = [
  { label: "수업 운영", items: [["대시보드", "dashboard"], ["강의", "lectures"], ["학생", "students/home"]] },
  { label: "시험·성적", items: [["시험", "exams"], ["성적", "results"], ["성적취합", "students/surveys/school-reports"]] },
  { label: "클리닉·상담·알림", items: [["클리닉", "clinic/operations?panel=applications&status=pending"], ["상담", "community/counsel"], ["학습 알림", "teacher-alerts"]] },
];
const admin = [
  { label: "운영 현황", items: [["대시보드", "dashboard"], ["학습 경보", "dashboard?panel=alerts"]] },
  { label: "학생·수업", items: [["학생 명단", "students/home"], ["강의 관리", "lectures"]] },
  { label: "학습 관리", items: [["시험 결과·통계", "results"], ["학교 성적 취합", "students/surveys/school-reports"], ["클리닉", "clinic/operations"], ["상담", "community/counsel"]] },
  { label: "직원 관리", items: [["직원·근태·급여", "staff"]] },
];
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
    {title: "담당 학생", description: "학생 명단에서 이름이나 반으로 찾아 수강 정보를 확인합니다.", path: "/workspace/students/home"},
  ]}],
});

export const resultTabs = [
  {key:"exams",label:"시험별",path:"/workspace/results",exact:true},
  {key:"students",label:"학생별",path:"/workspace/results/students",exact:true},
];
