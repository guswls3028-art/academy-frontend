import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve("src");
const EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx"]);
const RULES = [
  { name: "기기 SMS URI", pattern: /["'`]sms:/i },
  { name: "SMS 발송 payload", pattern: /message_mode\s*:\s*["']sms["']/i },
  { name: "뿌리오 공급자 선택", pattern: /messaging_provider\s*:\s*["']ppurio["']/i },
  { name: "테넌트 메시징 설정 변경", pattern: /updateMessagingInfo|updateKakaoPfid/i },
  { name: "테넌트 메시징 PATCH", pattern: /api\.patch\s*\(\s*["'][^"']*\/messaging\/info\//i },
  { name: "신규 공급사 템플릿 생성·동기화", pattern: /submitMessageTemplateReview|syncSolapiTemplates/i },
  { name: "지원하지 않는 학생 메시지 카테고리", pattern: /block_category\s*:\s*["']student["']/i },
];

function filesUnder(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return filesUnder(full);
    return EXTENSIONS.has(path.extname(entry.name)) ? [full] : [];
  });
}

const violations = [];
for (const file of filesUnder(ROOT)) {
  const relative = path.relative(process.cwd(), file).replaceAll("\\", "/");
  const source = fs.readFileSync(file, "utf8");
  for (const rule of RULES) {
    const match = rule.pattern.exec(source);
    if (!match) continue;
    const line = source.slice(0, match.index).split("\n").length;
    violations.push(`${relative}:${line} ${rule.name}`);
  }
}

if (violations.length) {
  console.error("[messaging-policy] 알림톡 전용 계약 위반:\n" + violations.map((v) => `- ${v}`).join("\n"));
  process.exit(1);
}

console.log("[messaging-policy] 알림톡 전용 런타임 계약 통과");
