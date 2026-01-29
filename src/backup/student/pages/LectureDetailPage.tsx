import { useParams } from "react-router-dom";

export default function LectureDetailPage() {
  const { lectureId } = useParams();

  return (
    <div>
      <h2>강의 상세</h2>
      <p>lectureId: {lectureId}</p>
    </div>
  );
}
