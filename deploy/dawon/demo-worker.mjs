import { dawonLearnerScript, renderDawonLearner, mountLearnerMenu } from './dawon-learner-sessions.mjs';
import learnerDemo from './baseline-worker.mjs';
import { insertDemoSwitcher, demoSwitcherScript } from './dawon-demo-header.mjs';

const productionHost = 'demo.hakwonplus.com';
const originHost = 'https://dawon-review-origin.hakwonplus.com';
const legacyRevision = 'fd6d5e6e1db1ff9fb1dd03903416dbf3789acf590073b806f65cf15f7d7e0458';
const linkedNavPath = '/dawon-preview-navigation.js';
const nativeAssetDirectories = ['/assets/', '/tenants/', '/feature-guides/', '/guide-media/', '/teacher-icons/', '/licenses/'];
const nativeFiles = new Set(['/dawon-brand.svg', '/dawon-brand.css', '/dawon-release.js', '/manifest.json', '/teacher-manifest.json', '/student-manifest.json', '/dev-manifest.json', '/omr-default-logo.svg', '/omr-sheet.html']);
const brandStyle = (version) => `<link rel="stylesheet" href="/dawon-brand.css?v=${encodeURIComponent(version)}"><style>body:not([data-role="student"]) .dawon-native-exams { display:none!important }</style>`;
const formerTeacherRoutes = /^\/learn\/(?:teacher(?:[-/]|$)|grade-collection(?:\/|$)|class-qr(?:\/|$))/;
const consoleCookie = 'dawon_console=1; Path=/; SameSite=Lax; HttpOnly; Secure';
const consoleCookieExpired = 'dawon_console=; Path=/; SameSite=Lax; HttpOnly; Secure; Max-Age=0';
const workspaceStyle = `<style>
[aria-labelledby="dawon-teaching-heading"] > header a.ds-btn {
  display:inline-flex;align-items:center;justify-content:center;gap:6px;
  padding:0 11px;min-height:44px;border:1px solid #dcd3cc;border-radius:8px;
  color:#48362a;background:#fff;text-decoration:none;font-weight:650;
}
[data-dawon-staff="admin"] section[aria-label="반 운영 현황"] article {background:#fff}
[data-dawon-staff="admin"] section[aria-label="반 운영 현황"] article li {
  gap:4px 16px;padding-block:12px;
}
[data-dawon-staff="admin"] section[aria-label="반 운영 현황"] article li span {font-size:13px}
[data-dawon-staff="teacher"] [aria-labelledby="dawon-teaching-heading"] > header > div:last-child > div > button {
  min-height:44px;padding-inline:14px;color:#fff;background:#a94a10;border-color:#a94a10;
}
[data-dawon-staff="teacher"] [aria-labelledby="dawon-teaching-heading"] a[href$="/attendance"] > span:last-child {
  color:#863c10;background:#fff2e7;min-height:36px;padding-inline:9px;border-radius:8px;white-space:nowrap;
}
@media(max-width:1023px) {
  /* The name link supplies the touch target inside each roster row. */
  [data-dawon-staff] [aria-label="반 학생 명단"] .ds-table.ds-table--flat tbody td {
    padding-top:1px !important;padding-bottom:1px !important;
  }
  [data-dawon-staff="admin"] [aria-label="반별 운영 현황"] .ds-table tbody td {
    padding-inline:9px;
  }
  [data-dawon-staff="admin"] [aria-label="반별 운영 현황"] .ds-table tbody td:nth-child(2) {
    white-space:nowrap;
  }
}
@media(max-width:600px) {
  [data-dawon-staff="admin"] section[aria-label="반 운영 현황"] article li {align-items:flex-start;flex-direction:column}

  [data-dawon-staff="teacher"] [aria-labelledby="dawon-teaching-heading"] > header a.ds-btn,
  [data-dawon-staff="teacher"] [aria-labelledby="dawon-teaching-heading"] > header > div:last-child > div > button {min-height:44px;font-size:13px;padding-inline:9px}
  [data-dawon-staff="teacher"] [aria-labelledby="dawon-teaching-heading"] a[href$="/attendance"] > span:last-child {padding-inline:6px}
}
[aria-labelledby="dawon-teaching-heading"] > header a.ds-btn:hover {filter:brightness(.95)}
[aria-labelledby="dawon-teaching-heading"] > header a.ds-btn:focus-visible {
  outline:2px solid #9b430c;outline-offset:2px;
}
body:has([data-dawon-staff]) {
  --dawon-modal-gutter:20px;--dawon-control-radius:8px;--dawon-card-radius:12px;
}
body:has([data-dawon-staff]) .admin-modal :is(.ant-modal-content,.ant-modal-container),
body:has([data-dawon-staff]) .ds-overlay-panel--student-detail {
  border-radius:var(--dawon-card-radius);overflow:hidden;
}
body:has([data-dawon-staff]) .admin-modal .ant-modal-container {padding:0}
body:has([data-dawon-staff]) .admin-modal :is(.modal-header,.modal-body,.modal-footer) {
  padding-inline:var(--dawon-modal-gutter);
}
body:has([data-dawon-staff]) .admin-modal .modal-header__row {gap:10px;min-width:0}
body:has([data-dawon-staff]) .admin-modal:has(.ant-modal-close) .modal-header__row {padding-inline-end:52px}
body:has([data-dawon-staff]) .admin-modal:has(.modal-minimize-btn) .modal-header__row {padding-inline-end:104px}
body:has([data-dawon-staff]) .admin-modal .modal-header__title {
  font-size:16px;line-height:1.4;overflow-wrap:anywhere;
}
body:has([data-dawon-staff]) .admin-modal .modal-header__description {
  color:#605850;font-size:13px;line-height:1.5;overflow-wrap:anywhere;
}
body:has([data-dawon-staff]) .admin-modal .modal-footer__actions {min-width:0;gap:8px;justify-content:flex-end}
body:has([data-dawon-staff]) .admin-modal .modal-footer__actions button,
body:has([data-dawon-staff]) .admin-modal :is(.ant-modal-close,.modal-minimize-btn) {
  border-radius:var(--dawon-control-radius);
}
body:has([data-dawon-staff]) .admin-modal :is(.ant-modal-close,.modal-minimize-btn) {
  top:14px;width:44px;height:44px;
}
body:has([data-dawon-staff]) .admin-modal .ant-modal-close {inset-inline-end:var(--dawon-modal-gutter)}
body:has([data-dawon-staff]) .admin-modal .modal-minimize-btn {inset-inline-end:calc(var(--dawon-modal-gutter) + 52px)}
body:has([data-dawon-staff]) .admin-modal .modal-footer__actions button {min-height:44px}
body:has([data-dawon-staff]) .saved-list-field-popover-list {padding:4px}
body:has([data-dawon-staff]) .saved-list-field-popover-item-row {border-radius:8px}
body:has([data-dawon-staff]) .saved-list-field-popover-item {min-height:44px;line-height:1.45}
[data-dawon-staff="admin"] section[aria-label="직원 관리"] form button {min-height:44px}
[data-dawon-staff="admin"] section[aria-label="시험 결과"] li {gap:6px 16px;padding-block:12px}
@media(max-width:600px) {
  body:has([data-dawon-staff]) {--dawon-modal-gutter:14px}
  body:has([data-dawon-staff]) .admin-modal .modal-footer {gap:8px}
  body:has([data-dawon-staff]) .admin-modal .modal-footer__actions {margin-inline-start:auto}
}
section[aria-label$="차시 카드"]:has(> .session-block) {
  display:inline-flex; align-items:center; gap:2px; flex:0 0 auto;
}
section[aria-label$="차시 카드"]:has(> .session-block):has(> section[aria-label="수업일 선택"]) {
  display:grid;grid-template-columns:minmax(0,1fr) 44px;row-gap:0;
}
section[aria-label$="차시 카드"]:has(> section[aria-label="수업일 선택"]) > .session-block {
  min-width:0;
}
section[aria-label$="차시 카드"] > section[aria-label="수업일 선택"] {
  grid-column:1/-1;min-width:0;
}
section[aria-label$="차시 카드"] > div:has(> .session-block__gear) {
  position:static; flex:0 0 auto;
}
section[aria-label$="차시 카드"] .session-block__gear {
  width:44px; height:44px; opacity:1; border-radius:8px;
}
section[aria-label$="차시 카드"] .session-block__gear:focus-visible {
  outline:2px solid currentColor; outline-offset:-2px;
}
.ds-overlay-backdrop:has(+ .ds-overlay-wrap .ds-overlay-panel--student-detail),
.ds-overlay-wrap:has(.ds-overlay-panel--student-detail) {
  left:0;
}
@media (max-width:420px) {
  .teacher-topbar__brand[data-tenant-header-brand] {
    padding-inline-end:4px!important;
    gap:6px!important;
  }
  .teacher-topbar__brand[data-tenant-header-brand] span {
    font-size:15px!important;
  }
  .teacher-topbar__logo {
    flex:0 0 auto;
  }
  .teacher-topbar button[aria-label="기능 검색"] > span {
    display:none;
  }
}
@media (min-width:1024px) {
  html[data-sidebar="expanded"] [data-analytics-placement="admin.sidebar"] button.nav-item[aria-expanded] {
    column-gap:8px;
  }
  html[data-sidebar="expanded"] [data-analytics-placement="admin.sidebar"] button.nav-item[aria-expanded] > .label {
    white-space:nowrap;
  }
}
/* A sortable heading stays part of the table, including its keyboard focus. */
[data-dawon-staff] .ds-table th[aria-sort] button[aria-label$=" 정렬"] {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  min-height: 32px;
  margin: 0;
  padding: 0 2px;
  border: 0;
  border-radius: 3px;
  box-shadow: none;
  background: transparent;
  color: inherit;
  font: inherit;
  line-height: 1.3;
  white-space: nowrap;
  cursor: pointer;
}
[data-dawon-staff] .ds-table th[aria-sort] button[aria-label$=" 정렬"] svg {
  width: 12px;
  flex: none;
}
[data-dawon-staff] .ds-table th[aria-sort="none"] button svg {
  color: var(--color-text-muted);
}
[data-dawon-staff] .ds-table th[aria-sort] button:is(:hover, :focus-visible) {
  color: var(--color-brand-primary-active);
  text-decoration: underline;
  text-underline-offset: 3px;
}
[data-dawon-staff] .ds-table th[aria-sort] button:focus-visible {
  outline: 2px solid currentColor;
  outline-offset: 1px;
}
[data-dawon-staff] .ds-table th.ds-resizable-th[aria-sort] {
  padding-block: 2px;
}
[data-dawon-staff="teacher"] [aria-label="담당 반 목록"] .ds-table.ds-table--flat tbody td {
  padding-block: 1px !important;
}
[data-dawon-staff="teacher"] [aria-label="담당 반 목록"] tbody td:first-child a {
  min-height: 44px;
}
[data-dawon-staff="teacher"] [aria-label="담당 반 목록"] :is(th,td):last-child {
  text-align: end;
  font-variant-numeric: tabular-nums;
}
[data-dawon-staff="admin"] .domain-list-toolbar :has(> label > input[type="date"]):has(> a) {
  align-items: end;
  margin-block-end: 0;
}
[data-dawon-staff="admin"] .domain-list-toolbar label:has(> input[type="date"]) {
  display: grid;
  justify-items: start;
  gap: 4px;
  line-height: 1.4;
}
[data-dawon-staff="admin"] .domain-list-toolbar label:has(> input[type="date"]) + a {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
}
@media (max-width: 600px) {
  [data-dawon-staff] .ds-table-wrap[aria-label="학생 명단"] {
    max-width: 100%;
    overflow-x: auto;
  }
  [data-dawon-staff] .ds-table-wrap[aria-label="학생 명단"] table {
    table-layout: fixed;
    width: 628px;
    min-width: 100%;
  }
  [data-dawon-staff] .ds-table-wrap[aria-label="학생 명단"] table.ds-table :is(th, td) {
    box-sizing: border-box;
    padding-inline: 8px;
  }
  [data-dawon-staff] .ds-table-wrap[aria-label="학생 명단"] thead th:nth-child(1) { width: 122px; }
  [data-dawon-staff] .ds-table-wrap[aria-label="학생 명단"] thead th:nth-child(2) { width: 76px; }
  [data-dawon-staff] .ds-table-wrap[aria-label="학생 명단"] thead th:nth-child(3) { width: 64px; }
  [data-dawon-staff] .ds-table-wrap[aria-label="학생 명단"] thead th:nth-child(4) { width: 110px; }
  [data-dawon-staff] .ds-table-wrap[aria-label="학생 명단"] thead th:nth-child(n+5) { width: 128px; }
  [data-dawon-staff] .ds-table-wrap[aria-label="학생 명단"] td:nth-child(3) { white-space: nowrap; }
  [data-dawon-staff] .ds-table-wrap[aria-label="학생 명단"] .student-name-chip__name {
    white-space: normal;
    word-break: keep-all;
    overflow-wrap: anywhere;
    text-overflow: clip;
  }
  [data-dawon-staff] .ds-table-wrap[aria-label="학생 명단"] td:is(:nth-child(2), :nth-child(4)) {
    word-break: keep-all;
    overflow-wrap: anywhere;
  }
  [data-dawon-staff] .domain-layout:has(:is([aria-label="반 업무"],[aria-label="차시 출결 명단"],[aria-label="반별 운영 현황"])) > .domain-layout__header {
    padding: 8px 12px;
  }
  [data-dawon-staff] .domain-layout:has(:is([aria-label="반 업무"],[aria-label="차시 출결 명단"])) .domain-layout__header-row {
    gap: 6px;
    padding-block: 0;
  }
  [data-dawon-staff] .domain-layout:has(:is([aria-label="반 업무"],[aria-label="차시 출결 명단"])) nav[aria-label="상위 경로"] {
    margin-bottom: 3px;
  }
  [data-dawon-staff] .domain-layout:has([aria-label="차시 출결 명단"]) .domain-layout__header {
    padding-bottom: 0;
  }
  [data-dawon-staff] .domain-layout:has([aria-label="차시 출결 명단"]) .domain-header__tabs-wrap {
    margin-top: 6px;
  }
  [data-dawon-staff] section[aria-label="반 명단"] .domain-list-toolbar > div:first-child > :empty {
    display: none;
  }
  [data-dawon-staff="admin"] .domain-list-toolbar:has(input[aria-label="반 또는 담당 강사 검색"]) > div:first-child {
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
  }
  [data-dawon-staff="admin"] .domain-list-toolbar:has(input[aria-label="반 또는 담당 강사 검색"]) > div:first-child > div {
    padding: 0;
    margin: 0;
  }
  [data-dawon-staff="teacher"] section[aria-label="반 명단"] .domain-list-toolbar:has(> div:first-child > :empty) {
    display: flex;
    flex-flow: row wrap;
    align-items: center;
    column-gap: 10px;
  }
  [data-dawon-staff="teacher"] section[aria-label="반 명단"] .domain-list-toolbar:has(> div:first-child > :empty) > div:has(input) {
    flex: 1 1 190px;
    min-width: 0;
  }
  [data-dawon-staff] :is([aria-label="반별 운영 현황"],[aria-label="반 학생 명단"]).ds-table-wrap {
    margin-inline: 0;
    padding-inline: 0;
    max-width: 100%;
    overscroll-behavior-x: contain;
    scrollbar-color: var(--color-border-divider-strong) transparent;
  }
}

/* On a narrow phone, or with a custom name-column width, allow the whole table to pan. */
@media (min-width: 360px) and (max-width: 600px) {
  [data-dawon-staff] :is([aria-label="반별 운영 현황"],[aria-label="반 학생 명단"]) {
    --identity-width: 160px;
  }
  [data-dawon-staff] [aria-label="반별 운영 현황"] {
    --identity-width: 155px;
  }
  [data-dawon-staff] :is([aria-label="반별 운영 현황"],[aria-label="반 학생 명단"]):has(th:first-child :is([aria-valuenow="155"],[aria-valuenow="160"])) {
    scroll-padding-inline-start: var(--identity-width);
  }
  [data-dawon-staff] :is([aria-label="반별 운영 현황"],[aria-label="반 학생 명단"]) table:has(th:first-child :is([aria-valuenow="155"],[aria-valuenow="160"])) :is(th,td):first-child {
    position: sticky;
    inset-inline-start: 0;
    z-index: 1;
    background-color: var(--color-bg-surface);
    box-shadow: inset -1px 0 var(--color-border-divider);
  }
  [data-dawon-staff] :is([aria-label="반별 운영 현황"],[aria-label="반 학생 명단"]) table thead th[scope="col"] {
    background-color: var(--color-bg-surface-soft);
  }
  [data-dawon-staff] :is([aria-label="반별 운영 현황"],[aria-label="반 학생 명단"]) table:has(th:first-child :is([aria-valuenow="155"],[aria-valuenow="160"])) thead th:first-child {
    z-index: 2;
    background-color: var(--color-bg-surface-soft);
  }
}
</style>`;
const nativePolicy = "default-src 'self'; script-src 'self' 'unsafe-inline' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; worker-src 'self' blob:; media-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'";

