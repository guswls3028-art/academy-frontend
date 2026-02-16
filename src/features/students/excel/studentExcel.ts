// PATH: src/features/students/excel/studentExcel.ts
// 엑셀 파싱·양식 단일진실 (SSOT) — 학생 일괄 등록 + 강의 수강생 엑셀 업로드. @see docs/DESIGN_SSOT.md §8

import * as XLSX from "xlsx";

/** 엑셀 양식 컬럼 — 구분(예시여부), 필수 우선, 선택옵션 뒤로 */
export const EXCEL_HEADERS = [
  { key: "remark", label: "구분", required: false },
  { key: "name", label: "이름", required: true },
  { key: "parentPhone", label: "학부모전화번호", required: true },
  { key: "studentPhone", label: "학생전화번호", required: false },
  { key: "gender", label: "성별", required: false },
  { key: "schoolType", label: "학교유형", required: false },
  { key: "school", label: "학교", required: false },
  { key: "grade", label: "학년", required: false },
  { key: "schoolClass", label: "반", required: false },
  { key: "major", label: "계열", required: false },
  { key: "memo", label: "메모", required: false },
] as const;

export type ExcelRowKey = Exclude<(typeof EXCEL_HEADERS)[number]["key"], "remark">;

export interface ParsedStudentRow {
  name: string;
  gender: string;
  studentPhone: string;
  parentPhone: string;
  /** 학생 전화가 없어 식별자(010+8자리)로 대체한 경우 true */
  usesIdentifier?: boolean;
  schoolType: "HIGH" | "MIDDLE";
  school: string;
  grade: string;
  schoolClass: string;
  major: string;
  memo: string;
}

/** 전화번호에서 숫자만 추출 (01012345678) */
function toRawPhone(v: unknown): string {
  const s = String(v ?? "").replace(/\D/g, "");
  return s;
}

/**
 * 학원별 양식 대응 — 헤더 별칭 매핑
 * 각 필드에 매칭 가능한 대체 라벨 목록
 */
const HEADER_ALIASES: Record<string, readonly string[]> = {
  remark: ["구분", "체크"],
  name: ["이름", "성명", "학생명"],
  studentPhone: ["학생전화번호", "학생핸드폰", "학생 전화번호", "학생 전화", "학생연락처"],
  parentPhone: ["학부모전화번호", "부모핸드폰", "부모 전화", "학부모 전화", "보호자 전화", "보호자전화"],
  gender: ["성별"],
  schoolType: ["학교유형"],
  school: ["학교", "학교(학년)", "학교명"], // 학교(학년) = 학교+학년 합쳐진 컬럼
  grade: ["학년"],
  schoolClass: ["반"],
  major: ["계열"],
  memo: ["메모"],
  /** 엑셀 내 강의명 — 강의 일치 확인용(선택) */
  lectureName: ["강의명", "강의", "과목", "수업명"],
};

function normalizeHeader(s: string): string {
  return String(s ?? "").trim().replace(/\s/g, "");
}

/** 헤더 라벨이 특정 필드에 매칭되는지 확인 */
function headerMatches(label: string, key: string): boolean {
  const normalized = normalizeHeader(label);
  const aliases = HEADER_ALIASES[key];
  if (!aliases) return false;
  const labels = EXCEL_HEADERS.filter((h) => h.key === key).map((h) => h.label);
  const allLabels = [...new Set([...aliases, ...labels])];
  return allLabels.some((a) => normalizeHeader(a) === normalized);
}

/** 헤더 인덱스 매핑 (첫 행 기준) — 별칭 포함 */
function buildHeaderMap(headers: string[]): Record<string, number> {
  const map: Record<string, number> = {};
  headers.forEach((h, i) => {
    const label = String(h ?? "").trim();
    if (!label) return;
    for (const key of Object.keys(HEADER_ALIASES) as (keyof typeof HEADER_ALIASES)[]) {
      if (headerMatches(label, key) && map[key] === undefined) {
        map[key] = i;
        break;
      }
    }
  });
  return map;
}

/** 셀 값 → 문자열 */
function cellStr(map: Record<string, number>, row: unknown[], key: ExcelRowKey): string {
  const i = map[key];
  if (i == null) return "";
  const v = row[i];
  return String(v ?? "").trim();
}

/** 헤더에만 있는 키(예: lectureName)용 셀 값 */
function cellStrOptional(map: Record<string, number>, row: unknown[], key: string): string {
  const i = map[key];
  if (i == null) return "";
  const v = (row as unknown[])[i];
  return String(v ?? "").trim();
}

/**
 * "학교(학년)" 형식 파싱 — 예: 숙명여고(０), 휘문중(3)
 * 전각 숫자 ０→0 변환, 학교명과 학년 분리
 */
