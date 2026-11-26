// Retired presentation URLs resolve to the same native workspace as new visits.
export function legacyEditionRedirect(url) {
  const {pathname, searchParams} = url;
  let target;
  if ((['/login','/login/dawon'].includes(pathname) && searchParams.get('demo') === 'teacher') || pathname === '/teacher' || /^\/learn\/(?:teacher(?:[-/]|$)|grade-collection(?:\/|$)|class-qr(?:\/|$))/.test(pathname) || searchParams.get('preview') === 'teacher') {
    target = '/login/dawon?demo=admin';
  } else if (pathname === '/admin' || searchParams.get('preview') === 'admin') {
    target = '/login/dawon?demo=admin';
  } else if (pathname === '/learn/schedule' || (pathname === '/learn/grades' && searchParams.get('preview') === 'guardian')) {
    target = searchParams.get('preview') === 'guardian' ? '/?preview=guardian' : '/';
  } else if (searchParams.has('edition') && /^\/(?:$|workspace(?:\/|$)|guardian(?:\/|$)|student(?:\/|$)|login(?:\/|$)|learn\/)/.test(pathname)) {
    const dest = new URL(url);
    dest.searchParams.delete('edition');
    return Response.redirect(dest.href,302);
  } else return null;
  const dest = new URL(target,url.origin);
  if (dest.pathname === '/login/dawon') {
    const work = staffReturnPath(searchParams.get('work'),'admin');
    if (work) dest.searchParams.set('work',work);
  }
  if (dest.pathname === '/') {
    for (const key of ['date','view']) {
      if (searchParams.has(key)) dest.searchParams.set(key,searchParams.get(key));
    }
  }
  return Response.redirect(dest.href,302);
}

export function editionResponse(request, url) {
  const entry = /^\/staff\/(admin|teacher)\/?$/.exec(url.pathname);
  const legacy = /^\/[abc](?:\/(admin|teacher|student|guardian))?\/?$/.exec(url.pathname);
  if (!entry && !legacy) return null;
  if (!['GET','HEAD'].includes(request.method)) {
    return new Response(null,{status:405,headers:{allow:'GET, HEAD','cache-control':'no-store'}});
  }
  const role = (entry || legacy)[1];
  const staff = role === 'admin' || role === 'teacher';
  const dest = new URL(staff ? '/login/dawon' : '/',url.origin);
  if (role) dest.searchParams.set(staff ? 'demo' : 'preview',staff ? 'admin' : role);
  if (!role || staff) {
    const work = staffReturnPath(url.searchParams.get('work'),staff ? 'admin' : role);
    if (work) dest.searchParams.set('work',work);
  }
  if (!staff) {
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
  const admin = /^(?:dashboard|guide|staff(?:\/(?:home|attendance|payroll-snapshot))?|results(?:\/(?:students|tree))?|settings(?:\/(?:profile|appearance|organization))?|students(?:\/(?:home|class-groups|surveys\/school-reports))?|clinic(?:\/(?:operations|settings))?|counsel|community\/counsel|lectures(?:\/\d+(?:\/sessions(?:\/\d+(?:\/(?:attendance|scores|exams|assignments|notice|clinic|videos(?:\/\d+)?))?)?)?)?|sessions\/\d+\/[a-z-]+|exams(?:\/(?:templates|bundles|\d+))?|videos(?:\/(?:tree|\d+(?:\/logs(?:\/\d+)?)?))?)$/.test(path);
  const teacher = /^(?:dashboard|lectures|students|clinic|community|teacher-alerts|exams|results|videos|sessions|surveys|homework|submissions)(?:\/|$)/.test(path) ||
    /^settings(?:\/(?:profile|appearance|organization))?$/.test(path);
  const teacherAllowed = teacher && !(path === 'dashboard' && url.searchParams.has('panel'));
  if (!(role === 'admin' ? admin : role === 'teacher' ? teacherAllowed : role == null && (admin || teacherAllowed))) return null;
  // Carry native view and filter parameters only, never auth, role or redirects.
  const filters = new Set('assign area attention class classType course create date direction employee exam examTab from grade gradingExamId group kind lecture_id month order origin page panel paySearch payState period position profile q record rule scope section session_id sessionId sort status student tab to topic track trend view'.split(' '));
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

export function installStaffReturn(allowedPath) {
  if (document.getElementById('dawon-demo-switcher')?.dataset.shell !== 'native') return;
  const entry = new URL(location.href);
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
    if (url.pathname !== '/workspace/dashboard') {
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
        const chooser = new URL('/',location.origin);
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
