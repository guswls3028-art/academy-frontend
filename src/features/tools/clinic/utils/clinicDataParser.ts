// PATH: src/features/tools/clinic/utils/clinicDataParser.ts
// 성적 탭 복붙 데이터 → 클리닉 대상자 분류 파서

export type ParsedClinicData = {
  both: string[];
  examOnly: string[];
  hwOnly: string[];
  sessionTitle: string;
  lectureTitle: string;
  date: string;
  totalPresent: number;
};

const ATTENDANCE = ["현장", "온라인", "조퇴", "결석", "보강", "미정", "지각"];
const SCORE_RE = /^(\d+)점$/;
const PCT_RE = /^(\d+)%$/;
const STATUS_VALS = ["진행중", "완료", "-"];
const NAME_RE = /^[가-힣]{2,4}[A-Z]?$/;

/** 텍스트에서 탭 구분 행 → 라인별로 전개 */
function expandTabs(text: string): string[] {
  const raw = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const out: string[] = [];
  for (const line of raw) {
    if (line.includes("\t")) {
      for (const cell of line.split("\t")) {
        const t = cell.trim();
        if (t) out.push(t);
      }
    } else {
      out.push(line);
    }
  }
  return out;
}

/** "시험+과제: 이름1, 이름2" 형태의 카테고리 리스트 감지 */
function tryCategoryFormat(lines: string[]): ParsedClinicData | null {
  const cats: Record<string, string[]> = { both: [], examOnly: [], hwOnly: [] };
  let matched = 0;
  for (const l of lines) {
    // 시험+과제 먼저 매칭 (시험+과제 > 시험 > 과제 순서 중요)
    const mBoth = l.match(/^(?:시험\s*\+\s*과제|시험과제|both)\s*[:：]\s*(.+)/i);
    const mExam = !mBoth && l.match(/^(?:시험\s*미통과|시험만|시험|exam)\s*[:：]\s*(.+)/i);
    const mHw = !mBoth && !mExam && l.match(/^(?:과제\s*미통과|과제만|과제|hw|homework)\s*[:：]\s*(.+)/i);
    const m = mBoth || mExam || mHw;
    if (!m) continue;
    const names = m[1].split(/[,，]+/).map((n) => n.trim()).filter(Boolean);
    if (mBoth) cats.both = names;
    else if (mHw) cats.hwOnly = names;
    else if (mExam) cats.examOnly = names;
    matched++;
  }
  if (matched === 0) return null;
  return {
    both: cats.both,
    examOnly: cats.examOnly,
    hwOnly: cats.hwOnly,
    sessionTitle: "",
    lectureTitle: "",
    date: "",
    totalPresent: 0,
  };
}

type Assessment = { isExam: boolean; isHw: boolean; status: string };

function parseScoreTabFormat(lines: string[]): ParsedClinicData {
  // ── 메타데이터 추출 ──
  let sessionTitle = "";
  let lectureTitle = "";
  let date = "";
  for (let i = 0; i < lines.length; i++) {
    if (!sessionTitle && /^20\d{2}\s/.test(lines[i]) && /[가-힣]/.test(lines[i])) {
      sessionTitle = lines[i];
      // sessionTitle 바로 위 줄이 강의 약칭 (2~10글자 한글)
      if (i > 0 && /^[가-힣a-zA-Z0-9\s]{1,10}$/.test(lines[i - 1])) {
        lectureTitle = lines[i - 1];
      }
    }
    if (!date && /^\d{2}\/\d{2}$/.test(lines[i])) date = lines[i];
  }

  // ── 학생 블록 파싱 ──
  type StudentBlock = { name: string; attendance: string; assessments: Assessment[] };
  const students: StudentBlock[] = [];

  for (let i = 0; i < lines.length; i++) {
    if (!ATTENDANCE.includes(lines[i])) continue;
    if (i === 0 || !NAME_RE.test(lines[i - 1])) continue;

    const name = lines[i - 1];
    const attendance = lines[i];

    // 이미 파싱된 학생의 이름이면 스킵 (중복 방지)
    if (students.some((s) => s.name === name)) continue;

    const assessments: Assessment[] = [];
    let j = i + 1;
    while (j + 1 < lines.length) {
      const val = lines[j];
      const st = lines[j + 1];
      const isScore = SCORE_RE.test(val);
      const isPct = PCT_RE.test(val);
      const isDash = val === "-";
      if ((isScore || isPct || isDash) && STATUS_VALS.includes(st)) {
        assessments.push({ isExam: isScore, isHw: isPct, status: st });
        j += 2;
      } else {
        break;
      }
    }

    students.push({ name, attendance, assessments });
  }

  // ── 분류 ──
  const both: string[] = [];
  const examOnly: string[] = [];
  const hwOnly: string[] = [];
  let presentCount = 0;

  for (const s of students) {
    if (s.attendance === "결석") continue;
    presentCount++;

    const examFailed = s.assessments.some((a) => a.isExam && a.status === "진행중");
    const hwFailed = s.assessments.some((a) => a.isHw && a.status === "진행중");

    if (examFailed && hwFailed) both.push(s.name);
    else if (examFailed) examOnly.push(s.name);
    else if (hwFailed) hwOnly.push(s.name);
  }

  const sort = (arr: string[]) => arr.sort((a, b) => a.localeCompare(b, "ko"));
  sort(both);
  sort(examOnly);
  sort(hwOnly);

  return { both, examOnly, hwOnly, sessionTitle, lectureTitle, date, totalPresent: presentCount };
}

/** 단순 이름 목록 (한 줄에 한 명) → 전부 "시험+과제"로 분류 */
function parseSimpleNameList(lines: string[]): ParsedClinicData {
  const names = lines.filter((l) => NAME_RE.test(l));
  if (names.length === 0) return { both: [], examOnly: [], hwOnly: [], sessionTitle: "", lectureTitle: "", date: "", totalPresent: 0 };
  names.sort((a, b) => a.localeCompare(b, "ko"));
  return { both: names, examOnly: [], hwOnly: [], sessionTitle: "", lectureTitle: "", date: "", totalPresent: names.length };
}

export function parseClinicData(text: string): ParsedClinicData {
  const lines = expandTabs(text);
  if (lines.length === 0) return { both: [], examOnly: [], hwOnly: [], sessionTitle: "", lectureTitle: "", date: "", totalPresent: 0 };

  // 1) 카테고리 리스트 형태 시도
  const catResult = tryCategoryFormat(lines);
  if (catResult && (catResult.both.length + catResult.examOnly.length + catResult.hwOnly.length > 0)) return catResult;

  // 2) 성적탭 복붙 형태 시도
  const scoreResult = parseScoreTabFormat(lines);
  if (scoreResult.both.length + scoreResult.examOnly.length + scoreResult.hwOnly.length > 0) return scoreResult;

  // 3) 단순 이름 목록
  return parseSimpleNameList(lines);
}