function parseSchoolGrade(value: string): { school: string; grade: string } {
  const s = String(value ?? "").trim();
  if (!s) return { school: "", grade: "" };
  const m = s.match(/^(.+?)\(([０-９0-9]+)\)\s*$/);
  if (!m) return { school: s, grade: "" };
  const school = m[1].trim();
  const gradeFullwidth = m[2].replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
  const grade = gradeFullwidth.replace(/\D/g, "") || "";
  return { school, grade };
}

/** 학교명에서 학교유형 추론 (여고/부고/고→HIGH, 중→MIDDLE) */
function inferSchoolType(school: string): "HIGH" | "MIDDLE" {
  const s = school.trim();
  if (/(중학교|중등|중\b)/.test(s)) return "MIDDLE";
  if (/(여고|부고|고등|고등학교)/.test(s)) return "HIGH";
  return "HIGH";
}

/**
 * 엑셀 양식 다운로드 — 상단 안내문, 헤더, 예시 행 (xlsx 패키지로 동작 보장)
 */
export function downloadStudentExcelTemplate() {
  const wb = XLSX.utils.book_new();
  const headers = EXCEL_HEADERS.map((h) => h.label);
  const exampleRow1 = [
    "예시(등록안됨)",
    "홍길동",
    "01087654321",
    "01012345678",
    "M",
    "HIGH",
    "OO고등학교",
    "1",
    "1",
    "인문계",
    "",
  ];
  const exampleRow2 = [
    "예시(등록안됨)",
    "김영희",
    "01011112222",
    "01098765432",
    "F",
    "MIDDLE",
    "OO중학교",
    "2",
    "3",
    "",
    "",
  ];

  const instructionRow1 = [
    "◆ 필수 입력: 이름, 학부모전화번호. 학생전화번호는 선택(비워두면 학부모 전화 뒤 8자리로 OMR 식별). 아이디는 6자리 숫자로 자동 부여됩니다.",
  ];
  const instructionRow2 = [
    "◆ 양식 규칙: 학부모전화번호·학생전화번호 010XXXXXXXX 11자리, 성별(M 또는 F), 학교유형(HIGH 또는 MIDDLE). 학교 비우면 비움, XX중/XX고 적으면 자동 반영.",
  ];
  const instructionRow3 = [
    "◆ 7~8행은 예시입니다. 9행부터 학생 정보를 작성하세요.",
  ];
  const emptyRow: string[] = [];

  const data = [
    instructionRow1,
    instructionRow2,
    instructionRow3,
    emptyRow,
    headers,
    exampleRow1,
    exampleRow2,
  ];
  const sheet = XLSX.utils.aoa_to_sheet(data);
  sheet["!cols"] = headers.map((_, i) => ({ wch: i === 0 ? 22 : i === 1 ? 12 : 14 }));
  XLSX.utils.book_append_sheet(wb, sheet, "학생목록");
  XLSX.writeFile(wb, "학생_일괄등록_양식.xlsx");
}

/** parseStudentExcel 반환 타입 — 강의명은 엑셀 내 컬럼/첫 행에서 추출(선택) */
export interface ParseStudentExcelResult {
  rows: ParsedStudentRow[];
  /** 엑셀에 적힌 강의명(강의 일치 확인용). 없으면 undefined */
  lectureNameFromExcel?: string;
}

/**
 * 엑셀 파일 파싱 → 학생 행 + 엑셀 강의명(있을 경우)
 */