const loginNav = `<p id="dawon-preview-scope">체험 화면에서는 예시 데이터만 사용해 주세요.</p>
<style>
#dawon-preview-scope{margin:0;padding:8px 16px;background:#fbfaf8;color:#695e55;text-align:center;font:12px/1.5 system-ui,sans-serif}
</style>`;

const learnerBridgePath = '/dawon-learner-navigation.js';

function installLearnerBridge(chrome, mountMenu) {
  const counselChrome = chrome.guardian;
  function counselFrame(){
    const active=location.pathname.replace(/\/$/,'')==='/student/community' && new URLSearchParams(location.search).get('tab')==='counsel' && guardian();
    document.documentElement.toggleAttribute('data-dawon-counsel',active);
    if(!active){document.querySelectorAll('[data-dawon-counsel-part]').forEach(node=>node.remove());return false;}
    const top=document.querySelector('.student-layout__header .stu-topbar');
    const bottom=document.querySelector('[data-analytics-placement="student.bottom-tab"]');
    if(!top || !bottom)return false;
    const hubBack=document.querySelector('.community-hub-back');
    if(hubBack){
      const heading=document.querySelector('.student-layout main h1');
      if(heading?.textContent==='커뮤니티')heading.textContent='상담 내역';
    }
    for(const [slot,anchor,html] of [['header',top,counselChrome.header],['footer',bottom,'<nav class="dw-bottom" aria-label="하단 메뉴"><div class="dw-wrap">'+counselChrome.footer+'</div></nav>']]){
      if(anchor.parentElement.querySelector('[data-dawon-counsel-part="'+slot+'"]'))continue;
      const host=document.createElement('div');host.dataset.dawonCounselPart=slot;
      const root=host.attachShadow({mode:'open'});
      root.innerHTML='<style>'+counselChrome.css+' :host{display:block;color:var(--dw-ink);font:16px/1.5 system-ui,sans-serif}</style>'+html;
      if(slot==='header'){
        const from=new URL(sessionStorage.getItem('dawon-counsel-return') || '/guardian',location.origin);
        const dest=from.origin===location.origin && ['/','/guardian','/learn/questions'].includes(from.pathname) ? from.pathname+from.search : '/guardian';
        const back=document.createElement('a');back.className='dw-back';back.href=dest;back.textContent='돌아가기';
        back.style.cssText='width:auto;padding:0 10px';root.querySelector('.dw-headerActions').append(back);
      }
      anchor.before(host);
      if (slot === 'header') mountMenu(root);
      else root.querySelector('[data-dw-tab-key="questions"]').href = '/student/community?tab=counsel&panel=form';
    }
    return true;
  }
  const isNative = path => /^\/student\/(?:video\/(?:sessions\/[1-9]\d*\/?$|play\/?$)|clinic(?:\/|$)|community(?:\/|$)|exams(?:\/|$)|attendance(?:\/|$)|submit\/school-report(?:\/|$))/.test(path);
  const generic = {
    dashboard:'home', home:'home', videos:'video', video:'video', calendar:'home', schedule:'home',
    notifications:'alerts', community:'questions', qna:'questions', grades:'exam', homework:'homework',
    clinic:'clinic', submit:'grades', inventory:'tools', notices:'notices', profile:'profile', settings:'settings',
    menu:'home', lectures:'curriculum', courses:'curriculum', idcard:'attendance'
  };
  const guardian = () => sessionStorage.getItem('dawon-room-role') === 'guardian';
  const home = () => guardian() ? '/guardian' : '/student';
  const destination = topic => {
    if (topic === 'home') return home();
    if (topic === 'profile') return '/profile' + (guardian() ? '?preview=guardian' : '');
    return '/learn/' + topic + (guardian() ? '?preview=guardian' : '');
  };
  function genericDestination(raw) {
    if (!raw || !isNative(location.pathname)) return null;
    const url = new URL(raw, location.href);
    if (url.origin !== location.origin || !/^\/student(?:\/|$)/.test(url.pathname) || isNative(url.pathname)) return null;
    return destination(generic[url.pathname.split('/')[2]] || 'home');
  }
  function addLinks(nav, drawer) {
    if (!nav) return;
    const role = guardian() ? 'guardian' : 'student';
    const route = location.pathname.split('/')[2];
    const menu = ({attendance:'attendance', clinic:'clinic', community:'questions', video:'video', exams:'exam', submit:'grades'})[route];
    const selected = drawer ? menu : menu === 'video' || menu === 'questions' ? menu : 'home';
    let group = nav.querySelector(':scope > [data-dawon-links]');
    if (!group || group.dataset.role !== role) {
      const next = document.createElement('div');
      next.dataset.dawonLinks = drawer ? 'drawer' : 'footer';
      next.dataset.role = role;
      next.innerHTML = drawer ? chrome[role].drawerLinks : chrome[role].footer;
      if (!drawer && role === 'guardian') {
        const counsel = next.querySelector('[data-dw-tab-key="questions"]');
        counsel.addEventListener('click', () => {
          try {
            sessionStorage.setItem('dawon-counsel-return','/guardian');
            sessionStorage.setItem('dawon-counsel-intent',JSON.stringify({search:counsel.search,at:Date.now()}));
          } catch {}
        });
      }
      if (group) group.replaceWith(next); else nav.append(next);
      group = next;
    }
    if (group.dataset.current === selected) return;
    group.dataset.current = selected;
    for (const a of group.querySelectorAll('a')) {
      if ((a.dataset.dwMenuKey || a.dataset.dwTabKey) === selected) a.setAttribute('aria-current','location');
      else a.removeAttribute('aria-current');
    }
  }
  const css = document.createElement('style');
  css.textContent = `
    html[data-dawon-counsel] .community-hub-back,
    html[data-dawon-counsel] .community-hub-back ~ :not(.community-tab-panel){display:none!important}
    html[data-dawon-counsel] [data-dawon-counsel-part="header"] + .stu-topbar,
    html[data-dawon-counsel] [data-dawon-counsel-part="footer"] + .stu-tabbar {display:none!important}
    html[data-dawon-counsel] [data-dawon-counsel-part="footer"]{min-height:61px;}
    html[data-dawon-native-learner] .student-layout,html[data-dawon-native-learner] [data-app="student"] {
      --stu-primary:#a64511;--stu-primary-contrast:#fff;--stu-primary-soft:#fff1e5;--stu-gradient:linear-gradient(125deg,#a74513,#bc591c);
      --stu-tabbar-bg:#fff;--stu-on-gradient:#fff;--stu-accent:#ac4c17;
    }
    html[data-dawon-native-learner] .student-layout {height:calc(100dvh - var(--dawon-demo-bar-height,0px));min-height:0;}
    html[data-dawon-native-learner] body .student-layout__header {top:0;}
    html[data-dawon-native-learner] nav:has(> [data-dawon-links]) > :not([data-dawon-links]) {display:none!important}
    html[data-dawon-native-learner] [data-dawon-links="footer"] {display:grid;grid-template-columns:repeat(4,minmax(0,1fr));max-width:980px;margin:auto;background:#fff}
    html[data-dawon-native-learner] [data-dawon-links] a {color:#593f2f;text-decoration:none;font-weight:650;}
    html[data-dawon-native-learner] [data-dawon-links="footer"] a {position:relative;min-height:60px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;font-size:13px}
    html[data-dawon-native-learner] [data-dawon-links] a:hover,html[data-dawon-native-learner] [data-dawon-links] a:focus-visible {background:#fff1e5;color:#943f10;outline:2px solid #a54816;outline-offset:-2px}
    html[data-dawon-native-learner] [data-dawon-links] svg {width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
    html[data-dawon-native-learner] [data-dawon-links="drawer"] {display:grid;gap:2px;}
    html[data-dawon-native-learner] [data-dawon-links="drawer"] h2{font-size:13px;color:#56616b;margin:8px 12px 4px}
    html[data-dawon-native-learner] [data-dawon-links="drawer"] section{padding:6px 0;border-top:1px solid #e6e1de}
    html[data-dawon-native-learner] [data-dawon-links="drawer"] a{display:flex;align-items:center;gap:12px;padding:0 12px;min-height:44px;border-radius:8px}
    html[data-dawon-native-learner] [data-dawon-links="drawer"] a[aria-current]{background:#fff0e5;color:#963c0e}
    html[data-dawon-native-learner] [data-dawon-links="footer"] a[aria-current]{color:#963c0e;font-weight:750}
    html[data-dawon-native-learner] [data-dawon-links="footer"] a[aria-current]::before{content:"";position:absolute;top:0;width:28px;height:3px;border-radius:0 0 3px 3px;background:#b65217}
    html[data-dawon-native-learner] .stu-topbar__iconBtn,html[data-dawon-native-learner] .stu-topbar__profileBtn{min-width:44px;min-height:44px}
    @media(max-width:580px){html[data-dawon-native-learner] [data-dawon-links="footer"] a{font-size:12px}}
    html[data-dawon-native-learner] [data-testid="stu-topbar-notif-bell"] > :not(svg) {display:none}
  `;
  document.head.append(css);
  function sync() {
    const active = isNative(location.pathname);
    document.documentElement.toggleAttribute('data-dawon-native-learner',active);
    if (counselFrame() || !active) return;
    addLinks(document.querySelector('[data-analytics-placement="student.bottom-tab"]'), false);
    addLinks(document.querySelector('[data-analytics-placement="student.drawer"]'), true);
    const bell = document.querySelector('[data-testid="stu-topbar-notif-bell"]');
    if (bell) bell.setAttribute('aria-label','알림');
    for (const a of document.querySelectorAll('a[href^="/student"]')) {
      const target = genericDestination(a.getAttribute('href'));
      if (target && a.pathname !== target && !a.closest('[data-dawon-links],#dawon-demo-switcher')) {
        a.href = target;
        a.dataset.dawonLegacyDestination = target;
      }
    }
  }
  // Native links are React Router links. A full same-origin navigation loads the real learner room.
  document.addEventListener('click', event => {
    if (!isNative(location.pathname) || !(event.target instanceof Element)) return;
    const el = event.target.closest('[data-dawon-legacy-destination],[data-testid="stu-topbar-notif-bell"],a[href]');
    if (!el || el.closest('#dawon-demo-switcher')) return;
    const dest = el.matches('[data-testid="stu-topbar-notif-bell"]') ? destination('alerts') :
      el.dataset.dawonLegacyDestination || genericDestination(el.getAttribute('href'));
    if (!dest || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault(); event.stopImmediatePropagation(); location.assign(dest);
  }, true);
  // Account-menu buttons use imperative navigation rather than links.
  for (const key of ['pushState','replaceState']) {
    const original = history[key];
    history[key] = function(state,title,url) {
      const dest = genericDestination(url);
      if (dest) { location.assign(dest); return; }
      const result = original.apply(this,arguments);
      queueMicrotask(sync);
      return result;
    };
  }
  let scheduled = false;
  new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => { scheduled=false; sync(); });
  }).observe(document.body,{childList:true,subtree:true});
  window.addEventListener('popstate',sync);
  sync();
}

