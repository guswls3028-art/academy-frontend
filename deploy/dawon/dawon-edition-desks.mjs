// Mirrors the role menus served by the pinned native bundle (checked by the parity test).
export const catalog = {
  admin:[
    ['운영 현황',[['대시보드','dashboard'],['출결 현황','dashboard?panel=attendance'],['학습 경보','dashboard?panel=alerts']]],
    ['학생·수업',[['학생 명단','students/home'],['반 편성','students/class-groups'],['강의 관리','lectures']]],
    ['학습 관리',[['시험 결과·통계','results'],['학교 성적 취합','students/surveys/school-reports'],['클리닉','clinic/operations'],['상담','community/counsel']]],
    ['직원 관리',[['직원·근태·급여','staff']]],
    ['환경 설정',[['설정','settings/profile']]],
  ],
  teacher:[
    ['수업 운영',[['대시보드','dashboard'],['강의','lectures'],['학생','students/home']]],
    ['시험·성적',[['시험','exams'],['성적','results'],['성적취합','students/surveys/school-reports']]],
    ['클리닉·상담·알림',[['클리닉','clinic/operations?panel=applications&status=pending'],['상담','community/counsel'],['학습 알림','teacher-alerts']]],
    ['환경 설정',[['설정','settings/profile']]],
  ],
};

