import { staffConsoleScript } from './dawon-staff-consoles.mjs';
import { installEdition, installStaffReturn, staffReturnPath, staffProgramUrl, editions } from './dawon-editions.mjs';

// Only the dedicated public review Worker imports this module.
const apps = [
  ["teacher", "선생님용", "/login/dawon?demo=teacher"],
  ["admin", "관리자", "/login/dawon?demo=admin"],
  ["student", "학생", "/?preview=student"],
  ["guardian", "학부모", "/?preview=guardian"],
];

const style = `<style id="dawon-demo-switcher-style">
:root{--dawon-demo-bar-height:calc(44px + env(safe-area-inset-top,0px));scroll-padding-top:var(--dawon-demo-bar-height)}
body{padding-block-start:var(--dawon-demo-bar-height)!important}
#dawon-demo-switcher{position:fixed;inset:0 0 auto;z-index:100001;height:var(--dawon-demo-bar-height);box-sizing:border-box;padding:env(safe-area-inset-top,0px) 12px 0;display:flex;align-items:stretch;justify-content:center;background:#fffcfa;border-bottom:1px solid #e6ded8;font:650 14px/1.2 system-ui,sans-serif;color:#514940}
.dawon-demo-roles{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));width:min(100%,240px)}
.dawon-demo-roles[data-family]{grid-template-columns:repeat(4,minmax(0,1fr));width:min(100%,480px)}
#dawon-demo-switcher .dawon-edition-home{flex:none;align-self:center;min-height:32px;padding:0 12px;border-inline-end:1px solid #c8c5c1;font-size:13px}
@media(max-width:600px){#dawon-demo-switcher:has(.dawon-edition-home){padding-inline:4px}#dawon-demo-switcher .dawon-edition-home{padding-inline:7px}}
#dawon-demo-switcher a{position:relative;display:grid;place-items:center;min-width:0;padding:0 4px;color:inherit;text-decoration:none;white-space:nowrap}
#dawon-demo-switcher a[aria-current=page]{color:#873b0e;background:#fff1e6;font-weight:750}
#dawon-demo-switcher a[aria-current=page]::after{position:absolute;content:"";height:3px;bottom:0;inset-inline:20%;border-radius:3px 3px 0 0;background:#d25a12}
#dawon-demo-switcher a:hover{background:#fff4ed}
#dawon-demo-switcher a:focus-visible{outline:2px solid #a6460b;outline-offset:-3px}
body:has(.admin-modal-wrap:not([style*="display: none"]) .admin-modal[role="dialog"],.ds-overlay-panel[role="dialog"]) #dawon-demo-switcher{z-index:10}

body .role-preview, #dawon-preview-roles{display:none!important}
body [data-workspace-shell]{height:calc(100dvh - var(--dawon-demo-bar-height));min-height:calc(100dvh - var(--dawon-demo-bar-height))}
body [data-app=admin] [data-analytics-placement="admin.sidebar"]{max-height:calc(100dvh - var(--panel-header) - var(--dawon-demo-bar-height))}
body [data-app=teacher]>header, body .student-layout__header, body.learning-room .route-header{top:var(--dawon-demo-bar-height)}
body.learning-room .route-rail{top:var(--dawon-demo-bar-height);max-height:calc(100dvh - var(--dawon-demo-bar-height))}
#dawon-preview-scope{display:none}
body:has([data-app=auth]) #dawon-preview-scope{display:block}
@media print{#dawon-demo-switcher{display:none!important}body{padding-block-start:0!important}:root{--dawon-demo-bar-height:0px}}
</style>`;

export function insertDemoSwitcher(html, url, native) {
  const path = url.pathname;
  const staff = native && staffProgramUrl(url);
  const role = /^\/workspace(?:\/|$)/.test(path) ? null : url.searchParams.get("demo") === "admin" ? "admin" : path === "/guardian" || url.searchParams.get("preview") === "guardian" || url.searchParams.get("demo") === "guardian" ? "guardian" :
    native && !path.startsWith("/student/") && url.searchParams.get("demo") !== "student" ? "teacher" : "student";
  const choice = Object.hasOwn(editions,url.searchParams.get('edition')) ? url.searchParams.get('edition') : 'A';
  const links = apps.flatMap(([key, name, href]) => {
    const employee = key === 'teacher' || key === 'admin';
    if (staff && !employee) return [];
    const target = staff ? href + '&amp;edition=' + choice : employee ? '/staff/' + key : href;
    return [`<a href="${target}" data-demo-app="${key}"${key === role ? ' aria-current="page"' : ''}>${name}</a>`];
  }).join("");
  const editionHome = staff ? '<a class="dawon-edition-home" data-edition-home href="/' + choice.toLowerCase() +
    '" aria-label="' + choice + '안 교직원 홈">' + choice + '안</a>' : '';
  const page = staff ? html.replace(/<html\b/i,'<html data-dawon-edition="' + choice + '"') : html;
  return page.replace("</head>", style + '<script src="/dawon-demo-role.js" defer></script></head>')
    .replace(/<body\b[^>]*>/i, tag => tag + `<nav id="dawon-demo-switcher" aria-label="데모 앱 전환" data-shell="${native ? "native" : "learner"}">${editionHome}<div class="dawon-demo-roles"${staff ? '' : ' data-family'}>${links}</div></nav>`);
}

function mountDemoSwitcher() {
  const nav = document.getElementById("dawon-demo-switcher");
  if (!nav) return;
  const roleLinks = Array.from(nav.querySelectorAll("a[data-demo-app]"));
  const edits = new Set();
  function currentRole() {
    if (nav.dataset.shell === "learner") return document.body.dataset.role === "guardian" || location.pathname === "/guardian" || new URLSearchParams(location.search).get("preview") === "guardian" ? "guardian" : "student";
    if (/^\/workspace(?:\/|$)/.test(location.pathname)) {
      const role = document.querySelector('[data-workspace-shell] [data-dawon-staff]')?.dataset.dawonStaff;
      return role === 'admin' || role === 'teacher' ? role : null;
    }
    const demoRole = new URLSearchParams(location.search).get("demo");
    if (["admin","teacher","guardian","student"].includes(demoRole)) return demoRole;
    if (!location.pathname.startsWith("/student/")) {
      return null;
    }
    try {
      if (sessionStorage.getItem("dawon-room-role") === "guardian") return "guardian";
    } catch {}
    return "student";
  }
  function markRole() {
    const role = currentRole();
    const profileHome = document.querySelector('.breadcrumbs a[data-dawon-profile-home]');
    if (profileHome) profileHome.href = role === 'guardian' ? '/?preview=guardian' : '/';
    for (const link of roleLinks) {
      if (link.dataset.demoApp === role) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    }
  }
  const sync = () => { markRole(); };
  markRole();
  new MutationObserver(sync).observe(document.body, {childList:true,subtree:true,attributes:true,attributeFilter:["data-role","data-dawon-staff"]});
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
    const link=event.target.closest("a[data-demo-app],a[data-edition-home]");
    if(!link || event.button!==0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const editing=[...edits].some(field=>field.isConnected && field.getClientRects().length);
    if(editing && !window.confirm("작성 중인 내용을 두고 화면을 전환할까요?")) { event.preventDefault(); return; }
    const next = link.dataset.demoApp;
    if (!next) return;
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
export const demoSwitcherScript = "(" + installEdition.toString() + ")(" + staffProgramUrl.toString() + ");\n(" + installStaffReturn.toString() + ")(" + staffReturnPath.toString() + ");\n(" + mountDemoSwitcher.toString() + ")();\n" + staffConsoleScript;
