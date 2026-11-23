import {catalog, createDesk, deskStyle} from './dawon-edition-desks.mjs';

const style = `
[data-staff-rail]{margin:0 auto;max-width:1520px;box-sizing:border-box;padding:12px 22px 0;font:inherit;color:var(--color-text-primary,#302820)}
[data-staff-rail] a:focus-visible,[data-staff-rail] button:focus-visible,[data-staff-attendance] button:focus-visible{outline:2px solid #934308;outline-offset:2px}
.dawon-staff-care,.dawon-staff-context{background:#fffcf8;border:1px solid #e7d9cc;border-radius:7px;padding:12px 16px;margin:10px 0 0;line-height:1.45;font-size:14px}
.dawon-staff-care header{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}
.dawon-staff-care h2,.dawon-staff-context strong{font-weight:700;font-size:15px;line-height:1.4;margin:0}
.dawon-staff-care a,.dawon-staff-context a{color:#87410e;text-decoration:underline;text-underline-offset:3px}
.dawon-staff-care p,.dawon-staff-context p{margin:5px 0 0}
.dawon-staff-care summary{cursor:pointer;width:fit-content;padding:6px 0;color:#71390e}
.dawon-staff-care ul{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:6px 18px;list-style:none;padding:0;margin:8px 0 0}
.dawon-staff-care li{min-width:0;overflow-wrap:anywhere}
.dawon-staff-care li small{display:block;color:#615346}
.dawon-staff-care button,.dawon-staff-context button{font:inherit;color:#71390e;text-decoration:underline;background:none;border:0;padding:4px;cursor:pointer}
[data-staff-attendance]{display:flex;align-items:center;gap:3px;flex-wrap:wrap}
[data-staff-attendance] button{color:#514439;background:white;min-height:34px;padding:3px 6px;white-space:nowrap;border:1px solid #d8cec5;border-radius:4px;font:inherit;font-size:13px;cursor:pointer}
[data-staff-attendance] button[aria-pressed=true]{color:#71390e;border-color:#a7581a;font-weight:700;background:#fff0e4}
[data-staff-attendance] button:disabled{opacity:.6}
td:has(>[data-staff-attendance])>[role=group]:not([data-staff-attendance]),td:has(>[data-staff-attendance])>select{display:none!important}
[data-staff-attendance] small{flex-basis:100%;color:#615346}
td:has(>[data-staff-attendance])>select:focus,td:has(>[data-staff-more][open])>select{display:block!important}
[data-staff-more] summary{width:fit-content;color:#69594c;font-size:12px;cursor:pointer;padding:3px 0}
@container(max-width:809px){
  td:has(>[data-staff-attendance])>select{display:block!important}
  td>[data-staff-attendance],td>[data-staff-more]{display:none!important}
}
@media(max-width:700px){
  [data-staff-rail]{padding:8px 10px 0}[data-staff-rail] nav{width:100%;box-sizing:border-box}[data-staff-rail] nav a{min-width:0;flex:1;padding:6px 2px;min-height:40px;font-size:13px;gap:3px}
  .dawon-staff-care,.dawon-staff-context{padding:9px 11px}.dawon-staff-care ul{grid-template-columns:1fr}
  [data-staff-attendance]{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:2px}[data-staff-attendance] button{min-height:35px;font-size:12px;padding:2px 0}[data-staff-attendance] small{grid-column:1/-1}
  [data-dawon-staff] .domain-list-toolbar:has(input[aria-label="반 또는 담당 강사 검색"]) div:has(>label>input[type=date]){display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px 8px;margin-block:0}
  [data-dawon-staff] .domain-list-toolbar:has(input[aria-label="반 또는 담당 강사 검색"]) label{display:grid;gap:2px;min-width:0;font-size:12px}
  [data-dawon-staff] .domain-list-toolbar:has(input[aria-label="반 또는 담당 강사 검색"]) label :is(input,select){width:100%;min-width:0}
  [aria-label="학습 경보 처리"] table{display:block;width:100%;min-width:0!important}
  [aria-label="학습 경보 처리"] thead{position:absolute;clip-path:inset(50%);width:1px;height:1px;overflow:hidden}
  [aria-label="학습 경보 처리"] tbody{display:block}
  [aria-label="학습 경보 처리"] tbody tr{display:grid;grid-template-columns:minmax(0,1fr) auto;border-bottom:1px solid #eee4dc;padding:8px 4px}
  [aria-label="학습 경보 처리"] tbody :is(th,td){width:auto!important;white-space:normal!important;padding:3px 6px!important;border:0!important}
  [aria-label="학습 경보 처리"] tbody :is(th,td):first-child{grid-area:1/1}
  [aria-label="학습 경보 처리"] tbody td:nth-child(3){grid-area:2/1/3/-1}
  [aria-label="학습 경보 처리"] tbody td:nth-child(2){grid-area:3/1/4/-1;color:#6d6157;font-size:12px}
  [aria-label="학습 경보 처리"] tbody td:last-child{grid-area:1/2}
}
@media print{[data-staff-rail]{display:none}}
@media(prefers-reduced-motion:reduce){[data-staff-rail] nav a{transition:none}}
`;