export const deskStyle = `
html[data-dawon-edition=A] [data-workspace-shell]{--ed-ink:#183650;--ed-accent:#1e587b;--ed-tint:#eaf1f6;--ed-line:#c4d3de;--ed-canvas:#f0f3f5}
html[data-dawon-edition=B] [data-workspace-shell]{--ed-ink:#163d37;--ed-accent:#246655;--ed-tint:#e8f4ed;--ed-line:#c9dbd2;--ed-canvas:#f5f8f5}
html[data-dawon-edition=C] [data-workspace-shell]{--ed-ink:#42335f;--ed-accent:#694b8b;--ed-tint:#f0eaf7;--ed-line:#dbd3e5;--ed-canvas:#f7f5fa}
[data-workspace-shell]:has([data-dawon-staff]){--color-brand-primary:var(--ed-accent);--color-brand-primary-active:var(--ed-ink);--color-brand-primary-bg:var(--ed-tint);--layout-page-bg:var(--ed-canvas);--color-bg-surface-soft:var(--ed-tint)}
[data-dawon-staff] > header{border-block-end:2px solid var(--ed-ink)}
[data-edition-desk]{box-sizing:border-box;margin:0!important;max-width:none!important;color:var(--ed-ink);padding:14px 22px 0!important}
[data-edition-desk] .ed-bar,[data-edition-desk] .ed-caption{display:flex;align-items:center;gap:12px;min-width:0}
[data-edition-desk] .ed-caption span{font-size:12px;font-weight:650}
[data-edition-desk] .ed-caption strong{font-size:18px;letter-spacing:-.035em;color:inherit}
[data-edition-desk] select,.ed-index input,.ed-directory input{border:1px solid var(--ed-line);background:white;color:var(--ed-ink);font:inherit;font-size:14px;max-width:100%;min-width:0;padding:7px 9px;border-radius:4px}
[data-edition-desk] :is(a,button,input,select,summary):focus-visible,.ed-index input:focus-visible{outline:2px solid var(--ed-accent);outline-offset:2px}
[data-edition-desk=A] .ed-bar{min-height:56px;border:1px solid var(--ed-line);border-left:4px solid var(--ed-accent);padding:8px 14px;background:white}
[data-edition-desk=A] .ed-caption{gap:8px;white-space:nowrap}
[data-edition-desk=A] .ed-caption span{border-inline-end:1px solid var(--ed-line);padding-right:9px}
[data-edition-desk=A] .ed-location{border-left:1px solid var(--ed-line);padding-left:12px;font-size:13px}
[data-edition-desk=A] .ed-select{display:flex;align-items:center;gap:8px;margin-inline-start:auto;white-space:nowrap;font-size:13px}
html[data-dawon-edition=A] [data-dawon-staff] > aside.sidebar{background:#183650!important;border:0!important}
html[data-dawon-edition=A] .sidebar nav[aria-label="업무 메뉴"]{padding:15px 8px}
html[data-dawon-edition=A] .sidebar nav[aria-label="업무 메뉴"] :is(h2,summary){color:#bcdae8}
html[data-dawon-edition=A] .sidebar nav[aria-label="업무 메뉴"] a{color:#f1f6fa;border-radius:3px}
html[data-dawon-edition=A] .sidebar nav[aria-label="업무 메뉴"] a:is(:hover,[aria-current=page]){color:white;background:#2d5571;box-shadow:inset 3px 0 #a5d6e9}
html[data-dawon-edition=A] .sidebar nav[aria-label="업무 메뉴"] :is(section,details){border-color:#3b596d}
html[data-dawon-edition=A] [data-dawon-staff] main :is(.domain-layout,.ds-table-wrap){border-radius:3px}
html[data-dawon-edition=A] [data-dawon-staff] .ds-table thead th{background:#e7eef3;color:#29465b;font-variant-numeric:tabular-nums}
html[data-dawon-edition=A] [data-dawon-staff] .ds-table tbody tr:hover{background:#f2f7fa}
[data-edition-desk=B] .ed-bar{justify-content:space-between;align-items:center}
[data-edition-desk=B] .ed-recent{display:flex;align-items:center;flex-wrap:wrap;gap:6px;margin:9px 0 0;padding:8px 0;border:0;border-block:1px solid var(--ed-line);border-radius:0;background:none;width:100%}
[data-edition-desk=B] .ed-recent span{font-size:12px;color:var(--ed-accent);margin-right:4px}
[data-edition-desk=B] .ed-recent a{color:var(--ed-ink);font-size:13px;min-height:32px;min-width:0;flex:none;padding:3px 12px;background:white;border:1px solid var(--ed-line);border-radius:4px;text-decoration:none}
[data-edition-desk=B] .ed-recent a[aria-current]{background:var(--ed-ink);border-color:var(--ed-ink);color:white;box-shadow:none}
html[data-dawon-edition=B] [data-dawon-staff] > aside.sidebar{background:#f1f6f2!important;border-inline-end:1px solid var(--ed-line)}
.ed-index{padding:18px 12px 0;display:grid;gap:8px;color:var(--ed-ink)}
.ed-index strong{font-size:17px}.ed-index input{width:100%}.ed-index small{font-size:12px}
html[data-dawon-edition=B] .sidebar [hidden],[data-edition-desk=C] [hidden]{display:none!important}
html[data-dawon-edition=B] .sidebar nav[aria-label="업무 메뉴"] a[aria-current]{color:#134938;background:#d5e9db;box-shadow:inset 3px 0 #42775e}
[data-edition-desk=C] .ed-caption{margin-bottom:6px}
[data-edition-desk=C] .ed-caption strong{font-size:21px}
.ed-directory{border:1px solid var(--ed-line);border-radius:12px;background:white;padding:0 14px}
.ed-directory summary{cursor:pointer;font-size:14px;font-weight:700;min-height:44px;align-content:center}
.ed-directory[open] summary{border-bottom:1px solid var(--ed-line)}
.ed-directory form{margin:12px 0}.ed-directory input{width:min(100%,420px);min-height:40px}
.ed-tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(160px,100%),1fr));align-items:stretch;gap:8px;margin-bottom:14px}
.ed-tiles section{padding:9px 10px;background:#f8f6fb;border:1px solid var(--ed-line);border-radius:8px}
.ed-tiles h3{margin:2px 0 6px;color:var(--ed-accent);font-size:12px}
.ed-tiles a{display:block;padding:4px 3px;color:var(--ed-ink);font-size:14px;text-decoration:none;font-weight:560}
.ed-tiles a:is(:hover,[aria-current]){text-decoration:underline;text-underline-offset:3px}
@media(min-width:1024px){
html[data-dawon-edition=B] [data-dawon-staff]:not([data-collapsed]){grid-template-columns:clamp(215px,20vw,292px) minmax(0,1fr)}
html[data-dawon-edition=C] [data-dawon-staff]:not([data-collapsed]){grid-template-columns:minmax(0,1fr) clamp(175px,16vw,230px)}
html[data-dawon-edition=C] [data-dawon-staff]:not([data-collapsed]) > aside{grid-column:2;border:0;border-inline-start:1px solid var(--ed-line);background:#fcfbfe}
html[data-dawon-edition=C] [data-dawon-staff]:not([data-collapsed]) > main{grid-column:1}
}
@media(max-width:700px){
[data-edition-desk]{padding:8px 10px 0!important}
[data-edition-desk=A] .ed-location{display:none}
[data-edition-desk] .ed-caption{gap:5px}
[data-edition-desk] .ed-caption strong{font-size:15px}
[data-edition-desk=A] .ed-select{font-size:0}
[data-edition-desk] select{max-width:134px;min-height:42px}
[data-edition-desk=A] .ed-bar{padding:4px 8px;gap:6px}
[data-edition-desk=B] .ed-recent{flex-wrap:nowrap;overflow-x:auto;justify-content:flex-start}
[data-edition-desk=B] .ed-recent span,[data-edition-desk=B] .ed-recent a{flex:none;white-space:nowrap}
[data-edition-desk=B] .ed-recent a{min-height:38px}
.ed-tiles{grid-template-columns:repeat(2,minmax(0,1fr))}.ed-tiles a{min-height:42px;align-content:center}.ed-directory{padding:0 10px}
}
`;