export function parseStudentExcel(file: File): Promise<ParseStudentExcelResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) {
          reject(new Error("파일을 읽을 수 없습니다."));
          return;
        }
        const wb = XLSX.read(data, { type: "binary" });
        const firstSheet = wb.Sheets[wb.SheetNames[0]];
        if (!firstSheet) {
          reject(new Error("시트가 없습니다."));
          return;
        }
        const rows = XLSX.utils.sheet_to_json<unknown[]>(firstSheet, { header: 1 });
        if (!rows.length) {
          reject(new Error("데이터가 없습니다."));
          return;
        }
        // 헤더 행 찾기 — 이름 + (학생전화 또는 학부모전화) 포함된 첫 행
        const hasName = (r: unknown[]) =>
          (r || []).some((c) => headerMatches(String(c ?? ""), "name"));
        const hasPhone = (r: unknown[]) =>
          (r || []).some(
            (c) => headerMatches(String(c ?? ""), "studentPhone") || headerMatches(String(c ?? ""), "parentPhone")
          );
        let headerRowIndex = -1;
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i] as unknown[];
          if (hasName(row) && hasPhone(row)) {
            headerRowIndex = i;
            break;
          }
        }
        if (headerRowIndex < 0) {
          reject(new Error("양식이 맞지 않습니다. 이름·전화번호 컬럼이 있는 행을 찾을 수 없습니다."));
          return;
        }
        const headerRow = rows[headerRowIndex] as string[];
        const map = buildHeaderMap(headerRow);

        // 엑셀 강의명: (1) 헤더 위 행에서 "강의명"/"강의" 라벨 옆 셀 (2) 강의명 컬럼의 첫 값
        let lectureNameFromExcel: string | undefined;
        for (let r = 0; r < headerRowIndex; r++) {
          const row = rows[r] as unknown[];
          const arr = row ?? [];
          for (let c = 0; c < arr.length - 1; c++) {
            const label = String(arr[c] ?? "").trim();
            const next = String(arr[c + 1] ?? "").trim();
            if (
              (normalizeHeader(label) === "강의명" || normalizeHeader(label) === "강의") &&
              next
            ) {
              lectureNameFromExcel = next;
              break;
            }
          }
          if (lectureNameFromExcel) break;
        }

        const result: ParsedStudentRow[] = [];
        const remarkVal = (m: Record<string, number>, row: unknown[]) => {
          const i = m["remark"];
          if (i == null || typeof i !== "number") return "";
          return String((row as unknown[])[i] ?? "").trim();
        };
        for (let r = headerRowIndex + 1; r < rows.length; r++) {
          const row = rows[r] as unknown[];
          if (/예시/.test(remarkVal(map, row))) continue; // 예시 행 스킵
          if (!lectureNameFromExcel && map["lectureName"] != null) {
            const v = cellStrOptional(map, row, "lectureName");
            if (v) lectureNameFromExcel = v;
          }
          const name = cellStr(map, row, "name");
          const rawStudent = toRawPhone(cellStr(map, row, "studentPhone"));
          let studentPhone = rawStudent;
          let parentPhone = toRawPhone(cellStr(map, row, "parentPhone"));
          let usesIdentifier = false;

          // 8자리 숫자만 있으면 식별자(010+8자리)로 해석
          if (rawStudent.length === 8 && /^\d{8}$/.test(rawStudent)) {
            studentPhone = `010${rawStudent}`;
            usesIdentifier = true;
          }
          // 학생 전화 없을 때: 학부모 전화 8자리로 OMR 식별 (백엔드에서 처리)
          else if (!studentPhone || studentPhone.length !== 11 || !studentPhone.startsWith("010")) {
            if (!parentPhone || parentPhone.length !== 11 || !parentPhone.startsWith("010")) continue; // 학부모도 없으면 스킵
            studentPhone = "";
            usesIdentifier = true;
          }
          if (!parentPhone || parentPhone.length !== 11 || !parentPhone.startsWith("010")) parentPhone = studentPhone;
          if (!name && !studentPhone) continue; // 빈 행 스킵

          const schoolCell = cellStr(map, row, "school");
          const gradeCell = cellStr(map, row, "grade");
          const { school: parsedSchool, grade: parsedGrade } = parseSchoolGrade(schoolCell);
          const school = parsedSchool || schoolCell; // 학교(학년) 파싱 결과 또는 원본
          const grade = parsedGrade || gradeCell;
          const schoolTypeRaw = cellStr(map, row, "schoolType").toUpperCase();
          const schoolType =
            schoolTypeRaw === "MIDDLE" ? "MIDDLE" : school ? inferSchoolType(school) : "HIGH";

          result.push({
            name,
            gender: cellStr(map, row, "gender").toUpperCase().slice(0, 1) || "",
            studentPhone,
            parentPhone,
            usesIdentifier,
            schoolType,
            school,
            grade,
            schoolClass: cellStr(map, row, "schoolClass"),
            major: cellStr(map, row, "major"),
            memo: cellStr(map, row, "memo"),
          });
        }
        resolve({ rows: result, lectureNameFromExcel: lectureNameFromExcel || undefined });
      } catch (err) {
        reject(err instanceof Error ? err : new Error("파일 파싱 실패"));
      }
    };
    reader.onerror = () => reject(new Error("파일 읽기 실패"));
    reader.readAsBinaryString(file);
  });
}

// ========== 차시 수강생 엑셀 (이름·전화 매칭 + N차시 출결 컬럼) ==========

/** 차시 수강생 엑셀 한 행 — 이름·학부모전화로 매칭, 선택 차시 출결 값 */
export interface SessionEnrollParsedRow {
  name: string;
  parentPhone: string;
  /** 차시 order → 셀 값 (출, 영상, 결 등) */
  sessionAttendance: Record<number, string>;
}

