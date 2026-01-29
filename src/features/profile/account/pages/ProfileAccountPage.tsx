import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FiKey, FiLogOut } from "react-icons/fi";

import { fetchMe, updateProfile } from "../../api/profile.api";
import useAuth from "@/features/auth/hooks/useAuth";

import AccountHeader from "../components/AccountHeader";
import AccountInfoList from "../components/ProfileInfoCard";
import ChangePasswordModal from "../components/ChangePasswordModal";

import { PageSection } from "@/shared/ui/page";
import { EmptyState } from "@/shared/ui/feedback";

export default function ProfileAccountPage() {
  const qc = useQueryClient();
  const { clearAuth } = useAuth();

  const meQ = useQuery({
    queryKey: ["me"],
    queryFn: fetchMe,
  });

  const updateMut = useMutation({
    mutationFn: updateProfile,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["me"] });
    },
  });

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [pwOpen, setPwOpen] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (meQ.data) {
      setName(meQ.data.name ?? "");
      setPhone(meQ.data.phone ?? "");
    }
  }, [meQ.data]);

  const dirty = useMemo(() => {
    return name !== (meQ.data?.name ?? "") || phone !== (meQ.data?.phone ?? "");
  }, [name, phone, meQ.data]);

  const save = async () => {
    setMessage(null);
    try {
      await updateMut.mutateAsync({
        name: name.trim() || undefined,
        phone: phone.trim() || undefined,
      });
      setMessage({ type: "ok", text: "저장 완료" });
    } catch {
      setMessage({ type: "error", text: "저장 실패" });
    }
  };

  return (
    <>
      {/* ✅ 이 페이지 전용 스타일: 전역 CSS 건드리지 않음 */}
      <style>{`
        .acc-wrap{
          max-width: 980px;
          /* ✅ 왼쪽 정렬 + 여백 최소 */
          margin: 0;
        }
        .acc-toolbar{
          display:flex;
          align-items:center;
          gap:10px;
          flex-wrap:wrap;
        }

        /* 카드 */
        .acc-card{
          width: 100%;
          background: var(--bg-surface);
          border: 1px solid var(--border-divider);
          border-radius: 14px;
          box-shadow: 0 6px 18px rgba(0,0,0,0.08);
          overflow: hidden;
        }
        .acc-card-head{
          display:flex;
          align-items:flex-start;
          justify-content:space-between;
          gap:12px;
          padding: 16px 16px 12px 16px;
          background: var(--bg-surface);
          border-bottom: 1px solid var(--border-divider);
        }
        .acc-title{
          font-size: 15px;
          font-weight: 800;
          color: var(--text-primary);
          line-height: 1.2;
        }
        .acc-sub{
          margin-top: 4px;
          font-size: 12px;
          color: var(--text-muted);
        }

        /* 리스트 row */
        .acc-list{
          display:flex;
          flex-direction:column;
        }
        .acc-row{
          display:grid;
          grid-template-columns: 140px 1fr;
          align-items:center;
          gap: 12px;
          padding: 12px 16px;
          border-bottom: 1px solid var(--border-divider);
        }
        .acc-row:last-child{
          border-bottom:none;
        }
        .acc-label{
          font-size: 13px;
          color: var(--text-muted);
        }
        .acc-cell{
          display:flex;
          align-items:center;
          justify-content:flex-start; /* ✅ 오른쪽 허공 금지 */
          min-width: 0;
        }
        .acc-value{
          font-size: 14px;
          font-weight: 700;
          color: var(--text-primary);
        }

        /* 입력 */
        .acc-input{
          width: min(420px, 100%);
          height: 38px;
          padding: 0 12px;
          border-radius: 10px;
          border: 1px solid var(--border-divider);
          background: var(--bg-surface);
          outline: none;
          font-size: 14px;
        }
        .acc-input:focus{
          border-color: var(--color-primary);
          box-shadow: 0 0 0 3px rgba(0,0,0,0.08);
        }

        /* 푸터 */
        .acc-card-foot{
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap: 10px;
          padding: 12px 16px;
          background: var(--bg-surface-soft);
          border-top: 1px solid var(--border-divider);
          flex-wrap: wrap;
        }
        .acc-hint{ font-size: 12px; color: var(--text-muted); }
        .acc-hint-warn{ color: var(--color-danger); font-weight: 700; }
        .acc-hint-ok{ color: var(--text-muted); font-weight: 600; }

        .acc-toast{
          font-size: 12px;
          padding: 6px 10px;
          border-radius: 999px;
          border: 1px solid var(--border-divider);
          background: var(--bg-surface);
        }
        .acc-toast.ok{
          border-color: rgba(34,197,94,0.35);
          color: rgb(21,128,61);
          background: rgba(34,197,94,0.08);
        }
        .acc-toast.err{
          border-color: rgba(239,68,68,0.35);
          color: rgb(185,28,28);
          background: rgba(239,68,68,0.08);
        }

        /* 버튼: "글자처럼 보이는 버튼" 금지 */
        .acc-btn{
          display:inline-flex;
          align-items:center;
          gap:8px;
          height: 36px;
          padding: 0 12px;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 700;
          border: 1px solid var(--border-divider);
          background: var(--bg-surface);
          color: var(--text-primary);
          cursor: pointer;
          transition: transform 0.05s ease, background 0.12s ease, border-color 0.12s ease;
        }
        .acc-btn:hover{
          background: var(--bg-surface-soft);
          border-color: rgba(0,0,0,0.2);
        }
        .acc-btn:active{
          transform: translateY(1px);
        }
        .acc-btn:disabled{
          opacity: 0.55;
          cursor: not-allowed;
          transform:none;
        }
        .acc-btn-primary{
          background: var(--color-primary);
          border-color: var(--color-primary);
          color: #fff;
        }
        .acc-btn-primary:hover{
          filter: brightness(0.95);
          background: var(--color-primary);
        }
        .acc-btn-danger{
          background: rgba(239,68,68,0.10);
          border-color: rgba(239,68,68,0.35);
          color: rgb(185,28,28);
        }
        .acc-btn-danger:hover{
          background: rgba(239,68,68,0.16);
        }
      `}</style>

      <AccountHeader />

      {/* 액션 */}
      <PageSection>
        <div className="acc-wrap">
          <div className="acc-toolbar">
            <button className="acc-btn" onClick={() => setPwOpen(true)}>
              <FiKey size={14} />
              비밀번호 변경
            </button>

            <button className="acc-btn acc-btn-danger" onClick={clearAuth}>
              <FiLogOut size={14} />
              로그아웃
            </button>
          </div>
        </div>
      </PageSection>

      {/* 내 정보 */}
      <PageSection title="내 정보">
        <div className="acc-wrap">
          {meQ.isLoading && <div className="text-sm text-[var(--text-muted)]">불러오는 중...</div>}
          {meQ.isError && <EmptyState message="내 정보 조회 실패" />}

          {meQ.data && (
            <AccountInfoList
              me={meQ.data}
              name={name}
              phone={phone}
              onChangeName={setName}
              onChangePhone={setPhone}
              onSave={save}
              saving={updateMut.isPending}
              dirty={dirty}
              message={message}
            />
          )}
        </div>
      </PageSection>

      <ChangePasswordModal open={pwOpen} onClose={() => setPwOpen(false)} />
    </>
  );
}
