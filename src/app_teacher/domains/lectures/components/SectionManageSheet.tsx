// PATH: src/app_teacher/domains/lectures/components/SectionManageSheet.tsx
// 반 편성 관리 시트 — 반 생성/삭제
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import BottomSheet from "@teacher/shared/ui/BottomSheet";
import { Plus, Trash2 } from "@teacher/shared/ui/Icons";
import { teacherToast } from "@teacher/shared/ui/teacherToast";
import api from "@/shared/api/axios";

interface Props {
  open: boolean;
  onClose: () => void;
  lectureId: number;
}

export default function SectionManageSheet({ open, onClose, lectureId }: Props) {
  const qc = useQueryClient();
  const [newLabel, setNewLabel] = useState("");

  const { data: sections } = useQuery({
    queryKey: ["lecture-sections", lectureId],
    queryFn: async () => {
      const res = await api.get("/lectures/sections/", { params: { lecture: lectureId, page_size: 100 } });
      return Array.isArray(res.data?.results) ? res.data.results : Array.isArray(res.data) ? res.data : [];
    },
    enabled: open,
  });

  const createSectionMut = useMutation({
    mutationFn: () => api.post("/lectures/sections/", { lecture: lectureId, label: newLabel, section_type: "CLASS" }),
    onSuccess: () => { teacherToast.success(`${newLabel} 반이 생성되었습니다.`); setNewLabel(""); qc.invalidateQueries({ queryKey: ["lecture-sections", lectureId] }); },
  });

  const deleteSectionMut = useMutation({
    mutationFn: (id: number) => api.delete(`/lectures/sections/${id}/`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["lecture-sections", lectureId] }); teacherToast.info("반이 삭제되었습니다."); },
  });

  return (
    <BottomSheet open={open} onClose={onClose} title="반 편성">
      <div className="flex flex-col gap-3" style={{ padding: "var(--tc-space-2) 0" }}>
        {/* Create section */}
        <div className="flex gap-2">
          <input type="text" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="반 이름 (예: A반)"
            className="flex-1 text-sm"
            style={{ padding: "8px 10px", borderRadius: "var(--tc-radius-sm)", border: "1px solid var(--tc-border-strong)", background: "var(--tc-surface-soft)", color: "var(--tc-text)", outline: "none" }} />
          <button onClick={() => createSectionMut.mutate()} disabled={!newLabel.trim()}
            className="flex items-center gap-1 text-xs font-bold cursor-pointer shrink-0"
            style={{ padding: "8px 12px", borderRadius: "var(--tc-radius)", border: "none", background: "var(--tc-primary)", color: "#fff", opacity: !newLabel.trim() ? 0.5 : 1 }}>
            <Plus size={13} /> 추가
          </button>
        </div>
        {/* Section list */}
        <div className="flex flex-col gap-1">
          {(sections ?? []).map((s: any) => (
            <div key={s.id} className="flex items-center justify-between py-2"
              style={{ borderBottom: "1px solid var(--tc-border-subtle)" }}>
              <span className="text-sm" style={{ color: "var(--tc-text)" }}>{s.label} ({s.section_type})</span>
              <button onClick={() => { if (confirm(`"${s.label}" 반을 삭제하시겠습니까?`)) deleteSectionMut.mutate(s.id); }}
                className="flex p-1 cursor-pointer" style={{ background: "none", border: "none", color: "var(--tc-danger)" }}>
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          {sections?.length === 0 && <div className="text-sm py-2" style={{ color: "var(--tc-text-muted)" }}>등록된 반이 없습니다</div>}
        </div>
      </div>
    </BottomSheet>
  );
}
