export const LANDING_COMMUNITY_BOARDS = ["board", "qna", "notice", "materials"] as const;

export type LandingCommunityBoard = (typeof LANDING_COMMUNITY_BOARDS)[number];

export const LANDING_COMMUNITY_BOARD_LABEL: Record<LandingCommunityBoard, string> = {
  board: "자유게시판",
  qna: "질문게시판",
  notice: "공지사항",
  materials: "자료실",
};

export const LANDING_COMMUNITY_TABS: { key: LandingCommunityBoard; label: string }[] =
  LANDING_COMMUNITY_BOARDS.map((key) => ({ key, label: LANDING_COMMUNITY_BOARD_LABEL[key] }));

export const DOWNLOAD_ONLY_LANDING_BOARDS = new Set<LandingCommunityBoard>(["materials"]);

const LANDING_STAFF_WRITE_BOARDS: LandingCommunityBoard[] = ["board", "notice", "materials"];
const LANDING_STUDENT_WRITE_BOARDS: LandingCommunityBoard[] = ["board", "qna"];
const STAFF_ROLES = new Set(["owner", "admin", "teacher", "assistant", "staff"]);

export function isLandingCommunityBoard(value: string | null | undefined): value is LandingCommunityBoard {
  return LANDING_COMMUNITY_BOARDS.includes(value as LandingCommunityBoard);
}

export function isLandingStaffRole(role: string | null | undefined, isSuperuser = false): boolean {
  return isSuperuser || STAFF_ROLES.has((role ?? "").toLowerCase());
}

export function getLandingCommunityWriteBoards(
  role: string | null | undefined,
  isSuperuser = false,
): LandingCommunityBoard[] {
  const normalizedRole = (role ?? "").toLowerCase();
  if (isLandingStaffRole(normalizedRole, isSuperuser)) return [...LANDING_STAFF_WRITE_BOARDS];
  if (normalizedRole === "student") return [...LANDING_STUDENT_WRITE_BOARDS];
  return [];
}

export function canWriteLandingCommunityBoard(
  board: LandingCommunityBoard,
  role: string | null | undefined,
  isSuperuser = false,
): boolean {
  return getLandingCommunityWriteBoards(role, isSuperuser).includes(board);
}

export function getCommunityAuthorRoleLabel(role: string | null | undefined): string {
  const normalizedRole = (role ?? "").toLowerCase();
  if (normalizedRole === "student") return "학생";
  if (normalizedRole === "teacher") return "강사";
  if (normalizedRole === "admin" || normalizedRole === "owner" || normalizedRole === "staff") return "운영진";
  if (normalizedRole === "parent") return "학부모";
  return role || "";
}
