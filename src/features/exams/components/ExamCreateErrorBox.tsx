// PATH: src/features/exams/components/ExamCreateErrorBox.tsx
export default function ExamCreateErrorBox({ error }: { error: any }) {
  if (!error) return null;

  const status = error?.response?.status;
  const detail = error?.response?.data?.detail;

  let message = "시험 생성에 실패했습니다.";

  if (status === 400) {
    if (detail?.includes("template")) {
      message = "템플릿 선택이 유효하지 않습니다.";
    } else if (detail?.includes("session")) {
      message = "차시(session) 선택이 유효하지 않습니다.";
    } else {
      message = "입력값을 다시 확인하세요.";
    }
  }

  if (status === 403) {
    message = "선생님 또는 관리자 권한이 필요합니다.";
  }

  return (
    <div className="rounded border border-red-600/30 bg-red-600/10 p-3 text-sm text-red-700">
      {message}
    </div>
  );
}
