import { useParams } from "react-router-dom";

export default function QnaDetailPage() {
  const { qnaId } = useParams();

  return (
    <div>
      <h2>Q&A 상세</h2>
      <p>qnaId: {qnaId}</p>
    </div>
  );
}