/** 헤더에서 "N차시" 컬럼 인덱스 → order 매핑 (1차시→1, 2차시→2, …) */
function buildSessionColumnMap(headerRow: string[]): Record<number, number> {
  const map: Record<number, number> = {};
  headerRow.forEach((label, i) => {
    const s = String(label ?? "").trim();
    const m = s.match(/^제?\s*(\d+)\s*차시$/) || s.match(/^(\d+)\s*차시$/);
    if (m) {
      const order = parseInt(m[1], 10);
      if (Number.isFinite(order)) map[order] = i;
    }
  });
  return map;
}

/** 출결 셀 값 → API status (출/출석/현장→PRESENT, 영상/온라인→ONLINE 등) */
export function mapAttendanceCellToStatus(cell: string): string | null {
  const s = String(cell ?? "").trim();
  if (!s) return null;
  const n = s.replace(/\s/g, "");
  if (/^(출|출석|현장|O|○|ㅇ)$/i.test(n)) return "PRESENT";
  if (/^(영상|온라인|VOD|V)$/i.test(n)) return "ONLINE";
  if (/^(결|결석|X|×|ㄴ)$/i.test(n)) return "ABSENT";
  if (/^(지각|L)$/i.test(n)) return "LATE";
  if (/^(보강|B)$/i.test(n)) return "SUPPLEMENT";
  if (/^(조퇴|E)$/i.test(n)) return "EARLY_LEAVE";
  if (/^(출튀|R)$/i.test(n)) return "RUNAWAY";
  if (/^(자료|M)$/i.test(n)) return "MATERIAL";
  if (/^(부재|I)$/i.test(n)) return "INACTIVE";
  if (/^(탈퇴|S)$/i.test(n)) return "SECESSION";
  return null;
}

/**
 * 차시 수강생 엑셀 파싱 — 학생 도메인 엑셀과 동일하게 이름·학부모전화 컬럼 찾고,
 * 추가로 "N차시" 컬럼에서 출결 값 수집. 양식이 달라도 이름+전화 있으면 처리.
 */
export function parseSessionEnrollExcel(file: File): Promise<SessionEnrollParsedRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) {
          reject(new Error("파일을 읽을 수 없습니다."));
          return;
        }
        const wb = XLSX.read(data, { type: "binary" });
        const firstSheet = wb.Sheets[wb.SheetNames[0]];
        if (!firstSheet) {
          reject(new Error("시트가 없습니다."));
          return;
        }
        const rows = XLSX.utils.sheet_to_json<unknown[]>(firstSheet, { header: 1 });
        if (!rows.length) {
          reject(new Error("데이터가 없습니다."));
          return;
        }
        const hasName = (r: unknown[]) =>
          (r || []).some((c) => headerMatches(String(c ?? ""), "name"));
        const hasPhone = (r: unknown[]) =>
          (r || []).some(
            (c) =>
              headerMatches(String(c ?? ""), "studentPhone") ||
              headerMatches(String(c ?? ""), "parentPhone")
          );
        let headerRowIndex = -1;
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i] as unknown[];
          if (hasName(row) && hasPhone(row)) {
            headerRowIndex = i;
            break;
          }
        }
        if (headerRowIndex < 0) {
          reject(new Error("양식이 맞지 않습니다. 이름·전화번호 컬럼이 있는 행을 찾을 수 없습니다."));
          return;
        }
        const headerRow = rows[headerRowIndex] as string[];
        const map = buildHeaderMap(headerRow);
        const sessionColMap = buildSessionColumnMap(headerRow);
        const result: SessionEnrollParsedRow[] = [];
        const remarkVal = (m: Record<string, number>, row: unknown[]) => {
          const i = m["remark"];
          if (i == null || typeof i !== "number") return "";
          return String((row as unknown[])[i] ?? "").trim();
        };
        for (let r = headerRowIndex + 1; r < rows.length; r++) {
          const row = rows[r] as unknown[];
          if (/예시/.test(remarkVal(map, row))) continue;
          const name = cellStr(map, row, "name");
          const parentPhone = toRawPhone(cellStr(map, row, "parentPhone"));
          if (!parentPhone || parentPhone.length !== 11 || !parentPhone.startsWith("010")) {
            if (!name) continue;
          }
          if (!name && !parentPhone) continue;
          const sessionAttendance: Record<number, string> = {};
          for (const [orderStr, colIndex] of Object.entries(sessionColMap)) {
            const order = parseInt(orderStr, 10);
            const v = row[colIndex];
            const cell = String(v ?? "").trim();
            if (cell) sessionAttendance[order] = cell;
          }
          result.push({
            name: name.trim(),
            parentPhone: parentPhone || "",
            sessionAttendance,
          });
        }
        resolve(result);
      } catch (err) {
        reject(err instanceof Error ? err : new Error("파일 파싱 실패"));
      }
    };
    reader.onerror = () => reject(new Error("파일 읽기 실패"));
    reader.readAsBinaryString(file);
  });
}
