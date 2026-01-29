import { useParams } from "react-router-dom";

export default function VideoWatchPage() {
  const { videoId } = useParams();

  return (
    <div>
      <h2>영상 시청</h2>
      <p>videoId: {videoId}</p>
    </div>
  );
}
