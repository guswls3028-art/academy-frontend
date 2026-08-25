export const WORKSPACE_PATHS = {
  full: "/workspace",
  mobile: "/workspace/mobile",
  legacyFull: "/admin",
  legacyMobile: "/teacher",
} as const;

const POSITIVE_INTEGER = /^[1-9]\d*$/;
const COMMUNITY_TABS = ["notices", "qna", "counsel", "requests", "board", "materials"] as const;
type CommunityTab = (typeof COMMUNITY_TABS)[number];

function positiveInteger(value: string | null): number | null {
  if (!value || !POSITIVE_INTEGER.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function hasOnlySearchParams(params: URLSearchParams, allowed: readonly string[]): boolean {
  const allowedKeys = new Set(allowed);
  for (const key of params.keys()) {
    if (!allowedKeys.has(key) || params.getAll(key).length !== 1) return false;
  }
  return true;
}

function hasControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 31 || code === 127) return true;
  }
  return false;
}

function parseRelativeMobileUrl(candidate: string): URL | null {
  if (
    !candidate.startsWith(`${WORKSPACE_PATHS.mobile}/`)
    || candidate.length > 512
    || candidate.startsWith("//")
    || candidate.includes("\\")
    || candidate.includes("%")
    || candidate.includes("#")
    || hasControlCharacter(candidate)
  ) {
    return null;
  }

  try {
    const parsed = new URL(candidate, "https://workspace.invalid");
    return parsed.origin === "https://workspace.invalid" ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * 모바일 복귀 경로 allowlist. 저장할 값은 항상 이 함수가 다시 조립한 상대 경로다.
 */
export function parseMobileWorkspaceReturnPath(candidate: string): string | null {
  const parsed = parseRelativeMobileUrl(candidate);
  if (!parsed) return null;
  const { pathname, searchParams } = parsed;

  const simplePatterns = [
    /^\/workspace\/mobile\/students\/([1-9]\d*)$/,
    /^\/workspace\/mobile\/classes\/([1-9]\d*)$/,
    /^\/workspace\/mobile\/classes\/([1-9]\d*)\/sessions\/([1-9]\d*)$/,
    /^\/workspace\/mobile\/attendance\/([1-9]\d*)$/,
    /^\/workspace\/mobile\/scores\/([1-9]\d*)$/,
    /^\/workspace\/mobile\/videos\/([1-9]\d*)$/,
    /^\/workspace\/mobile\/staff\/([1-9]\d*)$/,
    /^\/workspace\/mobile\/(profile|my-records)$/,
  ];
  if (simplePatterns.some((pattern) => pattern.test(pathname))) {
    return searchParams.size === 0 ? pathname : null;
  }

  const examMatch = pathname.match(/^\/workspace\/mobile\/exams\/([1-9]\d*)$/);
  if (examMatch) {
    if (!hasOnlySearchParams(searchParams, ["sessionId"])) return null;
    const examId = positiveInteger(examMatch[1]);
    const rawSessionId = searchParams.get("sessionId");
    const sessionId = rawSessionId == null ? null : positiveInteger(rawSessionId);
    if (!examId || (rawSessionId != null && !sessionId)) return null;
    return `${WORKSPACE_PATHS.mobile}/exams/${examId}${sessionId ? `?sessionId=${sessionId}` : ""}`;
  }

  if (pathname === `${WORKSPACE_PATHS.mobile}/comms`) {
    if (!hasOnlySearchParams(searchParams, ["tab", "id"])) return null;
    const rawTab = searchParams.get("tab");
    const tab = rawTab == null
      ? "notices"
      : COMMUNITY_TABS.includes(rawTab as CommunityTab) ? rawTab as CommunityTab : null;
    const rawId = searchParams.get("id");
    const id = rawId == null ? null : positiveInteger(rawId);
    if (!tab || (rawId != null && !id) || (tab === "requests" && id)) return null;

    const normalized = new URLSearchParams();
    if (rawTab != null) normalized.set("tab", tab);
    if (id) normalized.set("id", String(id));
    const search = normalized.toString();
    return `${WORKSPACE_PATHS.mobile}/comms${search ? `?${search}` : ""}`;
  }

  return null;
}

/** 모바일 상세·워크플로를 현재 canonical PC route로만 연결한다. */
export function resolveFullWorkspaceDestination(candidate: string): string | null {
  const mobilePath = parseMobileWorkspaceReturnPath(candidate);
  if (!mobilePath) return null;
  const parsed = new URL(mobilePath, "https://workspace.invalid");
  const { pathname, searchParams } = parsed;

  const student = pathname.match(/^\/workspace\/mobile\/students\/([1-9]\d*)$/);
  if (student) return `/workspace/students/${Number(student[1])}`;

  const session = pathname.match(/^\/workspace\/mobile\/classes\/([1-9]\d*)\/sessions\/([1-9]\d*)$/);
  if (session) return `/workspace/lectures/${Number(session[1])}/sessions/${Number(session[2])}/attendance`;

  const lecture = pathname.match(/^\/workspace\/mobile\/classes\/([1-9]\d*)$/);
  if (lecture) return `/workspace/lectures/${Number(lecture[1])}`;

  const attendance = pathname.match(/^\/workspace\/mobile\/attendance\/([1-9]\d*)$/);
  if (attendance) return `/workspace/sessions/${Number(attendance[1])}/attendance`;

  const scores = pathname.match(/^\/workspace\/mobile\/scores\/([1-9]\d*)$/);
  if (scores) return `/workspace/sessions/${Number(scores[1])}/scores`;

  const exam = pathname.match(/^\/workspace\/mobile\/exams\/([1-9]\d*)$/);
  if (exam) {
    const sessionId = positiveInteger(searchParams.get("sessionId"));
    return `/workspace/exams/${Number(exam[1])}${sessionId ? `?sessionId=${sessionId}` : ""}`;
  }

  const video = pathname.match(/^\/workspace\/mobile\/videos\/([1-9]\d*)$/);
  if (video) return `/workspace/videos/${Number(video[1])}`;

  const staff = pathname.match(/^\/workspace\/mobile\/staff\/([1-9]\d*)$/);
  if (staff) return `/workspace/staff/${Number(staff[1])}`;

  if (pathname === `${WORKSPACE_PATHS.mobile}/profile`) return "/workspace/settings/profile";
  if (pathname === `${WORKSPACE_PATHS.mobile}/my-records`) return "/workspace/profile/attendance";

  if (pathname === `${WORKSPACE_PATHS.mobile}/comms`) {
    const tab = (searchParams.get("tab") ?? "notices") as CommunityTab;
    if (tab === "requests") return "/workspace/students/requests";
    const canonicalTab: Exclude<CommunityTab, "requests"> = tab;
    const id = positiveInteger(searchParams.get("id"));
    const communityPath = canonicalTab === "notices" ? "notice" : canonicalTab;
    return `/workspace/community/${communityPath}${id ? `?id=${id}` : ""}`;
  }

  return null;
}

const LEGACY_WORKSPACE_PATHS = [
  [WORKSPACE_PATHS.legacyFull, WORKSPACE_PATHS.full],
  [WORKSPACE_PATHS.legacyMobile, WORKSPACE_PATHS.mobile],
] as const;

export function canonicalizeWorkspacePath(pathname: string): string | null {
  for (const [legacyBase, canonicalBase] of LEGACY_WORKSPACE_PATHS) {
    if (pathname === legacyBase) return canonicalBase;
    if (pathname.startsWith(`${legacyBase}/`)) {
      return `${canonicalBase}${pathname.slice(legacyBase.length)}`;
    }
  }
  return null;
}
