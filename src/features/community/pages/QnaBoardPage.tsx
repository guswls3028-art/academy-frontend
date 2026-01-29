import BoardTabs from "../components/BoardTabs";

export default function QnaBoardPage() {
  return (
    <div className="p-6">

      {/* 검색 & 필터 */}
      <div className="flex items-center gap-2 mb-4">
        <select className="border rounded px-2 py-1 text-sm">
          <option>전체</option>
          <option>답변 필요</option>
        </select>

        <input
          className="border rounded px-2 py-1 text-sm flex-1"
          placeholder="검색"
        />

        <button className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm">
          검색
        </button>
      </div>

      {/* 리스트 */}
      <div className="border rounded p-4 text-sm text-gray-700 mb-3">
        <div className="font-semibold">예시 QnA 제목</div>
        <div className="text-gray-500 text-xs">작성자 · 날짜</div>
      </div>

      <div className="text-center mt-6 text-gray-400 text-sm">1</div>
    </div>
  );
}