export function createDesk(edition, role, groups, n, navigate, canLeave, main) {
  const root = n('section',null,{'data-staff-rail':'','data-edition-desk':edition});
  const names = {A:'학원 행정 콘솔',B:'업무 데스크',C:'업무 포털'};
  const title = n('div',null,{class:'ed-caption'});
  const titleText = n('strong',names[edition]);
  const context = n('span',role === 'teacher' ? '선생님' : '관리자');
  title.append(context,titleText);
  const links = groups.flatMap(([group,items]) => items.map(([label,path])=>({label,path,group})));
  const urlOf = path => {
    const url = new URL('/workspace/' + path,location.origin);
    url.searchParams.set('edition',edition);
    return url.pathname + url.search;
  };
  function makeLink(item) {
    return n('a',item.label,{href:urlOf(item.path),'data-staff-link':'','data-edition-path':item.path});
  }
  function picker() {
    const select = n('select',null,{'aria-label':'전체 업무 이동'});
    select.append(n('option','업무 선택',{value:''}));
    for (const [group,items] of groups) {
      const options = n('optgroup',null,{label:group});
      for (const [label,path] of items) options.append(n('option',label,{value:path}));
      select.append(options);
    }
    select.onchange = () => {
      const path = select.value;
      select.value = '';
      if (path && canLeave()) navigate(urlOf(path));
    };
    return select;
  }
  let update = () => {}, clean = () => {};
  if (edition === 'A') {
    const bar = n('div',null,{class:'ed-bar'});
    const current = n('span',null,{class:'ed-location'});
    const action = n('label','업무 이동',{class:'ed-select'});
    action.append(picker());
    bar.append(title,current,action);
    root.append(bar);
    update = (_url,item) => { current.textContent = [item?.group,item?.label].filter(Boolean).join('  /  '); };
  } else if (edition === 'B') {
    const header = n('div',null,{class:'ed-bar'});
    const jumps = n('nav',null,{class:'ed-recent','aria-label':'최근 연 업무'});
    const selector = picker();
    header.append(title,selector); root.append(header,jumps);
    const storageKey = 'dawon:desk:recent:' + role;
    let recent = [];
    try { const saved = JSON.parse(sessionStorage.getItem(storageKey)); if (Array.isArray(saved)) recent = saved.filter(p => links.some(it => it.path === p)).slice(0,4); } catch {}
    const side = main.parentElement.querySelector(':scope > aside');
    const searchBox = n('div',null,{class:'ed-index'});
    const search = n('input',null,{type:'search',placeholder:'메뉴 검색','aria-label':'업무 목록 검색'});
    const none = n('small','일치하는 메뉴가 없습니다.',{hidden:'',role:'status'});
    searchBox.append(n('strong','업무 목록'),search,none);
    side?.prepend(searchBox);
    const opened = new Map();
    function filter() {
      const term = search.value.trim().replace(/\s/g,'');
      let count = 0;
      for (const group of side?.querySelectorAll('nav[aria-label="업무 메뉴"] > section, nav[aria-label="업무 메뉴"] > details') || []) {
        let visible = 0;
        const heading = group.querySelector('h2,summary')?.textContent || '';
        for (const a of group.querySelectorAll('a')) {
          const match = (heading + a.textContent).replace(/\s/g,'').includes(term);
          a.hidden = !match;
          if (match) visible++;
        }
        group.hidden = !visible; count += visible;
        if (group.tagName === 'DETAILS') {
          if (term && !opened.has(group)) opened.set(group,group.open);
          if (term) group.open = !!visible;
          else if (opened.has(group)) { group.open = opened.get(group); opened.delete(group); }
        }
      }
      none.hidden = !term || count > 0;
    }
    search.oninput = filter;
    update = (_url,item) => {
      if (item) recent = [item.path,...recent.filter(p => p !== item.path)].slice(0,4);
      try { sessionStorage.setItem(storageKey,JSON.stringify(recent)); } catch {}
      jumps.replaceChildren(n('span','최근 업무'),...recent.map(p=>makeLink(links.find(it=>it.path === p))));
      if (search.value) filter();
    };
    clean = () => { search.value=''; filter(); searchBox.remove(); };
  } else {
    const shelf = n('details',null,{class:'ed-directory'});
    const summary = n('summary','전체 업무');
    const form = n('form',null,{role:'search'});
    const search = n('input',null,{type:'search',placeholder:'학생, 강의, 상담 등 업무 검색','aria-label':'전체 업무 검색',autocomplete:'off'});
    form.append(search);
    const grid = n('div',null,{class:'ed-tiles'});
    for (const [group,items] of groups) {
      const section = n('section');
      section.append(n('h3',group),...items.map(([label,path])=>makeLink({label,path})));
      grid.append(section);
    }
    const status = n('p',null,{role:'status',hidden:''});
    function filter() {
      const term = search.value.trim().replace(/\s/g,'');
      let total = 0;
      for (const section of grid.children) {
        let visible = 0;
        for (const a of section.querySelectorAll('a')) {
          const match = (section.firstChild.textContent + a.textContent).replace(/\s/g,'').includes(term);
          a.hidden = !match; if (match) visible++;
        }
        section.hidden = !visible; total += visible;
      }
      status.hidden = !!total;
      status.textContent = total ? '' : '일치하는 업무가 없습니다.';
    }
    search.oninput = filter;
    form.onsubmit = event => { event.preventDefault(); const first=grid.querySelector('section:not([hidden]) a:not([hidden])'); if (first && canLeave()) navigate(first.href); };
    shelf.append(summary,form,grid,status);
    root.append(title,shelf);
    update = url => {
      shelf.open = url.pathname === '/workspace/dashboard' && !url.searchParams.has('panel');
      search.value=''; filter();
    };
  }
  function route(url) {
    const relative = url.pathname.replace(/^\/workspace\//,'');
    const matches = links.filter(it=>{
      const [path,query] = it.path.split('?');
      if (!(relative === path || relative.startsWith(path + '/'))) return false;
      const panel = new URLSearchParams(query).get('panel');
      return !panel || url.searchParams.get('panel') === panel;
    }).sort((a,b)=>b.path.length-a.path.length);
    const active = matches[0];
    update(url,active);
    for (const a of root.querySelectorAll('a[data-edition-path]')) {
      if (a.dataset.editionPath === active?.path) a.setAttribute('aria-current','page');
      else a.removeAttribute('aria-current');
    }
  }
  main.prepend(root);
  return {root,route,clean};
}
