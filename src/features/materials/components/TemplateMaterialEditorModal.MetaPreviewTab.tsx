// PATH: src/features/materials/components/TemplateMaterialEditorModal.MetaPreviewTab.tsx
// NOTE:
// - objective_v1 meta 직접 조회 endpoint는 현재 assets에 존재하지 않는다.
// - 메타는 OMR 생성 시점에 외부/워커에서 생성되어 소비된다.
// - 이 탭은 유지하되, 스펙 안내 + TODO로 대체한다.

export function MetaPreviewTab() {
  return (
    <div className="space-y-4">
      <div className="rounded border bg-yellow-50 p-4 text-sm">
        <div className="font-semibold mb-1">OMR 메타데이터 (안내)</div>
        <ul className="list-disc ml-5 space-y-1">
          <li>
            현재 스펙에서 <b>assets는 메타를 생성/계산하지 않습니다.</b>
          </li>
          <li>
            메타는 OMR PDF와 1:1 대응되는 외부 산출물로,
            채점/인식 파이프라인에서 소비됩니다.
          </li>
          <li>
            프론트에서 임의 생성·추정·가공은 금지됩니다.
          </li>
        </ul>
      </div>

      <div className="rounded border p-4 text-sm text-gray-600">
        <div className="font-semibold mb-1">TODO</div>
        <ul className="list-disc ml-5 space-y-1">
          <li>exams/submissions에서 확정된 meta read-only 조회 연결</li>
          <li>PDF 자산과 연결된 meta 버전 표시</li>
        </ul>
      </div>
    </div>
  );
}
