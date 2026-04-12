import { useMemo } from "react";
import { Phone } from "lucide-react";

const MESSAGE_TITLE = "지금은 업데이트 반영중입니다.";
const MESSAGE_BODY = "필요시 개발자에게 연락주세요.";
const PHONE_NUMBER_DISPLAY = "010 - 3121 - 7466";
const PHONE_NUMBER_RAW = "01031217466";

export default function MaintenancePage() {
  const telHref = useMemo(() => `tel:${PHONE_NUMBER_RAW}`, []);

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
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