const navigation = `
document.addEventListener('click', (event) => {
  if (!(event.target instanceof Element)) return;
  const target = event.target.closest('[data-route="qr"],[data-preview-role="teacher"],[data-signin="teacher"]');
  let destination = target ? target.matches('[data-route="qr"]') ? '/login/dawon?demo=student' : '/login/dawon?demo=teacher' : null;
  if (!destination && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey) {
    const route = event.target.closest('a[data-route]');
    const topic = route?.dataset.route;
    const guardian = document.body.dataset.role === 'guardian';
    const suffix = guardian ? '?preview=guardian' : '';
    if (topic === 'home' || topic === 'schedule') destination = '/' + suffix;
    else if (['notices','attendance','video','exam','homework','curriculum','clinic','grades','alerts'].includes(topic)) {
      destination = '/learn/' + topic + suffix;
    }
  }
  if (!destination) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  location.assign(destination);
}, true);`;

const reloadScript = (release) => `<script defer src="/dawon-release.js?v=${encodeURIComponent(release)}" data-release="${release}"></script>`;
const modernProbe = "data:text/javascript,if(!import.meta.resolve)throw Error(\"import.meta.resolve not supported\")";

function secureResponse(body, status, contentType = 'application/json') {
  return new Response(body, {
    status,
    headers: {'content-type': contentType, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff'}
  });
}

function forbidden() {
  return secureResponse('{"detail":"이 데모 계정의 요청만 사용할 수 있습니다."}', 403);
}

function scopesAreValid(entries) {
  const scopes = {
    tenant: ['dawon', '719'],
    tenant_id: ['719'],
    tenantId: ['719'],
    tenant_code: ['dawon'],
    tenantCode: ['dawon'],
  };
  return [...entries].every(([key, value]) => !Object.hasOwn(scopes, key) || scopes[key].includes(String(value)));
}

function forward(url, request, env, fetcher, body = null) {
  const headers = new Headers({'x-dawon-review-origin': env.ORIGIN_KEY, 'x-dawon-asset-version': env.ADMIN_VERSION});
  for (const header of ['authorization', 'content-type', 'accept', 'user-agent', 'if-none-match', 'if-modified-since', 'range', 'idempotency-key', 'x-student-id']) {
    const value = request.headers.get(header);
    if (value) headers.set(header, value);
  }
  const target = new URL(originHost + url.pathname + url.search);
  if (url.pathname.startsWith('/assets/')) target.searchParams.set('_dawon_build', env.ADMIN_VERSION);
  return fetcher(target.href, {
    method: request.method,
    headers,
    body,
    // The authenticated origin serves different artifacts for the same path.
    // Only the public worker caches verified, content-addressed responses.
    cache: 'no-store',
    redirect: 'manual',
  });
}

// Only the shipped sample HTML and JavaScript pass through here. Browser drafts
// and records returned by the authenticated API retain the names their owner set.
function labelLegacySamples(source) {
  const labels = {
    '김하늘':'김학생 2', '하늘이 보호자':'보호자 2', '하늘이':'김학생 2', '김다원 선생님':'김선생 1',
    '박소연':'김학생 1', '서준우':'김학생 3', '이주원':'김학생 4', '윤가람':'김학생 5', '정해솔':'김학생 6',
    '예시고 학교별 내신반':'내신반 1',
    "name:levels[i]+' 연합반'":"name:['1%반 1','하이퍼1','스카이반 1'][i]",
  };
  for (const [original, label] of Object.entries(labels)) source = source.replaceAll(original, label);
  return source;
}

async function handleApi(request, url, env, fetcher) {
  const { method } = request;
  if (!['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return secureResponse(null, 405);
  if (!scopesAreValid(url.searchParams)) return forbidden();
  const tenant = request.headers.get('x-tenant-code');
  if (tenant && tenant !== 'dawon') return forbidden();
  if (request.headers.has('origin') && request.headers.get('origin') !== url.origin) return forbidden();
  if (Number(request.headers.get('content-length') ?? 0) > 20_000_000) return secureResponse(null, 413);

  const isWrite = !['GET', 'HEAD'].includes(method);
  const authPaths = ['/api/v1/token/', '/api/v1/token/refresh/', '/api/v1/students/demo-session/'];
  if (isWrite && !(method === 'POST' && authPaths.includes(url.pathname))) {
    const authorization = request.headers.get('authorization');
    if (!/^Bearer [A-Za-z0-9_.-]+$/.test(authorization ?? '')) return forbidden();
    const check = await fetcher(originHost + '/api/v1/core/me/', {
      headers: {'x-dawon-review-origin': env.ORIGIN_KEY, 'x-dawon-asset-version': env.ADMIN_VERSION, authorization},
      redirect: 'manual',
    });
    if (check.status !== 200) return forbidden();
    await check.body?.cancel();
  }
  const body = request.body ? await request.arrayBuffer() : null;
  if (body?.byteLength > 20_000_000) return secureResponse(null, 413);
  if (/^application\/json(?:;|$)/i.test(request.headers.get('content-type') ?? '') && body) {
    try {
      const payload = JSON.parse(new TextDecoder().decode(body));
      if (!payload || typeof payload !== 'object') return secureResponse(null, 400);
      if (!scopesAreValid(Object.entries(payload))) return forbidden();
    } catch {
      return secureResponse(null, 400);
    }
  }
  return forward(url, request, env, fetcher, body);
}

export async function handle(request, env, fetcher = fetch, context) {
  const url = new URL(request.url);
  const { pathname } = url;
  if (url.hostname !== productionHost) return secureResponse(null, 404);

  if (pathname === '/teacher' || formerTeacherRoutes.test(pathname) || url.searchParams.get('preview') === 'teacher') {
    return Response.redirect(url.origin + '/login/dawon?demo=teacher', 302);
  }
  if (pathname === '/admin' || url.searchParams.get('preview') === 'admin') {
    return Response.redirect(url.origin + '/login/dawon?demo=admin', 302);
  }
  if (pathname === '/learn/schedule' || (pathname === '/learn/grades' && url.searchParams.get('preview') === 'guardian')) {
    return Response.redirect(url.origin + (url.searchParams.get('preview') === 'guardian' ? '/?preview=guardian' : '/'), 302);
  }
  // The public demo shares a browser across roles. Fetch pages and records online
  // so a previously viewed user's cached shell or response cannot take precedence.
  if (pathname === '/sw.js' || pathname === '/teacher-sw.js') {
    return secureResponse("self.addEventListener('install',e=>e.waitUntil(self.skipWaiting()));self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));", 200, 'text/javascript; charset=utf-8');
  }
  if (pathname === '/dawon-demo-role.js') return secureResponse(demoSwitcherScript, 200, 'text/javascript; charset=utf-8');
  if (pathname === '/dawon-module-probe.mjs') return secureResponse('if (!import.meta.resolve) throw Error("import.meta.resolve not supported");', 200, 'text/javascript; charset=utf-8');
  if (pathname === learnerBridgePath) {
    const guardian = renderDawonLearner(new URL('/learn/questions?preview=guardian',url),true);
    const {footer,drawerLinks} = renderDawonLearner(new URL('/learn/questions',url),true);
    const script = '(' + installLearnerBridge.toString() + ')(' + JSON.stringify({guardian, student:{footer,drawerLinks}}) + ',' + mountLearnerMenu.toString() + ');';
    return secureResponse(script, 200, 'application/javascript; charset=utf-8');
  }
  if (pathname === '/dawon-learner-app.js') return secureResponse(dawonLearnerScript, 200, 'application/javascript; charset=utf-8');
  if (pathname === linkedNavPath) return secureResponse(navigation, 200, 'application/javascript; charset=utf-8');
  if (pathname === '/version.json') {
    return secureResponse(JSON.stringify({
      name: 'dawon-learning-room',
      revision: legacyRevision,
      version: env.ADMIN_VERSION,
      teacherVersion: env.UI_VERSION || env.ADMIN_VERSION,
      bundleVersion: env.ADMIN_VERSION,
      roles: ['teacher', 'student', 'guardian', 'admin'],
      productionApi: false,
    }), 200);
  }
  if (/%(?:2f|5c|2e)/i.test(pathname)) return secureResponse(null, 404);

  try {
    if (['/favicon.svg', '/vite.svg'].includes(pathname)) {
      return forward(new URL('/dawon-brand.svg', url), request, env, fetcher);
    }
    if (pathname.startsWith('/api/v1/')) return await handleApi(request, url, env, fetcher);
    const isLearnerDocument = ['/', '/student', '/guardian'].includes(pathname) ||
      /^\/learn\/[a-z]+$/.test(pathname);
    if (isLearnerDocument && ['GET','HEAD'].includes(request.method)) {
      const page = renderDawonLearner(url);
      if (page) {
        const html = page.replace('</head>', reloadScript(env.UI_VERSION || env.ADMIN_VERSION) + '</head>');
        return new Response(request.method === 'HEAD' ? null : insertDemoSwitcher(html, url, false), {
          headers: {'content-type':'text/html; charset=utf-8','cache-control':'no-store','content-security-policy':nativePolicy,
            'set-cookie':consoleCookieExpired,'x-content-type-options':'nosniff'},
        });
      }
    }
    const roleLogin = ['student', 'guardian', 'teacher', 'admin'].includes(url.searchParams.get('demo'));
    const isConsoleLogin = pathname === '/login/dawon' ||
      (pathname === '/login' && (roleLogin || /(?:^|;\s*)dawon_console=1(?:;|$)/.test(request.headers.get('cookie') ?? '')));
    const isLearnerVideo = /^\/student\/video\/(?:sessions\/[1-9]\d*|play)\/?$/.test(pathname);
    const isLearnerIntake = /^\/student\/(?:clinic|community)\/?$/.test(pathname);
    const isNative = isConsoleLogin || isLearnerVideo || isLearnerIntake || /^\/(?:workspace|student\/(?:attendance|exams|submit\/school-report))(?:\/|$)/.test(pathname) || ['/terms', '/privacy'].includes(pathname)
      || nativeFiles.has(pathname) || nativeAssetDirectories.some(prefix => pathname.startsWith(prefix));
    if (isNative) {
      if (!['GET', 'HEAD'].includes(request.method)) return secureResponse(null, 405);
      const immutableAsset = request.method === 'GET' && !request.headers.has('range') &&
        /^\/assets\/[a-zA-Z0-9._-]+-[a-zA-Z0-9_-]{8,}(?:-legacy)?\.(?:css|js|woff2|svg|png)$/.test(pathname);
      const edge = immutableAsset && globalThis.caches?.default;
      const cacheKey = edge && new Request(url.origin + pathname);
      if (edge) {
        const cached = await edge.match(cacheKey);
        if (cached) return cached;
      }
      const upstreamUrl = isLearnerVideo || isLearnerIntake ? new URL('/login/dawon', url) : url;
      let upstream = await forward(upstreamUrl, request, env, fetcher);
      for (const previous of ['r34', 'r33', 'r32', 'r31', 'r30', 'r29', 'r28', 'r25', 'r24', 'r23', 'r22', 'r20', 'r14', 'r12', 'r11', 'r10', 'r9', 'r8', 'r7', 'r4', 'r3'].map(suffix => 'dawon-review-20261119-orange-' + suffix)) {
        if (upstream.status !== 404 || !pathname.startsWith('/assets/')) break;
        if (previous === env.ADMIN_VERSION) continue;
        await upstream.body?.cancel();
        upstream = await forward(url, request, { ...env, ADMIN_VERSION: previous }, fetcher);
      }
      const headers = new Headers(upstream.headers);
      if (!upstream.ok) headers.set('cache-control', 'no-store');
      if (upstream.ok && pathname.startsWith('/assets/dawon-lesson-r13/')) {
        if (pathname.endsWith('.m3u8')) headers.set('content-type', 'application/vnd.apple.mpegurl');
        if (pathname.endsWith('.ts')) headers.set('content-type', 'video/mp2t');
      }
      // Vite includes a second capability probe in each modern entry chunk.
      // Serve the equivalent same-origin module under the existing script policy.
      if (request.method === 'GET' && upstream.ok && /^\/assets\/(?:index|polyfills)-[A-Za-z0-9_-]+\.js$/.test(pathname) && !pathname.includes('-legacy-')) {
        const source = await upstream.text();
        const probe = /import'data:text\/javascript,"(assets\/[A-Za-z0-9._-]+)";if\(!import\.meta\.resolve\)throw Error\("import\.meta\.resolve not supported"\)'/;
        const body = source.replace(probe, (_, chunk) => "import'/dawon-module-probe.mjs?chunk=" + encodeURIComponent(chunk) + "'");
        for (const key of ['content-encoding','content-length','etag']) headers.delete(key);
        headers.set('cache-control','public, max-age=31536000, immutable');
        const response = new Response(body,{status:200,headers});
        if (edge && context) context.waitUntil(edge.put(cacheKey,response.clone()).catch(() => {}));
        return response;
      }
      if (immutableAsset && upstream.status === 200 && !headers.has('set-cookie') && !headers.get('content-type')?.includes('html')) {
        headers.set('cache-control','public, max-age=31536000, immutable');
        const response = new Response(upstream.body,{status:200,headers});
        if (edge && context) context.waitUntil(edge.put(cacheKey,response.clone()).catch(() => {}));
        return response;
      }
      if (headers.get('content-type')?.startsWith('text/html')) {
        headers.set('cache-control','no-store');
        headers.set('content-security-policy', nativePolicy);
        headers.append('set-cookie', consoleCookie);
        const isWorkspacePage = /^\/workspace(?:\/|$)/.test(pathname);
        if (request.method === 'GET' && upstream.ok) {
          for (const stale of ['content-encoding', 'content-length', 'etag']) headers.delete(stale);
          const original = await upstream.text();
          const branded = original.replace(modernProbe, '/dawon-module-probe.mjs')
            .replace('</head>', brandStyle(env.ADMIN_VERSION) + reloadScript(env.UI_VERSION || env.ADMIN_VERSION) + '<script defer src="' + learnerBridgePath + '"></script></head>');
          const shell = isConsoleLogin || isWorkspacePage ? branded.replace('</head>', workspaceStyle + '</head>') : branded;
          const html = isConsoleLogin ? shell.replace(/<body[^>]*>/, start => start + loginNav) : shell;
          return new Response(insertDemoSwitcher(html, url, true), {status: upstream.status, headers});
        }
      }
      return new Response(upstream.body, {status: upstream.status, headers});
    }

    const response = await learnerDemo.fetch(request);
    if (pathname === '/school.js' && request.method === 'GET' && response.ok) {
      const text = labelLegacySamples(await response.text());
      const dated = text.replace('id:crypto.randomUUID(),title,body,type,author:demoRole',
        'id:crypto.randomUUID(),createdAt:new Date().toISOString(),title,body,type,author:demoRole');
      return secureResponse(dated, 200, 'application/javascript; charset=utf-8');
    }
    if (request.method !== 'GET' || !response.headers.get('content-type')?.startsWith('text/html')) return response;
    const headers = new Headers(response.headers);
    for (const stale of ['content-encoding', 'content-length', 'etag']) headers.delete(stale);
    headers.set('cache-control', 'no-store');
    headers.append('set-cookie', consoleCookieExpired);
    const html = labelLegacySamples(await response.text()).replace('</head>', `${brandStyle(env.ADMIN_VERSION)}<style>.bottomnav [data-route=schedule],.bottomnav #tab-schedule{display:none!important}.bottomnav{grid-template-columns:repeat(4,minmax(0,1fr))!important}</style>${reloadScript(env.UI_VERSION || env.ADMIN_VERSION)}<script src="${linkedNavPath}" defer></script></head>`);
    // Let the legacy profile's brand use a real role-specific href, including open-in-new-tab.
    const brandHome = url.searchParams.get('preview') === 'guardian' ? '/?preview=guardian' : '/';
    const branded = html.replace('<a href="/" data-route="home">다원수학</a>',
      '<a data-dawon-profile-home href="' + brandHome + '" aria-label="다원수학 홈">다원수학</a>');
    return new Response(insertDemoSwitcher(branded, url, false), {status: response.status, headers});
  } catch {
    return secureResponse('{"detail":"다원 데모를 잠시 후 다시 열어 주세요."}', 503);
  }
}

export default {fetch: (request, env, context) => handle(request, env, fetch, context)};
