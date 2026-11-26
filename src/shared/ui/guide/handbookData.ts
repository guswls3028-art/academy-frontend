import { studentQuickGuide } from "@/app_student/domains/guide/data/studentQuickGuide";
import { teacherPcHandbook } from "./content/teacherPcHandbook";

export type HandbookPage = {
  title: string;
  start: string;
  steps: string[];
  done: string;
  recovery: string;
} & ({ image: string; fullImage?: string; alt: string } | { example: { title: string; rows: string[][] } });

export const handbooks: Record<"teacher" | "student", { title: string; pages: HandbookPage[] }> = {
  teacher: { title: "관리자앱 가이드", pages: teacherPcHandbook },
  student: { title: "학생앱 가이드", pages: studentQuickGuide },
};
