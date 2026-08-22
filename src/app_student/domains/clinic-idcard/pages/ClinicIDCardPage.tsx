import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { studentQueryKeys } from "@student/shared/api/queryKeys";
import StudentNameWithLectureChip from "@/shared/ui/chips/StudentNameWithLectureChip";
import LectureChip from "@/shared/ui/chips/LectureChip";
import { fetchClinicIdcard } from "../api/idcard";
import "../styles/idcard.css";

type PasscardStyle = CSSProperties & {
  "--passcard-color-1"?: string;
  "--passcard-color-2"?: string;
  "--passcard-color-3"?: string;
};

function formatDate(date: Date): string {
  const weekdays = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 ${weekdays[date.getDay()]}`;
}

function formatTime(date: Date): string {
  const hour = date.getHours();
  const period = hour < 12 ? "오전" : "오후";
  return `${period} ${hour % 12 || 12}:${String(date.getMinutes()).padStart(2, "0")}:${String(date.getSeconds()).padStart(2, "0")}`;
}

function useServerClock(serverDatetime?: string) {
  const offset = useMemo(() => {
    if (!serverDatetime) return 0;
    const serverMs = Date.parse(serverDatetime);
    return Number.isFinite(serverMs) ? serverMs - Date.now() : 0;
  }, [serverDatetime]);
  const [now, setNow] = useState(() => new Date(Date.now() + offset));

  useEffect(() => {
    setNow(new Date(Date.now() + offset));
    const timer = window.setInterval(() => setNow(new Date(Date.now() + offset)), 1000);
    return () => window.clearInterval(timer);
  }, [offset]);

  return now;
}

export default function ClinicIDCardPage() {
  const query = useQuery({
    queryKey: studentQueryKeys.clinicIdcard,
    queryFn: fetchClinicIdcard,
    refetchInterval: 2_000,
    refetchIntervalInBackground: false,
  });
  const now = useServerClock(query.data?.server_datetime);

  if (query.isLoading) {
    return <div className="clinic-idcard-state" role="status">패스카드를 불러오는 중…</div>;
  }

  if (query.isError || !query.data) {
    return (
      <div className="clinic-idcard-state clinic-idcard-state--error" role="alert">
        <strong>패스카드를 불러오지 못했습니다.</strong>
        <span>네트워크를 확인한 뒤 다시 시도해 주세요.</span>
        <button type="button" onClick={() => query.refetch()}>다시 시도</button>
      </div>
    );
  }

  const { data } = query;
  const isClinicTarget = data.current_result === "FAIL";
  const style: PasscardStyle = isClinicTarget ? {} : {
    "--passcard-color-1": data.background_colors[0],
    "--passcard-color-2": data.background_colors[1],
    "--passcard-color-3": data.background_colors[2],
  };
  const historiesByLecture = Array.from(
    data.histories.reduce((groups, history) => {
      const key = history.enrollment_id ?? history.lecture_id ?? 0;
      const current = groups.get(key) ?? [];
      groups.set(key, [...current, history]);
      return groups;
    }, new Map<number, typeof data.histories>()),
  );

  return (
    <div
      className={`clinic-idcard ${isClinicTarget ? "clinic-idcard--fail" : "clinic-idcard--pass"}`}
      style={style}
      data-testid="clinic-passcard"
    >
      <div className="clinic-idcard__aurora" aria-hidden />
      <header className="clinic-idcard__header">
        <span className="clinic-idcard__live"><i aria-hidden /> LIVE</span>
        <div className="clinic-idcard__clock">
          <span>{formatDate(now)}</span>
          <strong aria-label={`현재 시각 ${formatTime(now)}`}>{formatTime(now)}</strong>
        </div>
      </header>

      <main className="clinic-idcard__main">
        <div className="clinic-idcard__identity">
          <StudentNameWithLectureChip
            name={data.student_name || "학생 정보 없음"}
            profilePhotoUrl={data.profile_photo_url}
            avatarSize={36}
            lectures={data.lectures.map((lecture) => ({
              lectureName: lecture.title,
              color: lecture.color,
              chipLabel: lecture.chip_label,
            }))}
            clinicHighlight={isClinicTarget}
            maxLectureChips={3}
          />
        </div>

        <section className="clinic-idcard__verdict" aria-label="현재 클리닉 판정">
          <span className="clinic-idcard__verdict-mark" aria-hidden>{isClinicTarget ? "!" : "✓"}</span>
          <div>
            <p>{isClinicTarget ? "확인이 필요해요" : "오늘 수업 완료"}</p>
            <h1>{isClinicTarget ? "클리닉 예약 대상자" : "합격"}</h1>
            <span>{isClinicTarget ? "필요한 보강 일정을 예약해 주세요." : "선생님께 이 화면을 보여 주세요."}</span>
          </div>
        </section>

        {isClinicTarget && (
          <Link to="/student/clinic" className="clinic-idcard__booking-link">클리닉 일정 예약하기</Link>
        )}

        <section className="clinic-idcard__history" aria-labelledby="clinic-idcard-history-title">
          <div className="clinic-idcard__history-heading">
            <h2 id="clinic-idcard-history-title">차시별 상태</h2>
            <span>{data.histories.length}개 차시</span>
          </div>
          {historiesByLecture.length === 0 ? (
            <p className="clinic-idcard__history-empty">아직 표시할 차시 결과가 없습니다.</p>
          ) : (
            historiesByLecture.map(([groupKey, histories]) => {
              const first = histories[0];
              return (
                <div key={groupKey} className="clinic-idcard__history-group">
                  {first?.lecture_title && (
                    <div className="clinic-idcard__lecture">
                      <LectureChip
                        lectureName={first.lecture_title}
                        color={first.lecture_color ?? undefined}
                        chipLabel={first.lecture_chip_label}
                      />
                      <span>{first.lecture_title}</span>
                    </div>
                  )}
                  <div className="clinic-idcard__history-grid">
                    {histories.map((history) => (
                      <div
                        key={`${history.enrollment_id ?? 0}-${history.session_id ?? history.session_order}`}
                        className={`clinic-idcard__history-item ${history.clinic_required ? "clinic-idcard__history-item--fail" : "clinic-idcard__history-item--pass"}`}
                      >
                        <strong>{history.session_order}차시</strong>
                        <span>{history.clinic_required ? "클리닉 대상" : "합격"}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </section>
      </main>
    </div>
  );
}
