// Each candidate is a complete staff program with its own public entrance.
export const editions = {
  A: {name:'학원 행정 콘솔', color:'#183650', accent:'#98c9dc', surface:'#eff3f6'},
  B: {name:'업무 데스크', color:'#173f39', accent:'#abd8c6', surface:'#eef5f1'},
  C: {name:'업무 포털', color:'#493c70', accent:'#decef4', surface:'#f5f3fa'},
};

const roles = {teacher:'선생님', admin:'관리자'};

const workflows = {
  A:'반 운영표에서 출결과 과제를 확인하고 성적 통계를 엽니다.',
  B:'최근 수업을 열어 같은 차시의 출결과 과제를 이어서 처리합니다.',
  C:'업무를 검색하거나 결석·미제출·성적 하락 학생부터 확인합니다.',
};

function staffEntryPage(role) {
  const title = roles[role] + '용 프로그램 선택';
  const choices = Object.entries(editions).map(([key,{name}]) =>
    `<a class="choice" href="/${key.toLowerCase()}/${role}"><strong>${key}안 · ${name}</strong><span>${workflows[key]}</span><b aria-hidden="true">›</b></a>`
  ).join('');
  return `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} | 다원수학</title>
<style>*{box-sizing:border-box}body{margin:0;background:#faf9f7;color:#242b32;font:16px/1.5 system-ui,"Malgun Gothic",sans-serif;word-break:keep-all}main{max-width:44rem;margin:clamp(16px,7vh,64px) auto;padding:0 clamp(16px,4vw,40px)}.home{display:inline-flex;align-items:center;min-height:44px;color:#834115;text-underline-offset:3px}h1{margin:20px 0 8px;font-size:clamp(24px,5vw,34px);letter-spacing:-.04em}p{margin:0 0 24px;color:#525960}nav{display:grid;gap:12px}.choice{position:relative;display:grid;gap:4px;padding:18px 48px 18px 20px;border:1px solid #d7d4d0;border-radius:10px;background:white;color:inherit;text-decoration:none}.choice span{color:#505962}.choice strong{font-size:18px}.choice b{position:absolute;right:18px;top:50%;transform:translateY(-50%);color:#824015;font-size:22px}.choice:hover{background:#fff7f0;border-color:#bb8d71}a:focus-visible{outline:3px solid #97491c;outline-offset:3px}</style>
<main><a class="home" href="/">‹ 다원수학 데모 홈</a><h1>${title}</h1><p>세 안 모두 같은 업무를 지원합니다. 체험할 화면을 선택하세요.</p><nav aria-label="교직원 프로그램">${choices}</nav></main></html>`;
}

export function staffProgramUrl(url) {
  if (/^\/workspace(?:\/|$)/.test(url.pathname)) return true;
  if (['/teacher','/admin'].includes(url.pathname)) return true;
  return /^\/login(?:\/dawon)?\/?$/.test(url.pathname) &&
    !['student','guardian'].includes(url.searchParams.get('demo'));
}

export function legacyEditionRedirect(url) {
  const path = url.pathname, preview = url.searchParams.get('preview');
  let target;
  if (path === '/teacher' || /^\/learn\/(?:teacher(?:[-/]|$)|grade-collection(?:\/|$)|class-qr(?:\/|$))/.test(path) || preview === 'teacher') {
    target = '/login/dawon?demo=teacher';
  } else if (path === '/admin' || preview === 'admin') {
    target = '/login/dawon?demo=admin';
  } else if (path === '/learn/schedule' || (path === '/learn/grades' && preview === 'guardian')) {
    target = preview === 'guardian' ? '/?preview=guardian' : '/';
  } else if (url.searchParams.has('edition') && (
    /^\/(?:$|guardian\/?$|student(?:\/|$)|learn\/)/.test(path) ||
    (/^\/login(?:\/dawon)?\/?$/.test(path) && !staffProgramUrl(url))
  )) {
    const dest = new URL(url);
    dest.searchParams.delete('edition');
    return Response.redirect(dest.href,302);
  } else return null;
  const dest = new URL(target,url.origin);
  const edition = url.searchParams.get('edition');
  if (staffProgramUrl(dest) && Object.hasOwn(editions,edition)) dest.searchParams.set('edition',edition);
  if (dest.pathname === '/') {
    for (const key of ['date','view']) {
      if (url.searchParams.has(key)) dest.searchParams.set(key,url.searchParams.get(key));
    }
  }
  return Response.redirect(dest.href,302);
}

