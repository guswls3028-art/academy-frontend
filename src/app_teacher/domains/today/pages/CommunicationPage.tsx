// PATH: src/app_teacher/domains/today/pages/CommunicationPage.tsx
// 소통 탭 — 공지/Q&A 통합
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { EmptyState } from "@/shared/ui/ds";
import api from "@/shared/api/axios";

type Tab = "notices" | "qna";

async function fetchPosts(postType: string) {
  const res = await api.get("/community/posts/", {
    params: { post_type: postType, page_size: 20, ordering: "-created_at" },
  });
  const raw = res.data;
  return Array.isArray(raw?.results) ? raw.results : Array.isArray(raw) ? raw : [];
}

export default function CommunicationPage() {
  const [tab, setTab] = useState<Tab>("notices");

  const { data, isLoading } = useQuery({
    queryKey: ["community-mobile", tab],
    queryFn: () => fetchPosts(tab === "notices" ? "notice" : "qna"),
  });

  const posts = data ?? [];

  return (
    <div className="flex flex-col gap-3">
      {/* Tabs */}
      <div className="flex" style={{ borderBottom: "1px solid var(--tc-border)" }}>
        {(["notices", "qna"] as const).map((k) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className="flex-1 text-sm cursor-pointer"
            style={{
              padding: 12,
              background: "none",
              border: "none",
              borderBottom: tab === k ? "2px solid var(--tc-primary)" : "2px solid transparent",
              color: tab === k ? "var(--tc-primary)" : "var(--tc-text-secondary)",
              fontWeight: tab === k ? 700 : 500,
            }}
          >
            {k === "notices" ? "공지사항" : "Q&A"}
          </button>
        ))}
      </div>

      {isLoading ? (
        <EmptyState scope="panel" tone="loading" title="불러오는 중…" />
      ) : posts.length > 0 ? (
        <div className="flex flex-col">
          {posts.map((p: any) => (
            <div
              key={p.id}
              style={{ padding: "var(--tc-space-3) 0", borderBottom: "1px solid var(--tc-border-subtle)" }}
            >
              <div className="text-sm font-semibold" style={{ color: "var(--tc-text)" }}>{p.title}</div>
              <div className="text-xs mt-1" style={{ color: "var(--tc-text-muted)" }}>
                {p.author_name || "관리자"} · {new Date(p.created_at).toLocaleDateString("ko-KR")}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState scope="panel" tone="empty" title={tab === "notices" ? "공지사항이 없습니다" : "Q&A가 없습니다"} />
      )}
    </div>
  );
}
