// PATH: src/features/materials/components/TemplateMaterialEditorModal.AssetsTab.tsx
// NOTE:
// - assets 도메인은 더 이상 PDF 생성 API를 직접 노출하지 않는다.
// - OMR 생성은 exams 도메인 SSOT (/exams/<template_exam_id>/generate-omr/) 기준.
// - 이 탭은 유지하되, 현재 스펙 안내 + TODO로 대체한다.

export function AssetsTab({ templateExamId }: { templateExamId?: number }) {
  return (
    <div className="space-y-4">
      <div className="rounded border bg-yellow-50 p-4 text-sm">
        <div className="font-semibold mb-1">OMR 자산 생성 (안내)</div>
        <ul className="list-disc ml-5 space-y-1">
          <li>
            현재 스펙에서 OMR PDF 생성은 <b>assets</b>가 아닌{" "}
            <b>exams 도메인</b> 책임입니다.
          </li>
          <li>
            사용 API:{" "}
            <code className="px-1 bg-white border rounded">
              POST /exams/&lt;template_exam_id&gt;/generate-omr/
            </code>
          </li>
          <li>이 탭은 UX 일관성을 위해 유지됩니다.</li>
        </ul>
      </div>

      <div className="rounded border p-4 text-sm text-gray-600">
        <div className="font-semibold mb-1">TODO</div>
        <ul className="list-disc ml-5 space-y-1">
          <li>exams 자산 생성 API 상태 조회 표시</li>
          <li>생성 이력(assets list) 바로가기</li>
          <li>권한/락 상태에 따른 버튼 활성 제어</li>
        </ul>
      </div>

      {!templateExamId && (
        <div className="text-xs text-red-600">
          templateExamId가 없어 실제 생성은 비활성 상태입니다.
        </div>
      )}
    </div>
  );
}