function mountStaffConsole(makeDesk, menus, css) {
  if (document.querySelector('#dawon-demo-switcher')?.dataset.shell !== 'native') return;
  const codes = {PRESENT:'출석', LATE:'지각', ONLINE:'동영상', ABSENT:'결석'};
  const origin = location.origin;
  let desk, rail, activeRole, edition, lastLocation, pendingFrame, appointments, detailKey;
  let contextRequest, scheduleRequest;
  let nextEvidence;
  const edited = new WeakSet();
  function node(tag, text, attributes = {}) {
    const el = document.createElement(tag);
    if (text !== undefined && text !== null) el.textContent = text;
    for (const [key,value] of Object.entries(attributes)) el.setAttribute(key, value);
    return el;
  }
  function href(url) {
    const params = new URLSearchParams(url.search);
    params.delete('edition');
    params.delete('console');
    return url.pathname + (params.size ? '?' + params : '');
  }
  function roleApi(role, path, signal) {
    const generation = localStorage.getItem('academy:auth-active-generation:v1');
    const auth = JSON.parse(localStorage.getItem('academy:auth-tokens:v1:' + generation) || '{}');
    if (!generation || auth.generation !== generation || !auth.access) throw Error('session');
    const claim = JSON.parse(atob(auth.access.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));
    if (claim.tenant_id !== 719 || claim.dawon_demo_role !== role) throw Error('role');
    return fetch('/api/v1/' + path,{headers:{authorization:'Bearer ' + auth.access,'x-tenant-code':'dawon'},
      cache:'no-store',redirect:'error',signal}).then(response => {
      if (!response.ok || localStorage.getItem('academy:auth-active-generation:v1') !== generation) throw Error('role');
      return response.json();
    });
  }
  function go(path, userState = null, replace = false) {
    const dest = new URL(path, origin);
    if (dest.origin !== origin || !dest.pathname.startsWith('/workspace/')) return;
    const idx = (Number(history.state?.idx) || 0) + (replace ? 0 : 1);
    const state = {idx,key:crypto.randomUUID(),usr:userState};
    history[replace ? 'replaceState' : 'pushState'](state,'',href(dest));
    window.dispatchEvent(new PopStateEvent('popstate',{state:history.state}));
    document.querySelector('[data-dawon-staff] main')?.scrollTo(0,0);
  }
  function guarded() {
    const editing = [...document.querySelectorAll('form input,form textarea,form select,[role=dialog] input,[role=dialog] textarea,[role=dialog] select')].some(field => edited.has(field) && field.getClientRects().length);
    return !editing || window.confirm('작성 중인 내용을 두고 다른 업무를 열까요?');
  }
  function scheduleList() {
    if (appointments?.isConnected) return;
    appointments = node('section',null,{class:'dawon-staff-care','aria-label':'상담 예정'});
    const header = node('header');
    header.append(node('h2','상담 예정'),node('a','상담 신청·답변',{href:'/workspace/community/counsel','data-staff-link':''}));
    const content = node('div');
    appointments.append(header,content);
    rail.append(appointments);
    async function load() {
      scheduleRequest?.abort();
      const request = new AbortController();
      scheduleRequest = request;
      content.replaceChildren(node('p','상담 일정을 불러오는 중…',{role:'status'}));
      try {
        const feed = await roleApi(activeRole,'students/teacher-alerts/?settings=1',request.signal);
        if (request.signal.aborted || !content.isConnected) return;
        if (!Array.isArray(feed.followups)) throw Error('shape');
        const today = new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul'}).format(new Date());
        const rows = feed.followups.filter(row => row.kind === 'counsel' && row.day >= today).sort((a,b) => a.day.localeCompare(b.day));
        if (!rows.length) { content.replaceChildren(node('p','예정된 상담이 없습니다.')); return; }
        const list = node('ul'), rest = node('ul');
        for (const [index,row] of rows.entries()) {
          const li = node('li');
          const link = node('a',row.student,{href:'/workspace/students/home','data-staff-student-search':row.student});
          li.append(link,document.createTextNode(' · ' + row.day),node('small',row.course));
          (index < 3 ? list : rest).append(li);
        }
        content.replaceChildren(list);
        if (rows.length > 3) {
          const more = node('details');
          more.append(node('summary','상담 일정 ' + (rows.length - 3) + '건 더 보기'),rest);
          content.append(more);
        }
      } catch {
        if (request.signal.aborted || !content.isConnected) return;
        const retry = node('button','다시 시도',{type:'button'});
        retry.onclick = load;
        content.replaceChildren(node('p','상담 일정을 불러오지 못했습니다.',{role:'alert'}),retry);
      }
    }
    void load();
  }
  function captureEvidence(anchor) {
    const row = anchor.closest('[aria-label="학습 경보 처리"] tbody tr');
    if (!row || !row.cells[2]) return;
    nextEvidence = {role:activeRole,to:href(new URL(anchor.href)),group:row.cells[1].innerText.trim(),cause:row.cells[2].innerText.trim()};
  }
  function enhanceAttendance(main) {
    for (const summary of main.querySelectorAll('[aria-label^="차시 출결 집계"]')) {
      for (const tag of summary.querySelectorAll('[data-status]')) {
        const label = codes[tag.dataset.status.toUpperCase()];
        const text = tag.querySelector('span:not([aria-hidden])');
        if (label && text && text.textContent !== label) text.textContent = label;
      }
      const previous = summary.getAttribute('aria-label');
      const current = previous.replace(/현장 (?=\d+명)/g,'출석 ').replace(/(^|[: ,])영상 (?=\d+명)/g,'$1동영상 ');
      if (current !== previous) summary.setAttribute('aria-label',current);
    }
    if (location.pathname === '/workspace/dashboard' && new URLSearchParams(location.search).get('panel') === 'attendance') {
      for (const table of main.querySelectorAll('table')) {
        if (table.querySelector('thead th:last-child')?.textContent !== '출결 상태') continue;
        for (const cell of table.querySelectorAll('tbody td:last-child')) {
          if (cell.textContent === '현장') cell.textContent = '출석';
          else if (cell.textContent === '영상' || cell.textContent === '온라인') cell.textContent = '동영상';
        }
      }
    }
    if (!/\/sessions\/\d+\/attendance\/?$/.test(location.pathname)) return;
    for (const select of main.querySelectorAll('td>select[aria-label$=" 출결 상태"]')) {
      if (!Object.keys(codes).every(code => [...select.options].some(option => option.value === code))) continue;
      const cell = select.parentElement;
      const name = select.getAttribute('aria-label').replace(/ 출결 상태$/,'');
      let actions = cell.querySelector('[data-staff-attendance]');
      if (!actions) {
        actions = node('div',null,{'data-staff-attendance':'',role:'group','aria-label':name + ' 출결 기록'});
        for (const [code,label] of Object.entries(codes)) {
          const button = node('button',label,{type:'button','data-attendance-status':code,'aria-label':name + ' ' + label});
          button.onclick = () => {
            if (select.disabled || select.value === code) return;
            select.value = code;
            select.dispatchEvent(new Event('change',{bubbles:true}));
          };
          actions.append(button);
        }
        cell.append(actions);
        const more = node('details',null,{'data-staff-more':''});
        more.append(node('summary','기타 상태'));
        cell.append(more);
        const selected = select.value;
        const first = Object.entries(codes).map(([code,label]) => {
          const option = [...select.options].find(item => item.value === code);
          option.textContent = label;
          return option;
        });
        select.prepend(...first);
        select.value = selected;
      }
      for (const button of actions.querySelectorAll('button')) {
        if (button.disabled !== select.disabled) button.disabled = select.disabled;
        button.setAttribute('aria-pressed',String(button.dataset.attendanceStatus === select.value));
      }
      let previous = actions.querySelector('small');
      if (!codes[select.value]) {
        if (!previous) { previous = node('small'); actions.append(previous); }
        const text = '현재 ' + (select.selectedOptions[0]?.textContent || '미입력');
        if (previous.textContent !== text) previous.textContent = text;
      } else previous?.remove();
    }
  }
  function showEvidence(source, target) {
    if (!source || source.role !== activeRole || source.to !== href(new URL(location.href)) || target.querySelector('[data-staff-evidence]')) return;
    const block = node('aside',null,{class:'dawon-staff-context','data-staff-evidence':'','aria-label':'경보 발생 근거'});
    block.append(node('strong','경보 발생 근거'),node('p',source.cause),node('p',source.group));
    target.prepend(block);
  }
  function selectedProfile(role, url) {
    const params = url.searchParams;
    const id = params.get('student');
    if (!/^\d+$/.test(id || '')) return;
    const links = document.querySelector('[role=dialog] nav[aria-label="관련 기록"]');
    if (!links) return;
    showEvidence(history.state?.dawonEvidence,links.parentElement);
    const course = links.querySelector('a[href^="/workspace/lectures/"]')?.pathname.match(/^\/workspace\/lectures\/(\d+)$/)?.[1];
    if (role !== 'teacher' || !course) return;
    const recordKey = id + '/' + course;
    const previous = links.parentElement.querySelector('[data-staff-counsel-posts]');
    if (previous?.dataset.staffCounselPosts === recordKey) return;
    previous?.remove();
    // Only a native resolved student profile can open this. Match server student IDs exactly.
    const box = node('section',null,{class:'dawon-staff-context','data-staff-counsel-posts':recordKey,'aria-label':'학생 상담 내역'});
    const content = node('div');
    box.append(node('strong','학생 상담 내역'),content);
    links.after(box);
    async function load() {
      contextRequest?.abort();
      const request = new AbortController();
      contextRequest = request;
      content.replaceChildren(node('p','상담 기록을 확인하는 중…',{role:'status'}));
      try {
        const matches = [];
        for (let page = 1; ; page++) {
          const result = await roleApi(role,'community/admin/posts/?post_type=counsel&lecture_id=' + course + '&page_size=100&page=' + page,request.signal);
          if (request.signal.aborted || !box.isConnected) return;
          if (!Array.isArray(result.results) || !Number.isFinite(result.count)) throw Error('shape');
          matches.push(...result.results.filter(post => String(post.created_by) === id && !post.created_by_deleted));
          if (page * 100 >= result.count || !result.results.length) break;
        }
        if (!matches.length) { content.replaceChildren(node('p','이 강의에서 접수한 학생 상담이 없습니다.')); return; }
        const list = node('ul');
        for (const post of matches) {
          const li = node('li');
          li.append(node('a',post.title,{href:'/workspace/community/counsel?id=' + encodeURIComponent(post.id),'data-staff-link':''}));
          list.append(li);
        }
        content.replaceChildren(list);
      } catch {
        if (request.signal.aborted || !box.isConnected) return;
        const retry = node('button','다시 시도',{type:'button'});
        retry.onclick = load;
        content.replaceChildren(node('p','학생 상담 내역을 불러오지 못했습니다.',{role:'alert'}),retry);
      }
    }
    void load();
  }
  function adjustTrend(main) {
    for (const svg of main.querySelectorAll('svg[aria-label^="시간순 시험 득점률 추이"]')) {
      const dots = svg.querySelectorAll('circle');
      let label = svg.previousElementSibling;
      if (dots.length !== 1 || !dots[0].querySelector('title')) {
        if (label?.hasAttribute('data-staff-score')) { label.remove(); svg.style.removeProperty('display'); }
        continue;
      }
      const value = '최근 시험 ' + dots[0].querySelector('title').textContent + '점 · 응시 1회';
      if (!label?.hasAttribute('data-staff-score')) { label = node('p',null,{'data-staff-score':''}); svg.before(label); }
      if (label.textContent !== value) label.textContent = value;
      svg.style.display = 'none';
    }
    for (const trend of document.querySelectorAll('[role=dialog] [aria-label="성적 추이"]')) {
      const summary = trend.querySelector('p:has(>strong)');
      if (!summary) continue;
      const scored = [...trend.querySelectorAll('tbody tr')].filter(tr => /^\s*\d+(?:\.\d+)?\s*\/\s*\d/.test(tr.lastElementChild?.textContent || ''));
      const label = summary.querySelector('[data-staff-attempt-count]');
      if (scored.length === 1 && !label) summary.append(node('span',' · 응시 1회',{'data-staff-attempt-count':''}));
      else if (scored.length !== 1) label?.remove();
    }
  }
  function sync() {
    pendingFrame = 0;
    const url = new URL(location.href);
    const layout = document.querySelector('[data-workspace-shell] [data-dawon-staff]');
    const main = layout?.querySelector('main');
    const role = layout?.dataset.dawonStaff;
    const view = document.documentElement.dataset.dawonEdition || 'A';
    const mounted = main && Object.hasOwn(menus,role) && url.pathname.startsWith('/workspace/');
    if (!mounted || activeRole !== role || edition !== view || !rail?.isConnected) {
      desk?.clean(); rail?.remove(); appointments?.remove(); appointments = null;
      scheduleRequest?.abort(); contextRequest?.abort(); desk = null; rail = null;
      activeRole = null; lastLocation = null;
      if (!mounted) return;
      activeRole = role; edition = view;
      desk = makeDesk(view,role,menus[role],node,go,guarded,main);
      rail = desk.root;
    }
    const current = href(url);
    if (lastLocation !== current) { lastLocation = current; desk.route(url); }
    if (url.pathname === '/workspace/students/home' && !url.searchParams.has('student')) {
      scheduleList();
      const filters = main.querySelector('[aria-label="학생 조회 조건"]');
      if (filters && filters.nextElementSibling !== appointments) filters.after(appointments);
    }
    else { appointments?.remove(); appointments = null; scheduleRequest?.abort(); }
    if (detailKey !== role + ':' + href(url)) { contextRequest?.abort(); detailKey = role + ':' + href(url); }
    if (url.searchParams.has('student')) {
      selectedProfile(role,url);
      if (url.searchParams.get('panel') === 'student') showEvidence(history.state?.dawonEvidence,rail);
    } else rail.querySelector('[data-staff-evidence]')?.remove();
    enhanceAttendance(main);
    adjustTrend(main);
  }
  function queue() { if (!pendingFrame) pendingFrame = requestAnimationFrame(sync); }
  const sheet = node('style',css,{'data-staff-console-style':''});
  document.head.append(sheet);
  for (const method of ['pushState','replaceState']) {
    const original = history[method];
    history[method] = function(state,title,path) {
      if (state && typeof state === 'object' && path != null) {
        const to = new URL(path,location.href);
        if (activeRole && to.pathname.startsWith('/workspace/')) {
          const source = nextEvidence?.to === href(to) ? nextEvidence : history.state?.dawonEvidence;
          if (source?.to === href(to)) state = {...state,dawonEvidence:source};
        }
        nextEvidence = null;
      }
      const value = original.call(this,state,title,path);
      queue(); return value;
    };
  }
  document.addEventListener('click',event => {
    if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const a = event.target.closest?.('a');
    if (!a) return;
    if (!a.matches('[data-staff-student-search],[data-staff-link]')) { captureEvidence(a); return; }
    event.preventDefault();
    if (!guarded()) return;
    if (a.hasAttribute('data-staff-student-search')) go(a.href,{directoryTerm:a.dataset.staffStudentSearch});
    else go(a.href);
  },true);
  document.addEventListener('input',e => { if(e.target instanceof HTMLElement) edited.add(e.target); },true);
  window.addEventListener('popstate',queue);
  window.addEventListener('pageshow',queue);
  window.addEventListener('storage',e => {
    if (e.key === 'academy:auth-active-generation:v1') { scheduleRequest?.abort(); contextRequest?.abort(); rail?.remove(); queue(); }
  });
  new MutationObserver(queue).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['data-dawon-staff','aria-busy','disabled']});
  queue();
}

export const staffConsoleScript = '(' + mountStaffConsole.toString() + ')(' + createDesk.toString() + ','
  + JSON.stringify(catalog) + ',' + JSON.stringify(style + deskStyle) + ');';
