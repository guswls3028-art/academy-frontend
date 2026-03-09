import { useCallback, useMemo, useState } from "react";
import { Phone, Copy, Check } from "lucide-react";

const MESSAGE_TITLE = "지금은 업데이트 반영중입니다.";
const MESSAGE_BODY = "필요시 개발자에게 연락주세요.";
const PHONE_NUMBER_DISPLAY = "010 - 3121 - 7466";
const PHONE_NUMBER_RAW = "01031217466";

export default function MaintenancePage() {
  const [copied, setCopied] = useState(false);

  const telHref = useMemo(() => `tel:${PHONE_NUMBER_RAW}`, []);

  const onCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(PHONE_NUMBER_DISPLAY);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      // ignore (e.g., non-secure context)
    }
  }, []);

  return (
    <div
      className="fixed inset-0 z-[9999] overflow-auto bg-slate-950 text-slate-50"
      role="dialog"
      aria-modal="true"
      aria-label="업데이트 반영 안내"
    >
      {/* background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-fuchsia-500/20 blur-[90px]" />
        <div className="absolute -bottom-40 left-10 h-[560px] w-[560px] rounded-full bg-cyan-400/15 blur-[100px]" />
        <div className="absolute right-0 top-1/3 h-[520px] w-[520px] rounded-full bg-indigo-500/20 blur-[100px]" />
        <div className="absolute inset-0 bg-[radial-gradient(1200px_700px_at_50%_-10%,rgba(255,255,255,0.12),transparent_60%)]" />
      </div>

      <div className="relative mx-auto flex min-h-full max-w-5xl items-center justify-center px-6 py-14 md:px-10">
        <div className="w-full max-w-3xl">
          <div className="rounded-[28px] border border-white/10 bg-white/5 p-8 shadow-[0_30px_120px_rgba(0,0,0,0.55)] backdrop-blur-2xl md:p-12">
            <div className="flex items-start justify-between gap-6">
              <div className="min-w-0">
                <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold tracking-wide text-white/80">
                  <span className="h-2 w-2 rounded-full bg-emerald-400/90 shadow-[0_0_18px_rgba(52,211,153,0.8)]" />
                  UPDATE IN PROGRESS
                </div>

                <h1 className="text-balance text-3xl font-black leading-tight tracking-tight md:text-5xl">
                  {MESSAGE_TITLE}
                </h1>

                <p className="mt-4 text-pretty text-lg font-semibold text-slate-200/90 md:text-2xl">
                  {MESSAGE_BODY}
                </p>
              </div>

              <div className="hidden shrink-0 md:block">
                <div className="grid h-14 w-14 place-items-center rounded-2xl border border-white/10 bg-white/5 shadow-[0_12px_40px_rgba(0,0,0,0.45)]">
                  <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-fuchsia-400/80 via-indigo-400/70 to-cyan-300/70 blur-[0.2px]" />
                </div>
              </div>
            </div>

            <div className="mt-10 rounded-2xl border border-white/10 bg-black/20 p-5 md:p-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <a
                  href={telHref}
                  className="group inline-flex items-center gap-3 text-xl font-extrabold tracking-tight md:text-3xl"
                >
                  <span className="grid h-11 w-11 place-items-center rounded-2xl border border-white/10 bg-white/5">
                    <Phone className="h-5 w-5 text-white/90" />
                  </span>
                  <span className="underline decoration-white/20 underline-offset-4 group-hover:decoration-white/45">
                    {PHONE_NUMBER_DISPLAY}
                  </span>
                </a>

                <button
                  type="button"
                  onClick={onCopy}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-bold text-white/90 shadow-[0_12px_40px_rgba(0,0,0,0.35)] transition hover:bg-white/10 active:scale-[0.99] md:text-base"
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4" />
                      복사됨
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      번호 복사
                    </>
                  )}
                </button>
              </div>

              <div className="mt-3 text-xs font-semibold text-white/55 md:text-sm">
                전화번호를 눌러 바로 통화할 수 있어요.
              </div>
            </div>

            <div className="mt-8 flex flex-wrap items-center justify-between gap-3 text-xs font-semibold text-white/45 md:text-sm">
              <div>서비스 안정화를 위해 순차 반영 중입니다.</div>
              <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                감사합니다
              </div>
            </div>
          </div>

          <div className="mt-6 text-center text-xs font-semibold text-white/35 md:text-sm">
            이 화면은 공용 유지보수 안내 페이지로 재사용할 수 있습니다.
          </div>
        </div>
      </div>
    </div>
  );
}