// A return address is navigation only. The native router and API still authorize
// each request using the role that actually signed in.
export function staffReturnPath(value, role) {
  if (typeof value !== 'string' || value.length > 2048 || !/^\/workspace\/[a-z0-9/-]+(?:[?#]|$)/.test(value)) return null;
  const url = new URL(value,'https://demo.hakwonplus.com');
  const path = url.pathname.slice('/workspace/'.length).replace(/\/$/,'');
  // AdminRouter has a separate, intentionally smaller route tree for the admin demo.
  const admin = /^(?:dashboard|staff|results(?:\/students)?|settings(?:\/(?:profile|appearance))?|students\/(?:home|class-groups|surveys\/school-reports)|clinic\/operations|community\/counsel|lectures(?:\/\d+(?:\/sessions(?:\/\d+(?:\/(?:attendance|scores|exams|assignments|notice|clinic|videos(?:\/\d+)?))?)?)?)?|sessions\/\d+\/[a-z-]+|exams\/\d+|videos\/\d+(?:\/logs(?:\/\d+)?)?)$/.test(path);
  const teacher = /^(?:dashboard|lectures|students|clinic|community|teacher-alerts|exams|results|videos|sessions|surveys|homework|submissions)(?:\/|$)/.test(path) ||
    /^settings(?:\/(?:profile|appearance))?$/.test(path);
  const teacherAllowed = teacher && !(path === 'dashboard' && url.searchParams.has('panel'));
  if (!(role === 'admin' ? admin : role === 'teacher' ? teacherAllowed : role == null && (admin || teacherAllowed))) return null;
  // Carry native view and filter parameters only, never auth, role or redirects.
  const filters = new Set('assign attention class course create date direction employee exam examTab from grade gradingExamId group kind lecture_id month order origin page panel paySearch payState period position profile q record rule scope section session_id sessionId sort status student tab to track trend view'.split(' '));
  const params = new URLSearchParams();
  const session = /^(?:lectures\/\d+\/)?sessions\/\d+(?:\/|$)/.test(path);
  for (const [key,item] of url.searchParams) {
    const picker = key === 'work' && path === 'lectures' && ['attendance','assignments'].includes(item);
    const schedule = key === 'schedule' && session && /^[1-9]\d*$/.test(item);
    const statistics = path === 'results' && ['statsCourse','statsSession','statsExam','statsStudent'].includes(key) && /^[1-9]\d*$/.test(item);
    if (filters.has(key) || picker || schedule || statistics) params.append(key,item);
  }
  return url.pathname + (params.size ? '?' + params : '') + url.hash;
}

export function editionResponse(request, url) {
  const entry = /^\/staff\/(admin|teacher)\/?$/.exec(url.pathname);
  const match = /^\/([abc])(?:\/(admin|teacher|student|guardian))?\/?$/.exec(url.pathname);
  if (!entry && !match) return null;
  const headers = {'cache-control':'no-store','x-content-type-options':'nosniff'};
  if (!['GET','HEAD'].includes(request.method)) return new Response(null,{status:405,headers:{...headers,allow:'GET, HEAD'}});
  const htmlHeaders = {...headers,'content-type':'text/html; charset=utf-8','content-security-policy':"default-src 'none'; style-src 'unsafe-inline'; img-src 'self'; frame-ancestors 'none'; base-uri 'none'"};
  if (entry) return new Response(request.method === 'HEAD' ? null : staffEntryPage(entry[1]),{headers:htmlHeaders});
  const key = match[1].toUpperCase(), role = match[2], base = '/' + match[1];
  const work = staffReturnPath(url.searchParams.get('work'),role);
  if (role) {
    const dest = new URL(role === 'admin' || role === 'teacher' ? '/login/dawon' : '/',url.origin);
    dest.searchParams.set(dest.pathname === '/' ? 'preview' : 'demo',role);
    if (dest.pathname === '/') {
      for (const name of ['date','view']) {
        if (url.searchParams.has(name)) dest.searchParams.set(name,url.searchParams.get(name));
      }
    } else dest.searchParams.set('edition',key);
    if (work) dest.searchParams.set('work',work);
    return new Response(null,{status:302,headers:{...headers,location:dest.href}});
  }
  const {name,color,accent,surface} = editions[key];
  const rolesHTML = Object.entries(roles).map(([id,label]) => {
    const next = staffReturnPath(work,id);
    return '<a href="' + base + '/' + id + (next ? '?work=' + encodeURIComponent(next) : '') + '"><span>' + label + '</span><span aria-hidden="true">→</span></a>';
  }).join('');
  const returnHint = work ? '<p>' + ['admin','teacher'].filter(id => staffReturnPath(work,id)).map(id => roles[id]).join(' 또는 ') + '로 로그인하면 열려던 업무로 이동합니다.</p>' : '';
  const body = `<!doctype html><html lang="ko" data-dawon-edition="${key}"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>다원수학 ${key}안 · ${name}</title>
<style>*{box-sizing:border-box}body{margin:0;background:${surface};color:${color};font:16px/1.5 system-ui,"Malgun Gothic",sans-serif;word-break:keep-all}header,main{max-width:940px;margin:auto;padding:24px clamp(20px,5vw,56px)}header{font-weight:750;display:flex;gap:12px;align-items:center}header img{width:34px;height:34px}main{margin-top:clamp(8px,8vh,90px)}section{border:1px solid ${color};background:white;overflow:hidden;border-radius:${key === 'A' ? '4' : '18'}px}.title{padding:clamp(22px,5vw,48px);background:${color};color:white}.title span{color:${accent};font-weight:700}h1{font-size:clamp(30px,6vw,54px);margin:6px 0;line-height:1.15;letter-spacing:-.04em}h2{font-size:16px;margin:0 0 12px}.body{padding:clamp(18px,4vw,36px)}.roles{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.roles a{padding:16px;display:flex;justify-content:space-between;align-items:center;border:1px solid #c7d0d5;color:inherit;text-decoration:none;font-weight:700}.roles a:hover,.roles a:focus-visible{background:${surface};border-color:${color}}a:focus-visible{outline:2px solid currentColor;outline-offset:2px}</style>
<header><img src="/dawon-brand.svg" alt="">다원수학</header><main><section><div class="title"><span>${key}안</span><h1>${name}</h1></div><div class="body"><h2>교직원 역할 선택</h2>${returnHint}<nav class="roles" aria-label="역할 선택">${rolesHTML}</nav></div></section></main></html>`;
  return new Response(request.method === 'HEAD' ? null : body,{headers:htmlHeaders});
}

export function installStaffReturn(allowedPath) {
  if (document.getElementById('dawon-demo-switcher')?.dataset.shell !== 'native') return;
  const entry = new URL(location.href);
  const edition = document.documentElement.dataset.dawonEdition;
  if (!edition) return;
  const role = entry.searchParams.get('demo');
  const loginPath = path => path === '/login' || path === '/login/dawon';
  const login = loginPath(entry.pathname) && ['admin','teacher'].includes(role);
  const generation = () => {
    try { return localStorage.getItem('academy:auth-active-generation:v1'); } catch { return null; }
  };
  const initialGeneration = generation();
  let cold = !initialGeneration && allowedPath(entry.pathname + entry.search + entry.hash);
  let requested = login && allowedPath(entry.searchParams.get('work'),role);
  if (!cold && !requested) return;
  let awaitingDesk = false;
  function restore() {
    if (!awaitingDesk) return;
    const url = new URL(location.href);
    if (url.pathname !== '/workspace/dashboard' || url.searchParams.get('edition') !== edition) {
      awaitingDesk = false;
      return;
    }
    const actual = document.querySelector('[data-workspace-shell] [data-dawon-staff]')?.dataset.dawonStaff;
    if (!actual) return;
    awaitingDesk = false;
    const target = requested;
    requested = null;
    if (actual !== role) return;
    const dest = new URL(target,location.origin);
    dest.searchParams.set('edition',edition);
    if (dest.href !== location.href) location.replace(dest.href);
  }
  for (const method of ['pushState','replaceState']) {
    const original = history[method];
    history[method] = function(state,title,path) {
      const before = new URL(location.href);
      let result;
      const intended = path == null ? null : new URL(path,location.href);
      if (requested && intended?.origin === location.origin && loginPath(before.pathname) &&
          loginPath(intended.pathname) && intended.searchParams.get('demo') === role) {
        // The pinned router canonicalizes /login/dawon to /login with a fresh query.
        intended.searchParams.set('work',requested);
        result = original.call(this,state,title,intended.href);
      } else result = original.apply(this,arguments);
      const after = new URL(location.href);
      if (cold && after.pathname === '/login' && before.pathname === entry.pathname) {
        const chooser = new URL('/' + edition.toLowerCase(),location.origin);
        chooser.searchParams.set('work',cold);
        cold = null;
        location.replace(chooser.href);
      } else if (after.pathname !== entry.pathname) {
        cold = null;
      }
      if (requested && loginPath(before.pathname) && before.searchParams.get('demo') === role &&
          before.searchParams.get('work') === requested && after.pathname === '/workspace/dashboard') {
        const active = generation();
        awaitingDesk = !!active && active !== initialGeneration;
      }
      restore();
      return result;
    };
  }
  if (requested) {
    new MutationObserver(restore).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['data-dawon-staff']});
    const cancel = () => { awaitingDesk = false; requested = null; };
    window.addEventListener('storage',event => { if (event.key === 'academy:auth-active-generation:v1') cancel(); });
    window.addEventListener('popstate',cancel);
  }
}

// The edition is a presentation preference. Authentication and API calls use the
// original role boundary. A URL takes precedence over the tab preference on reload/back.
export function installEdition(isStaffUrl) {
  // A learner document never adopts a staff tab's stored candidate.
  if (!isStaffUrl(new URL(location.href))) return;
  const valid = value => ['A','B','C'].includes(value);
  const key = 'dawon-review:edition:v2';
  const current = () => new URL(location.href).searchParams.get('edition');
  const wasSelected = () => { try { return sessionStorage.getItem(key); } catch { return null; } };
  const relevant = url => url.origin === location.origin && isStaffUrl(url);
  let edition = valid(current()) ? current() : (valid(wasSelected()) ? wasSelected() : 'A');
  function mark() {
    document.documentElement.dataset.dawonEdition = edition;
    const home = document.querySelector('[data-edition-home]');
    if (home) { home.href = '/' + edition.toLowerCase(); home.textContent = edition + '안'; }
    try { sessionStorage.setItem(key,edition); } catch {}
    for (const a of document.querySelectorAll('#dawon-demo-switcher a[data-demo-app]')) {
      const url = new URL(a.href,location.href);
      url.searchParams.set('edition',edition);
      if (a.href !== url.href) a.href = url.href;
    }
  }
  function include(url) {
    if (!valid(url.searchParams.get('edition'))) url.searchParams.set('edition',edition);
    return url;
  }
  for (const method of ['replaceState','pushState']) {
    const original = history[method];
    history[method] = function(state,title,path) {
      if (path == null) return original.apply(this,arguments);
      const url = new URL(path,location.href);
      if (!relevant(url)) return original.apply(this,arguments);
      include(url);
      const result = original.call(this,state,title,url.href);
      if (edition !== url.searchParams.get('edition')) { edition = url.searchParams.get('edition'); mark(); }
      return result;
    };
  }
  function restore() {
    if (valid(current())) edition = current();
    else if (relevant(new URL(location.href))) history.replaceState(history.state,'',location.href);
    mark();
  }
  restore();
  window.addEventListener('popstate',restore);
  window.addEventListener('pageshow',restore);
  // Preserve the chosen edition on native browser actions such as "copy link"
  // and "open in new tab". Keep ordinary React link props and route matches intact.
  for (const type of ['contextmenu','pointerdown','click']) document.addEventListener(type,event => {
    if (event.type !== 'contextmenu' && event.button !== 1 && !event.metaKey && !event.ctrlKey && !event.shiftKey) return;
    const a = event.target.closest?.('a[href]');
    if (!a || a.hasAttribute('download')) return;
    const url = new URL(a.href,location.href);
    if (relevant(url)) a.href = include(url).href;
  },true);
}
