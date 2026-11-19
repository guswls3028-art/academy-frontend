// Only the dedicated public review Worker imports this module.
const apps = [
  ["teacher", "선생앱", "/login/dawon?demo=teacher"],
  ["student", "학생앱", "/?preview=student"],
  ["guardian", "학부모앱", "/?preview=guardian"],
  ["admin", "관리자앱", "/login/dawon?demo=admin"],
];

const style = `<style id="dawon-demo-switcher-style">
:root{--dawon-demo-bar-height:calc(44px + env(safe-area-inset-top,0px));scroll-padding-top:var(--dawon-demo-bar-height)}
body{padding-block-start:var(--dawon-demo-bar-height)!important}
#dawon-demo-switcher{position:fixed;inset:0 0 auto;z-index:100001;box-sizing:border-box;height:var(--dawon-demo-bar-height);padding:env(safe-area-inset-top,0px) 12px 0;display:flex;justify-content:center;align-items:stretch;background:#fffcfa;border-bottom:1px solid #e6ded8;font:600 14px/1.2 system-ui,sans-serif;color:#5b5049}
#dawon-demo-switcher a{position:relative;display:flex;align-items:center;justify-content:center;min-width:0;width:96px;padding:0 8px;text-decoration:none;color:inherit;box-sizing:border-box;white-space:nowrap}
#dawon-demo-switcher a[aria-current=page]{color:#9b430c;font-weight:750}
#dawon-demo-switcher a[aria-current=page]::after{position:absolute;content:"";height:3px;bottom:0;left:17%;right:17%;border-radius:3px 3px 0 0;background:#d25a12}
#dawon-demo-switcher a:hover{background:#fff0e4}
#dawon-demo-switcher a:focus-visible{outline:2px solid #a6460b;outline-offset:-3px}
body .role-preview, #dawon-preview-roles{display:none!important}
body [data-app=admin]{height:calc(100dvh - var(--dawon-demo-bar-height));min-height:calc(100dvh - var(--dawon-demo-bar-height))}
body [data-app=admin] [data-analytics-placement="admin.sidebar"]{max-height:calc(100dvh - var(--panel-header) - var(--dawon-demo-bar-height))}
body [data-app=teacher]>header, body .student-layout__header, body.learning-room .route-header{top:var(--dawon-demo-bar-height)}
body.learning-room .route-rail{top:var(--dawon-demo-bar-height);max-height:calc(100dvh - var(--dawon-demo-bar-height))}
#dawon-preview-scope{display:none}
body:has([data-app=auth]) #dawon-preview-scope{display:block}
@media print{#dawon-demo-switcher{display:none!important}body{padding-block-start:0!important}:root{--dawon-demo-bar-height:0px}}
</style>`;

export function insertDemoSwitcher(html, url, native) {
  const path = url.pathname;
  const role = url.searchParams.get("demo") === "admin" || path.startsWith("/workspace/dawon-operations") ? "admin" : path === "/guardian" || url.searchParams.get("preview") === "guardian" || url.searchParams.get("demo") === "guardian" ? "guardian" :
    native && !path.startsWith("/student/") && url.searchParams.get("demo") !== "student" ? "teacher" : "student";
  const links = apps.map(([key, name, href]) =>
    `<a href="${href}" data-demo-app="${key}"${key === role ? ' aria-current="page"' : ''}>${name}</a>`).join("");
  return html.replace("</head>", style + '<script src="/dawon-demo-role.js" defer></script></head>')
    .replace(/<body\b[^>]*>/i, tag => tag + `<nav id="dawon-demo-switcher" aria-label="데모 앱 전환" data-shell="${native ? "native" : "learner"}">${links}</nav>`);
}

function mountDemoSwitcher() {
  const nav = document.getElementById("dawon-demo-switcher");
  if (!nav) return;
  const roleLinks = Array.from(nav.querySelectorAll("a[data-demo-app]"));
  const edits = new Set();
  function currentRole() {
    if (nav.dataset.shell === "learner") return document.body.dataset.role === "guardian" || location.pathname === "/guardian" ? "guardian" : "student";
    const demoRole = new URLSearchParams(location.search).get("demo");
    if (["admin","teacher","guardian","student"].includes(demoRole)) return demoRole;
    if (!location.pathname.startsWith("/student/")) {
      if (location.pathname.startsWith("/workspace/dawon-operations")) return "admin";
      try { if (sessionStorage.getItem("dawon-workspace-role") === "admin") return "admin"; } catch {}
      return "teacher";
    }
    try {
      if (sessionStorage.getItem("dawon-room-role") === "guardian") return "guardian";
    } catch {}
    return "student";
  }
  function markRole() {
    const role = currentRole();
    for (const link of roleLinks) {
      if (link.dataset.demoApp === role) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    }
  }
  const sync = () => { markRole(); };
  markRole();
  new MutationObserver(sync).observe(document.body, {attributes:true,attributeFilter:["data-role"]});
  window.addEventListener("popstate",sync);
  for (const method of ["pushState", "replaceState"]) {
    const original=history[method];
    history[method]=function(...args){const result=original.apply(this,args);sync();return result;};
  }
  document.addEventListener("input",event=>{
    const field=event.target;
    if (field instanceof HTMLElement && field.matches("input:not([type=search]):not([type=hidden]),textarea,select,[contenteditable=true]") &&
        field.closest("form,dialog,[role=dialog]") && !field.matches('[role=searchbox]')) edits.add(field);
  },true);
  nav.addEventListener("click", event=>{
    const link=event.target.closest("a[data-demo-app]");
    if(!link || event.button!==0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const editing=[...edits].some(field=>field.isConnected && field.getClientRects().length);
    if(editing && !window.confirm("작성 중인 내용을 두고 앱을 전환할까요?")) { event.preventDefault(); return; }
    const next = link.dataset.demoApp;
    try {
      if (next === "teacher" || next === "admin") {
        sessionStorage.removeItem("session_return_path");
        sessionStorage.removeItem("dawon:open-teacher-demo");
      } else {
        sessionStorage.setItem("dawon-room-role",next);
      }
    } catch {}
  });
}
export const demoSwitcherScript = "(" + mountDemoSwitcher.toString() + ")();";
