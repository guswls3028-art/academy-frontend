import type { ProductFeature } from "./types";

export const PRODUCT_ANALYTICS_CATALOG_VERSION = "2026-07-29";

export const PRODUCT_FEATURES: ProductFeature[] = [
  { featureId: "dashboard.home", label: "홈 대시보드", domain: "dashboard", audiences: ["owner", "admin", "teacher", "staff", "student", "parent"], expectedFrequency: "daily", strategicPriority: "core", status: "active" },
  { featureId: "students.directory", label: "학생 관리", domain: "students", audiences: ["owner", "admin", "teacher", "staff"], expectedFrequency: "daily", strategicPriority: "core", status: "active" },
  { featureId: "classes.manage", label: "수업·강의 관리", domain: "classes", audiences: ["owner", "admin", "teacher", "staff", "student", "parent"], expectedFrequency: "daily", strategicPriority: "core", status: "active" },
  { featureId: "attendance.manage", label: "출석", domain: "attendance", audiences: ["owner", "admin", "teacher", "staff", "student", "parent"], expectedFrequency: "daily", strategicPriority: "core", status: "active" },
  { featureId: "scores.manage", label: "성적", domain: "scores", audiences: ["owner", "admin", "teacher", "staff", "student", "parent"], expectedFrequency: "weekly", strategicPriority: "core", status: "active" },
  { featureId: "exams.manage", label: "시험", domain: "exams", audiences: ["owner", "admin", "teacher", "staff", "student"], expectedFrequency: "weekly", strategicPriority: "core", status: "active" },
  { featureId: "assignments.manage", label: "과제·제출", domain: "assignments", audiences: ["owner", "admin", "teacher", "staff", "student"], expectedFrequency: "weekly", strategicPriority: "core", status: "active" },
  { featureId: "videos.manage", label: "영상 학습", domain: "videos", audiences: ["owner", "admin", "teacher", "staff", "student", "parent"], expectedFrequency: "weekly", strategicPriority: "core", status: "active" },
  { featureId: "clinic.manage", label: "클리닉", domain: "clinic", audiences: ["owner", "admin", "teacher", "staff", "student", "parent"], expectedFrequency: "weekly", strategicPriority: "core", status: "active" },
  { featureId: "messaging.manage", label: "메시지·알림", domain: "messaging", audiences: ["owner", "admin", "teacher", "staff", "student", "parent"], expectedFrequency: "weekly", strategicPriority: "support", status: "active" },
  { featureId: "community.manage", label: "공지·커뮤니티", domain: "community", audiences: ["owner", "admin", "teacher", "staff", "student", "parent"], expectedFrequency: "weekly", strategicPriority: "support", status: "active" },
  { featureId: "fees.manage", label: "수납·결제", domain: "fees", audiences: ["owner", "admin", "teacher", "staff", "student", "parent"], expectedFrequency: "monthly", strategicPriority: "core", status: "active" },
  { featureId: "materials.manage", label: "교재·자료", domain: "materials", audiences: ["owner", "admin", "teacher", "staff"], expectedFrequency: "weekly", strategicPriority: "support", status: "active" },
  { featureId: "storage.manage", label: "파일·보관함", domain: "storage", audiences: ["owner", "admin", "teacher", "staff", "student"], expectedFrequency: "weekly", strategicPriority: "support", status: "active" },
  { featureId: "results.view", label: "결과 분석", domain: "results", audiences: ["owner", "admin", "teacher", "staff"], expectedFrequency: "weekly", strategicPriority: "core", status: "active" },
  { featureId: "counseling.manage", label: "상담", domain: "counseling", audiences: ["owner", "admin", "teacher", "staff"], expectedFrequency: "weekly", strategicPriority: "support", status: "active" },
  { featureId: "staff.manage", label: "직원 관리", domain: "staff", audiences: ["owner", "admin"], expectedFrequency: "monthly", strategicPriority: "support", status: "active" },
  { featureId: "settings.manage", label: "설정", domain: "settings", audiences: ["owner", "admin", "teacher", "staff", "student", "parent"], expectedFrequency: "rare", strategicPriority: "support", status: "active" },
  { featureId: "profile.manage", label: "내 정보", domain: "profile", audiences: ["owner", "admin", "teacher", "staff", "student", "parent"], expectedFrequency: "monthly", strategicPriority: "support", status: "active" },
  { featureId: "tools.use", label: "수업 도구", domain: "tools", audiences: ["owner", "admin", "teacher", "staff"], expectedFrequency: "weekly", strategicPriority: "optional", status: "active" },
  { featureId: "landing.manage", label: "학원 홈페이지", domain: "landing", audiences: ["owner", "admin"], expectedFrequency: "monthly", strategicPriority: "support", status: "active" },
  { featureId: "guide.view", label: "사용 가이드", domain: "guide", audiences: ["owner", "admin", "teacher", "staff", "student", "parent"], expectedFrequency: "rare", strategicPriority: "support", status: "active" },
];

export const PRODUCT_FEATURE_BY_ID = new Map(
  PRODUCT_FEATURES.map((feature) => [feature.featureId, feature]),
);
