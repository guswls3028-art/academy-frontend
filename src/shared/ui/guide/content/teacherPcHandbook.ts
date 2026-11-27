import { findGuideMedia } from "../guideMediaData";
import registrationFields from "./pc-images/registration-fields.jpg";
import registrationResult from "./pc-images/registration-result.jpg";
import registrationScreen from "./pc-images/registration-screen.jpg";
import registrationResultScreen from "./pc-images/registration-result-screen.jpg";
import sessionSchedule from "./pc-images/session-schedule.jpg";
import homeworkSettings from "./pc-images/homework-settings.jpg";

function screenshot(topic: string, frame: number, alt: string, detail?: string) {
  const shot = findGuideMedia("admin", topic)?.screens[frame - 1];
  if (!shot) throw new Error(`Missing handbook illustration: ${topic}/${frame}`);
  return { image: detail ?? shot.src, fullImage: shot.src, alt };
}

export const teacherPcHandbook = [
  {
    title: "학생 한 명 등록하기", start: "학생 → 학생 추가 → 1명만 등록", menuPath: "/workspace/students",
    image: registrationFields, fullImage: registrationScreen,
    alt: "이름과 학부모 전화번호를 입력하세요. 학생 전화번호는 아래의 선택 입력란에 적습니다.",
    resultImage: { image: registrationResult, fullImage: registrationResultScreen, alt: "등록 뒤 목록 오른쪽 위에 뜨는 알림입니다. 로그인 ID를 확인하세요." },
    steps: ["왼쪽 메뉴에서 ‘학생’을 열고 이름을 검색하세요. 동명이인이 있으면 학부모 전화번호를 대조하세요.",
      "목록 오른쪽 위 ‘학생 추가’ → ‘1명만 등록’을 누르세요. 이름과 학부모 전화번호를 입력하세요. 학생 전화번호는 선택 사항입니다.",
      "‘등록’을 누르세요. ‘학생 등록 최종 확인’에서 학생과 학부모의 초기 비밀번호 방식을 각각 확인한 뒤 ‘확인하고 등록’을 누르세요."],
    done: "목록 오른쪽 위 ‘학생 계정 등록·ID 확인 완료’ 알림에서 로그인 ID를 확인하세요. 목록을 다시 열어 학생 이름을 찾으세요.",
    recovery: "완료 알림이 사라졌다면 학생 목록에서 이름을 검색하세요. 중복 안내가 뜨면 기존 학생의 연락처를 확인하세요.",
  },
  {
    title: "첫 강의 만들기", start: "강의 → 강의 추가", menuPath: "/workspace/lectures",
    example: { title: "첫 수업 입력 예시", rows: [["강의 이름", "중등 수학 기초반"], ["담당 강사 · 과목", "담당 선생님 · 수학"], ["시작일 · 시간", "첫 수업 날짜 · 17:00~18:00"]] },
    steps: ["강의 목록에서 담당할 반을 찾으세요. 이미 있는 강의라면 그 강의를 열고 다음 쪽으로 넘어가세요.",
      "새 강의는 ‘강의 추가’를 눌러 이름, 담당 강사, 과목, 시작일과 수업 시작·종료 시간을 입력하세요.",
      "최종 확인창에서 반 이름과 일정을 읽고 ‘확인하고 만들기’를 누르세요."],
    done: "강의 목록에서 방금 입력한 이름을 선택하면 해당 강의가 열립니다.",
    recovery: "만들 수 없으면 빠진 필수 항목과 시작·종료 시간을 확인하세요. 응답이 늦으면 목록에 이미 생겼는지 먼저 확인하세요.",
  },
  {
    title: "학생을 강의에 추가하기", start: "강의 → 해당 강의 → 수강생 → 수강생 등록", menuPath: "/workspace/lectures",
    example: { title: "예시학생이 수업에 참여하기까지", rows: [["학생 명부", "이름과 계정이 등록됨"], ["강의 수강생", "이 반을 듣는 학생으로 등록됨"], ["차시 출석부", "그날 출결을 기록할 명단에 배정됨"]] },
    steps: ["해당 강의의 ‘수강생 등록’을 열고 첫 쪽에서 등록한 학생을 검색하세요.",
      "이름과 연락처를 대조해 학생을 선택하고 ‘1명 강의에 추가’를 누르세요. 여러 명을 고르면 버튼에 선택한 인원이 표시됩니다.",
      "강의 수강생 명단에서 학생을 확인하세요. 첫 수강 확정 때 계정 안내 알림톡이 발송될 수 있으니 연락처와 발송 내역도 확인하세요."],
    done: "학생이 해당 강의의 수강생 명단에 남아 있습니다. 이제 실제 수업 날짜에 배정할 수 있습니다.",
    recovery: "‘등록 결과 다시 확인’이 보이면 그 버튼으로 저장된 명단을 확인하세요. 이미 ‘수강 중’인 학생은 다음 쪽으로 넘어가세요.",
  },
  {
    title: "첫 차시와 출석부 준비하기", start: "강의 → 해당 강의 → 차시 → 출결", menuPath: "/workspace/lectures",
    ...screenshot("create-lecture", 3, "강의에서 가져온 날짜·시간을 확인하세요. 다른 날에 수업한다면 날짜를 직접 선택하세요.", sessionSchedule),
    steps: ["차시는 실제 수업 한 번을 뜻합니다. 강의에서 수업 날짜를 찾아보세요. 이미 같은 날 차시가 있으면 그 차시를 여세요.",
      "새 수업은 차시 추가에서 정규 차시 또는 보강을 고르세요. 날짜·시간을 넣고 최종 확인창에서 ‘확인하고 추가’를 누르세요.",
      "해당 차시의 출결을 열고 ‘수강생 등록’에서 그날 참석할 학생을 선택해 배정하세요."],
    done: "날짜와 차시 이름이 맞고, 해당 차시의 출석부에서 학생 이름을 찾을 수 있습니다.",
    recovery: "강의 명단에는 있는데 출석부에 없으면 선택한 날짜를 확인하고 그 차시의 수강생 배정을 확인하세요.",
  },
  {
    title: "수업 중 출결 기록하기", start: "강의 → 해당 차시 → 출결", menuPath: "/workspace/lectures",
    ...screenshot("attendance", 2, "출석부에서 학생 이름과 같은 줄에 있는 출결 상태를 선택하세요."),
    steps: ["출석부 위의 강의 이름과 수업 날짜를 확인하세요.",
      "학생 이름 옆에서 실제 출결 상태를 고르세요. 아직 확인하지 못한 학생은 미입력으로 두세요.",
      "차시를 다시 열어 학생별 상태와 남은 미입력 인원을 확인하세요."],
    done: "다시 연 출석부에도 선택한 학생의 출결 상태가 표시됩니다.",
    recovery: "잘못 입력했다면 같은 학생의 현재 상태를 확인한 뒤 올바른 값으로 바꾸세요.",
  },
  {
    title: "과제를 내고 제출물 확인하기", start: "강의 → 해당 차시 → 과제", menuPath: "/workspace/lectures",
    ...screenshot("homework", 2, "과제 제목 아래에서 채점 방식과 제출 기한을 정한 뒤 ‘1개 과제 만들기’를 누르세요.", homeworkSettings),
    steps: ["과제에서 ‘과제 추가’를 누르고 학생이 알아볼 제목을 입력하세요. 만점, 통과 기준과 제출 기한을 확인하세요.",
      "만들기 버튼을 누른 뒤 해당 차시의 과제와 대상 학생을 확인하세요.",
      "학생이 파일을 내면 과제 제출 현황에서 강의·차시와 학생을 맞춰 파일을 여세요. 내용을 확인한 뒤 판정을 저장하세요."],
    done: "같은 과제를 다시 열어 제출 파일과 저장된 판정을 확인할 수 있습니다.",
    recovery: "파일이 안 보이면 과제 이름과 대상 학생을 대조하세요. 학생에게는 학생앱 가이드의 ‘낸 파일과 검사 결과 확인하기’를 보여 주세요.",
  },
  {
    title: "시험을 만들고 답안 준비하기", start: "강의 → 해당 차시 → 성적 → 시험 추가", menuPath: "/workspace/lectures",
    ...screenshot("create-exam", 4, "문항별 정답과 배점을 입력한 뒤 합계가 시험지 총점과 맞는지 확인하세요."),
    steps: ["‘시험 추가’에서 시험 이름과 채점 방식을 정하고 시험을 만드세요.",
      "실제 시험에 맞춰 문항 수와 유형을 저장한 뒤 각 문항의 정답과 배점을 입력하세요.",
      "배점 합계를 원본 시험지와 비교하고 응시 대상 학생을 확인하세요. OMR을 쓰는 수업이면 답안지도 준비하세요."],
    done: "해당 차시에 시험이 표시되고 문항 수와 총점이 실제 시험지와 일치합니다.",
    recovery: "총점이 다르면 문항별 배점과 비어 있는 정답을 먼저 확인하세요.",
  },
  {
    title: "학생 답안을 채점하고 점수 확인하기", start: "시험 → 해당 시험 → 직접 채점", menuPath: "/workspace/exams",
    ...screenshot("grade-exam", 4, "선택한 학생의 점수와 저장 상태를 함께 확인하세요."),
    steps: ["시험과 응시 학생을 선택하고 원본 답안을 옆에 두세요.",
      "직접 채점 화면에서 학생 답안과 서술형 점수를 확인하며 입력하세요. 비어 있는 문항이 있는지 확인하세요.",
      "저장 표시를 본 뒤 같은 학생을 다시 열고 문항별 점수와 총점을 대조하세요."],
    done: "다시 연 채점 화면에 해당 학생의 점수가 남아 있습니다.",
    recovery: "예상한 점수와 다르면 학생 이름, 정답, 배점과 서술형 입력을 대조한 뒤 결과를 안내하세요.",
  },
  {
    title: "알림톡 발송 결과 확인하기", start: "메시지 → 발송 내역", menuPath: "/workspace/message",
    ...screenshot("send-message", 5, "‘이번 발송 결과’의 접수·처리 현황을 보세요. ‘결과 새로 확인’을 누르면 최신 상태를 확인할 수 있습니다."),
    steps: ["새 안내를 보낼 때는 ‘알림톡 보내기’를 열고 학생 또는 학부모를 고르세요. 연락처와 승인된 알림톡 문구를 확인하세요.",
      "최종 확인창에서 대상 인원을 확인한 뒤 한 번만 발송하세요.",
      "발송 내역에서 같은 대상과 시각을 찾아 결과를 확인하세요. 대기 중이면 최종 상태가 나올 때까지 기다리세요."],
    done: "‘접수 완료’는 발송 요청이 접수된 상태입니다. 수신 결과는 화면에 표시된 별도 상태로 확인하세요.",
    recovery: "‘결과 확인 필요’라면 중복 발송을 피하도록 먼저 결과를 새로 확인하세요. ‘발송 실패’라면 대상과 실패 사유를 확인하세요.",
  },
];
