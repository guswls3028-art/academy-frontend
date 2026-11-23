// Stable entrances for the three complete Dawon review editions.
export const editions = {
  A: {name:'학원 행정 콘솔', color:'#183650', accent:'#98c9dc', surface:'#eff3f6'},
  B: {name:'업무 데스크', color:'#173f39', accent:'#abd8c6', surface:'#eef5f1'},
  C: {name:'업무 포털', color:'#493c70', accent:'#decef4', surface:'#f5f3fa'},
};

const roles = {admin:'관리자', teacher:'선생님', student:'학생', guardian:'학부모'};

export function editionResponse(request, url) {
  const match = /^\/([abc])(?:\/(admin|teacher|student|guardian))?\/?$/.exec(url.pathname);
  if (!match) return null;
  const headers = {'cache-control':'no-store','x-content-type-options':'nosniff'};
  if (!['GET','HEAD'].includes(request.method)) return new Response(null,{status:405,headers:{...headers,allow:'GET, HEAD'}});
  const key = match[1].toUpperCase(), role = match[2], base = '/' + match[1];
  if (role) {
    const dest = new URL(role === 'admin' || role === 'teacher' ? '/login/dawon' : '/',url.origin);
    dest.searchParams.set(dest.pathname === '/' ? 'preview' : 'demo',role);
    dest.searchParams.set('edition',key);
    return new Response(null,{status:302,headers:{...headers,location:dest.href}});
  }
  const {name,color,accent,surface} = editions[key];
  const rolesHTML = Object.entries(roles).map(([id,label]) => '<a href="' + base + '/' + id + '"><span>' + label + '</span><span aria-hidden="true">→</span></a>').join('');
  const alternatives = Object.entries(editions).map(([id,info]) => '<a href="/' + id.toLowerCase() + '"' + (id === key ? ' aria-current="page"' : '') + '>' + id + '안 · ' + info.name + '</a>').join('');
  const body = `<!doctype html><html lang="ko" data-dawon-edition="${key}"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>다원수학 ${key}안 · ${name}</title>
<style>*{box-sizing:border-box}body{margin:0;background:${surface};color:${color};font:16px/1.5 system-ui,"Malgun Gothic",sans-serif;word-break:keep-all}header,main,footer{max-width:940px;margin:auto;padding:24px clamp(20px,5vw,56px)}header{font-weight:750;display:flex;gap:12px;align-items:center}header img{width:34px;height:34px}main{margin-top:clamp(8px,8vh,90px)}section{border:1px solid ${color};background:white;overflow:hidden;border-radius:${key === 'A' ? '4' : '18'}px}.title{padding:clamp(22px,5vw,48px);background:${color};color:white}.title span{color:${accent};font-weight:700}h1{font-size:clamp(30px,6vw,54px);margin:6px 0;line-height:1.15;letter-spacing:-.04em}h2{font-size:16px;margin:0 0 12px}.body{padding:clamp(18px,4vw,36px)}.roles{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.roles a{padding:16px;display:flex;justify-content:space-between;align-items:center;border:1px solid #c7d0d5;color:inherit;text-decoration:none;font-weight:700}.roles a:hover,.roles a:focus-visible{background:${surface};border-color:${color}}footer nav{display:flex;gap:6px 20px;flex-wrap:wrap}footer a{display:inline-flex;align-items:center;min-height:44px;color:inherit;text-underline-offset:4px}footer a[aria-current]{font-weight:750}a:focus-visible{outline:2px solid currentColor;outline-offset:2px}</style>
<header><img src="/dawon-brand.svg" alt="">다원수학</header><main><section><div class="title"><span>${key}안</span><h1>${name}</h1></div><div class="body"><h2>역할 선택</h2><nav class="roles" aria-label="역할 선택">${rolesHTML}</nav></div></section></main><footer><nav aria-label="프로그램 버전">${alternatives}</nav></footer></html>`;
  return new Response(request.method === 'HEAD' ? null : body,{headers:{...headers,'content-type':'text/html; charset=utf-8','content-security-policy':"default-src 'none'; style-src 'unsafe-inline'; img-src 'self'; frame-ancestors 'none'; base-uri 'none'"}});
}

// The edition is a presentation preference. Authentication and API calls use the
// original role boundary. A URL takes precedence over the tab preference on reload/back.
export function installEdition() {
  const valid = value => ['A','B','C'].includes(value);
  const key = 'dawon-review:edition:v2';
  const current = () => new URL(location.href).searchParams.get('edition');
  const wasSelected = () => { try { return sessionStorage.getItem(key); } catch { return null; } };
  const relevant = url => url.origin === location.origin && /^\/(?:$|login(?:\/dawon)?\/?$|(?:teacher|admin|guardian|student)\/?$|(?:workspace|student|learn)\/)/.test(url.pathname);
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
