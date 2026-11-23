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
html:is([data-dawon-edition=B],[data-dawon-edition=C]) [data-dawon-staff] > aside.sidebar{width:100%;min-width:0;max-width:none}
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
[data-edition-desk] :is(select,input,button){font-variant-numeric:tabular-nums}
[data-edition-desk] :is(a,button,summary){transition:background-color .14s ease,border-color .14s ease}
@media(prefers-reduced-motion:reduce){[data-edition-desk] :is(a,button,summary){transition:none}}
html[data-dawon-edition=A] [data-dawon-staff] main .ds-table th{font-weight:650}
html[data-dawon-edition=A] [data-dawon-staff] main .ds-table tbody :is(td,th){border-block-end:1px solid #dce4e9;font-variant-numeric:tabular-nums}
html[data-dawon-edition=A] [data-dawon-staff] main .ds-table tbody tr:focus-within{background:#edf4f8}
.ed-index .ed-matches,.ed-mobile-index .ed-matches{display:grid;gap:4px}
.ed-index .ed-matches a,.ed-mobile-index .ed-matches a{font:600 14px/1.4 system-ui,sans-serif;background:white;border:1px solid var(--ed-line);border-radius:5px;text-decoration:none;color:var(--ed-ink);padding:10px;display:block}
.ed-index [hidden],.ed-mobile-index [hidden]{display:none!important}
.ed-mobile-index{display:none}
.ed-search{display:flex;gap:8px;margin:8px 0;align-items:center}
.ed-search button{min-height:40px;flex:none;padding:0 12px;font:600 14px system-ui,sans-serif;color:var(--ed-ink);border:1px solid var(--ed-line);background:white;border-radius:6px;cursor:pointer}
.ed-search button::after{content:'▾';margin-inline-start:6px}.ed-search button[aria-expanded=true]::after{content:'▴'}
.ed-directory .ed-tiles{margin-block:12px}
.ed-search input,.ed-mobile-index input{box-sizing:border-box;width:min(100%,460px);min-height:40px;padding:7px 12px;font:inherit;font-size:14px;border:1px solid var(--ed-line);border-radius:6px;background:white;color:var(--ed-ink)}
[data-edition-desk=C] .ed-caption{gap:10px}.ed-directory form{margin:0}
.ed-session-picker{margin:12px 0;border:1px solid var(--ed-line);border-radius:8px;background:white;color:var(--ed-ink);padding:clamp(12px,2vw,22px)}
.ed-session-picker header{display:flex;align-items:baseline;justify-content:space-between;gap:10px}
.ed-session-picker h2{font-size:18px;margin:0}.ed-session-picker header a{color:var(--ed-accent);font-size:13px;text-underline-offset:3px}
.ed-picker-field label{display:grid;gap:6px;font-size:13px;color:var(--ed-ink);font-weight:650;margin-top:12px}
[data-edition-desk] .ed-picker-field select{width:min(100%,460px);max-width:100%;min-height:42px}
.ed-picker-list ul{list-style:none;padding:0;margin:14px 0 0;border-block-start:1px solid var(--ed-line)}
.ed-picker-list a{display:grid;grid-template-columns:5.5ch minmax(0,1fr) max-content;gap:12px;align-items:center;padding:10px 4px;min-height:44px;color:var(--ed-ink);text-decoration:none;border-bottom:1px solid var(--ed-line)}
.ed-picker-list a:is(:hover,:focus-visible){background:var(--ed-tint)}.ed-picker-list a strong{font-size:14px}.ed-picker-list :is(span,small,p){font-size:13px}
.ed-picker-list small{font-variant-numeric:tabular-nums}.ed-picker-list button{cursor:pointer;min-height:40px;background:white;border:1px solid var(--ed-line);border-radius:4px;color:var(--ed-ink);padding:5px 16px}
[data-dawon-staff] main:has([data-edition-desk] .ed-session-picker) > div:not([data-edition-desk]){display:none}
@media(max-width:1023px){.ed-mobile-index{display:block;margin-top:6px}.ed-mobile-index input{width:100%}.ed-mobile-index .ed-matches{grid-template-columns:repeat(2,minmax(0,1fr));margin-block-start:4px}}
@media(max-width:700px){
[data-edition-desk=C] .ed-caption{margin-bottom:4px}
[data-edition-desk=C] .ed-search{margin:0;gap:6px}
[data-edition-desk=C] .ed-search input{flex:1;min-width:0}
[data-edition-desk=C] .ed-directory{padding:0 8px;margin-top:5px}
.ed-tiles{margin:6px 0}.ed-tiles a{min-height:40px}
[data-edition-desk=C] .ed-session-picker,[data-edition-desk=C] .dawon-staff-context{grid-column:1/-1}
.ed-picker-list a{gap:6px}.ed-picker-list a small{font-size:11px}
}

[data-edition-desk] [hidden]{display:none!important}
[data-dawon-staff] a[data-ledger-score],[data-edition-desk=A] a[data-ledger-return]{display:inline-flex;align-items:center;min-height:36px;line-height:1.4;color:#175579;text-decoration:underline;text-underline-offset:3px;font-weight:650}
[data-dawon-staff] a[data-ledger-score]{position:relative;z-index:1;margin-inline:6px;white-space:nowrap;font-size:13px}
[data-edition-desk=A] a[data-ledger-return]{width:fit-content;margin:4px 0}
[aria-label="학습 경보 처리"] tbody tr{scroll-margin-block:110px 16px}
[data-alert-resumed]:focus{outline:2px solid currentColor;outline-offset:3px;border-radius:2px}
[data-staff-evidence] a[data-alert-return]{display:inline-flex;align-items:center;min-height:44px;color:var(--ed-accent,#175579);font-weight:650;text-underline-offset:3px}
.ed-resume-heading button{min-height:36px;width:fit-content;border:1px solid var(--ed-line);background:white;color:var(--ed-ink);border-radius:4px;padding:4px 12px;cursor:pointer}
[data-edition-desk] nav.ed-work-links{display:flex;align-items:stretch;justify-content:flex-start;gap:6px;flex-wrap:wrap;border:0;background:transparent;padding:0;margin:0;width:auto}
[data-edition-desk] nav.ed-work-links a,.ed-queue-link{box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;min-width:0;min-height:44px;padding:6px 14px;border:1px solid var(--ed-line);border-radius:4px;background:white;color:var(--ed-ink);font:650 14px/1.35 system-ui,sans-serif;text-decoration:none;word-break:keep-all}
[data-edition-desk] nav.ed-work-links a:is(:hover,:focus-visible),.ed-queue-link:hover{background:var(--ed-tint);border-color:var(--ed-accent)}
[data-edition-desk=A] nav.ed-work-links{border:1px solid var(--ed-line);border-top:0;padding:0 12px;gap:0;background:white}
[data-edition-desk=A] nav.ed-work-links a{border:0;border-radius:0;padding-inline:16px;color:var(--ed-accent)}
[data-edition-desk=B] .ed-resume{display:flex;align-items:center;justify-content:space-between;gap:12px 18px;flex-wrap:wrap;border:1px solid var(--ed-line);border-left:4px solid var(--ed-accent);border-radius:5px;background:white;margin-top:8px;padding:12px 16px}
.ed-resume-heading{display:grid;gap:2px;min-width:0;overflow-wrap:anywhere}.ed-resume-heading>span{font-size:13px;font-weight:700;color:var(--ed-accent)}.ed-resume-heading>strong{font-size:17px}.ed-resume-heading>small{font-size:13px}
[data-edition-desk=B] .ed-recent a{display:inline-flex;align-items:center;min-height:40px;max-width:100%;overflow-wrap:anywhere;line-height:1.4}
[data-edition-desk=C] .ed-caption{align-items:center}.ed-queue-link{margin-inline-start:auto;min-height:44px;padding:4px 8px;border:0;background:transparent;color:var(--ed-accent);text-decoration:underline;text-underline-offset:3px}
[data-edition-desk=C] nav.ed-work-links{margin-top:6px}.ed-directory{margin-top:8px}
.ed-picker-list a{box-sizing:border-box}.ed-picker-list strong{min-width:0;overflow-wrap:anywhere}.ed-picker-list small{white-space:nowrap}
@media(max-width:700px){
 [data-dawon-staff] a[data-ledger-score],[data-edition-desk=A] a[data-ledger-return],.ed-resume-heading button{min-height:44px}
 [data-dawon-staff] [aria-label="학습 경보 처리"] tbody th a{display:inline-flex;align-items:center;justify-content:center;min-height:44px;min-width:44px;vertical-align:middle}
 [data-edition-desk] :is(select,input[type=search],.ed-search button,.ed-picker-list button){min-height:44px}
 [data-edition-desk] nav.ed-work-links{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px;width:100%}
 [data-edition-desk] nav.ed-work-links a{font-size:13px;padding:5px 4px;min-height:44px}
 [data-edition-desk=A] nav.ed-work-links{padding:0}
 [data-edition-desk=B] .ed-resume{padding:9px 11px;gap:6px 12px}
 [data-edition-desk=B] .ed-resume nav{width:auto;grid-template-columns:repeat(2,minmax(0,1fr))}
 [data-edition-desk=B] .ed-resume nav a{padding-inline:10px}
 [data-edition-desk=B] .ed-recent{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px;overflow:visible;margin-top:6px;padding:6px 0}
 [data-edition-desk=B] .ed-recent span{grid-column:1/-1}
 [data-edition-desk=B] .ed-recent a{display:flex;min-height:44px;white-space:normal;line-height:1.35;justify-content:flex-start;padding:5px 8px;text-align:left}
 [data-edition-desk=C] .ed-caption{margin:0}.ed-queue-link{font-size:13px}
 [data-dawon-staff] main:has([data-ed-home]) :is(input[type=date],select){min-height:44px}
 [data-dawon-staff] main:has([data-ed-home]) table:has(a[href*="lectures?class="]) :is(th button,td a){display:inline-flex;align-items:center;min-height:44px;min-width:44px}
 [data-dawon-staff] main:has([data-ed-home]) table:has(a[href*="lectures?class="]) td:has(>a){padding-block:2px}
 [data-dawon-staff] main:has([data-ed-home]) table:has(a[href*="lectures?class="]) td small{margin-top:-3px;padding-bottom:3px}
 [data-dawon-staff] main:has([data-ed-home]) a[href*="/sessions/"],[data-dawon-staff] main:has([data-ed-home]) a[href*="panel=alerts"]{min-height:44px;display:inline-flex;align-items:center}
}

`;

export function createDesk(edition, role, groups, n, navigate, canLeave, main, makePicker, api) {
  const root = n('section',null,{'data-staff-rail':'','data-edition-desk':edition});
  const names = {A:'학원 행정 콘솔',B:'업무 데스크',C:'업무 포털'};
  const title = n('div',null,{class:'ed-caption'});
  const titleText = n('strong',names[edition]);
  const context = n('span',role === 'teacher' ? '선생님' : '관리자');
  title.append(context,titleText);
  const links = groups.flatMap(([group,items]) => items.map(([label,path])=>({label,path,group})));
  const tasks = [
    {label:'출결 입력',path:'lectures?work=attendance',keys:'출결 출석 지각 동영상 결석 출석부'},
    {label:'과제 확인',path:'lectures?work=assignments',keys:'과제 숙제 제출 확인 과제 관리'},
  ];
  const aliases = {
    results:'성적 통계 시험 통계 성적표 점수 분포 백분위 회차별 추이 시험 결과',
    'students/home':'학생 명단 학생 조회 학생 검색',
    'students/surveys/school-reports':'학교 성적 내신 성적 취합 중간 기말',
    'community/counsel':'상담 신청 상담 내역',
    'teacher-alerts':'학습 경보 학습 알림',
  };
  const compact = term => term.trim().replace(/\s/g,'').toLowerCase();
  const matchesTerm = (item,term) => compact([item.label,item.group,item.keys,aliases[item.path]].filter(Boolean).join(' ')).includes(term);
  const isOverview = url => url.pathname === '/workspace/dashboard' && !url.searchParams.has('panel');
  const urlOf = path => {
    const url = new URL('/workspace/' + path,location.origin);
    url.searchParams.set('edition',edition);
    return url.pathname + url.search;
  };
  function makeLink(item) {
    return n('a',item.label,{href:urlOf(item.path),'data-staff-link':'','data-edition-path':item.path});
  }
  function workLinks(label,items) {
    const nav = n('nav',null,{class:'ed-work-links','aria-label':label});
    nav.append(...items.map(makeLink));
    return nav;
  }
  function picker() {
    const select = n('select',null,{'aria-label':'전체 업무 이동'});
    select.append(n('option','업무 선택',{value:''}));
    for (const [group,items] of groups) {
      const options = n('optgroup',null,{label:group});
      for (const [label,path] of items) options.append(n('option',label,{value:path}));
      select.append(options);
    }
    const fast = n('optgroup',null,{label:'차시 업무'});
    for (const task of tasks) fast.append(n('option',task.label,{value:task.path}));
    select.append(fast);
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
    const quick = workLinks('대장 바로가기',[...tasks,{label:'성적 통계',path:'results'}]);
    root.append(bar,quick);
    update = (url,item) => {
      quick.hidden = !isOverview(url);
      const setting = {'/workspace/settings/profile':'내 프로필','/workspace/settings/appearance':'화면 설정'}[url.pathname];
      current.textContent = [item?.group,setting || item?.label].filter(Boolean).join('  /  ');
    };
  } else if (edition === 'B') {
    const header = n('div',null,{class:'ed-bar'});
    const jumps = n('nav',null,{class:'ed-recent','aria-label':'최근 연 업무'});
    const selector = picker();
    header.append(title,selector); root.append(header,jumps);
    const sessionDesk = n('section',null,{class:'ed-resume','aria-label':'차시 작업대'});
    root.append(sessionDesk);
    const storageKey = 'dawon:desk:recent:v2:' + role;
    const generation = localStorage.getItem('academy:auth-active-generation:v1');
    const known = [...tasks,...links];
    function recentItem(path) {
      const item = known.find(it=>it.path === path);
      if (item) return item;
      const session = /^lectures\/[1-9]\d*\/sessions\/[1-9]\d*\/(attendance|assignments)(?:\?schedule=[1-9]\d*)?$/.exec(path);
      if (session) return {path,label:session[1] === 'attendance' ? '차시 출결 이어서' : '차시 과제 이어서'};
      return null;
    }
    let recent = [], lastSession, lastAttendance, labelRequest, labels = Object.create(null);
    const sessionBase = path => /^(lectures\/[1-9]\d*\/sessions\/[1-9]\d*)\/(?:attendance|assignments)(?:\?schedule=[1-9]\d*)?$/.exec(path)?.[1];
    function displayLabel(value) {
      return value && typeof value.title === 'string' && typeof value.course === 'string' &&
        typeof value.order === 'string' ? {title:value.title.slice(0,180),course:value.course.slice(0,120),order:value.order.slice(0,24)} : null;
    }
    try {
      const saved = JSON.parse(sessionStorage.getItem(storageKey));
      if (generation && saved?.generation === generation && Array.isArray(saved.paths)) {
        recent = saved.paths.filter(path=>typeof path === 'string' && path!=='dashboard' && recentItem(path)).slice(0,4);
        lastSession = typeof saved.lastSession === 'string' && sessionBase(saved.lastSession) ? saved.lastSession : recent.find(sessionBase);
        const attendance = [saved.lastAttendance,lastSession,...recent].find(path=>typeof path==='string' &&
          sessionBase(path) && sessionBase(path)===sessionBase(lastSession) && path.split('?')[0].endsWith('/attendance'));
        lastAttendance = attendance;
        for (const path of [lastSession,...recent]) {
          const base = path && sessionBase(path);
          const label = base && displayLabel(saved.labels?.[base]);
          if (label) labels[base] = label;
        }
      }
    } catch {}
    const side = main.parentElement.querySelector(':scope > aside');
    const searchBox = n('div',null,{class:'ed-index'});
    const search = n('input',null,{type:'search',placeholder:'메뉴 검색','aria-label':'업무 목록 검색'});
    const none = n('small','일치하는 메뉴가 없습니다.',{hidden:'',role:'status'});
    searchBox.append(n('strong','업무 목록'),search,none);
    const matches = n('div',null,{class:'ed-matches',hidden:''});
    searchBox.append(matches);
    side?.prepend(searchBox);
    function results(box,items) {
      box.replaceChildren(...items.map(makeLink)); box.hidden = !items.length;
    }
    const mobile = n('div',null,{class:'ed-mobile-index'});
    const mobileSearch = n('input',null,{type:'search',placeholder:'업무 검색','aria-label':'모바일 업무 검색'});
    const mobileResults = n('div',null,{class:'ed-matches',hidden:''});
    const mobileEmpty = n('small','일치하는 업무가 없습니다.',{role:'status',hidden:''});
    mobile.append(mobileSearch,mobileResults,mobileEmpty); header.after(mobile);
    mobileSearch.oninput = () => {
      const term=compact(mobileSearch.value);
      const items=term ? [...tasks,...links].filter(it=>matchesTerm(it,term)) : [];
      results(mobileResults,items); mobileEmpty.hidden=!term || !!items.length;
    };
    mobileSearch.onkeydown = e => {
      if (e.isComposing || e.keyCode===229) return;
      if (e.key==='Escape') { mobileSearch.value=''; mobileSearch.oninput(); }
      if (e.key==='Enter' && mobileSearch.value.trim()) mobileResults.querySelector('a')?.click();
    };
    const opened = new Map();
    function filter() {
      const term = compact(search.value);
      let count = 0;
      for (const group of side?.querySelectorAll('nav[aria-label="업무 메뉴"] > section, nav[aria-label="업무 메뉴"] > details') || []) {
        let visible = 0;
        const heading = group.querySelector('h2,summary')?.textContent || '';
        for (const a of group.querySelectorAll('a')) {
          const route = new URL(a.href,location.href).pathname.slice('/workspace/'.length);
          const match = matchesTerm({label:a.textContent,group:heading,path:route},term);
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
      const work = term ? tasks.filter(task=>matchesTerm(task,term)) : [];
      results(matches,work);
      none.hidden = !term || count + work.length > 0;
    }
    search.oninput = filter;
    search.onkeydown = e => {
      if (e.isComposing || e.keyCode===229) return;
      if (e.key==='Escape') { search.value=''; filter(); }
      if (e.key==='Enter' && search.value.trim()) (matches.querySelector('a') || side?.querySelector('nav a:not([hidden])'))?.click();
    };
    update = (url,item) => {
      labelRequest?.abort();
      mobileSearch.value=''; mobileSearch.oninput();
      const route = url.pathname.slice('/workspace/'.length);
      const schedule = url.searchParams.get('schedule') || '';
      const detail = recentItem(route + (/^[1-9]\d*$/.test(schedule) ? '?schedule='+schedule : ''));
      const path = detail?.path.includes('/sessions/') ? detail.path : item?.path;
      if (path && path!=='dashboard' && recentItem(path)) recent = [path,...recent.filter(p => p !== path)].slice(0,4);
      const base = path && sessionBase(path);
      if (base) {
        if (path.split('?')[0].endsWith('/attendance')) lastAttendance = path;
        else if (sessionBase(lastAttendance) !== base) lastAttendance = undefined;
        lastSession = path;
        const label = displayLabel(sessionPicker.sessionLabel(base));
        if (label) labels[base] = label;
      }
      const keep = new Set([lastSession,...recent].filter(Boolean).map(sessionBase));
      for (const key of Object.keys(labels)) if (!keep.has(key)) delete labels[key];
      try { if (generation) sessionStorage.setItem(storageKey,JSON.stringify({generation,paths:recent,lastSession,lastAttendance,labels})); } catch {}
      jumps.hidden = !recent.length;
      jumps.replaceChildren(n('span','최근 업무'),...recent.map(p=>{
        const item = recentItem(p), label = labels[sessionBase(p)], a = makeLink(item);
        if (label) {
          a.textContent = label.title + ' · ' + (p.split('?')[0].endsWith('/attendance') ? '출결' : '과제');
          a.title = [label.course,label.order,label.title,item.label].filter(Boolean).join(' · ');
          a.setAttribute('aria-label',a.title);
        }
        return a;
      }));
      const onHome = isOverview(url);
      sessionDesk.hidden = !onHome;
      if (onHome) {
        const last = lastSession && sessionBase(lastSession), meta = labels[last];
        const heading = n('div',null,{class:'ed-resume-heading'});
        heading.append(n('span',last?'마지막으로 연 차시':'차시 업무 시작'));
        if (last) heading.append(n('strong',meta?.title || '차시 확인 중…'),n('small',meta?[meta.course,meta.order].filter(Boolean).join(' · '):''));
        const items = tasks.map((task,i)=>{
          const tab = i===0?'attendance':'assignments';
          const destination = i===0 && lastAttendance ? lastAttendance : last+'/'+tab;
          return {label:task.label,path:last ? destination : task.path};
        });
        const actions = workLinks('차시 작업 선택',items);
        sessionDesk.replaceChildren(heading,actions);
        if (last && !meta) {
          const request = labelRequest = new AbortController();
          sessionPicker.resolveSessionLabel(last,request.signal).then(label=>{
            if (request.signal.aborted) return;
            if (label) { labels[last] = label; update(url,item); return; }
            heading.replaceChildren(n('strong','이 차시는 현재 강의 목록에서 찾을 수 없습니다.'));
            actions.replaceChildren(...tasks.map(makeLink));
          }).catch(()=>{
            if (request.signal.aborted) return;
            const retry = n('button','다시 조회',{type:'button'});
            retry.onclick = ()=>update(url,item);
            heading.replaceChildren(n('span','최근 차시 이름을 불러오지 못했습니다.'),retry);
          });
        }
      }
      if (search.value) { search.value=''; filter(); }
    };
    clean = () => { labelRequest?.abort(); search.value=''; filter(); searchBox.remove(); };
  } else {
    const shelf = n('section',null,{class:'ed-directory',id:'ed-directory-items','aria-label':'업무 검색 결과'});
    const toggle = n('button','전체 업무',{type:'button','aria-controls':'ed-directory-items'});
    const form = n('form',null,{role:'search'});
    const search = n('input',null,{type:'search',placeholder:'학생, 강의, 상담 등 업무 검색','aria-label':'전체 업무 검색',autocomplete:'off'});
    form.append(search,toggle);
    const grid = n('div',null,{class:'ed-tiles'});
    for (const [group,items] of groups) {
      const section = n('section');
      section.append(n('h3',group),...items.map(([label,path])=>makeLink({label,path})));
      grid.append(section);
    }
    const workGroup = n('section');
    workGroup.append(n('h3','차시 업무'),...tasks.map(makeLink)); grid.prepend(workGroup);
    const status = n('p',null,{role:'status',hidden:''});
    function filter() {
      const term = compact(search.value);
      let total = 0;
      for (const section of grid.children) {
        let visible = 0;
        for (const a of section.querySelectorAll('a')) {
          const task = tasks.find(item=>item.path===a.dataset.editionPath);
          const match = matchesTerm(task ? {...task,group:'차시 업무'} : {label:a.textContent,group:section.firstChild.textContent,path:a.dataset.editionPath},term);
          a.hidden = !match; if (match) visible++;
        }
        section.hidden = !visible; total += visible;
      }
      status.hidden = !!total;
      status.textContent = total ? '' : '일치하는 업무가 없습니다.';
    }
    function open(value) { shelf.hidden = !value; toggle.setAttribute('aria-expanded',String(value)); }
    toggle.onclick = () => open(shelf.hidden);
    search.onkeydown = event => {
      if (event.isComposing || event.keyCode===229) {
        if (event.key==='Enter') event.preventDefault();
        return;
      }
      if (event.key === 'Escape') { search.value=''; filter(); open(false); }
    };
    let searchLocation;
    search.oninput = () => { searchLocation = location.href; open(!!search.value); filter(); };
    form.className='ed-search';
    form.onsubmit = event => {
      event.preventDefault();
      if (!search.value.trim() || shelf.hidden) return;
      filter();
      const first=grid.querySelector('section:not([hidden]) a:not([hidden])');
      if (first && canLeave()) navigate(first.href);
    };
    shelf.append(grid,status);
    const alertRoute = role === 'teacher' ? 'teacher-alerts?status=pending' : 'dashboard?panel=alerts&status=pending';
    const triage = workLinks('사유별 미처리 학습 경보',[
      {label:'연속 결석',path:alertRoute+'&rule=absence_streak'},
      {label:'과제 미제출',path:alertRoute+'&rule=homework_missing'},
      {label:'시험 점수 하락',path:alertRoute+'&rule=exam_drop'},
    ]);
    const queue = makeLink({label:'미처리 학습 경보',path:alertRoute});
    queue.className='ed-queue-link';title.append(queue);
    root.append(title,form,triage,shelf);
    update = url => {
      triage.hidden = queue.hidden = !isOverview(url);
      if (searchLocation !== url.href) search.value='';
      open(!!search.value); filter();
    };
  }
  const sessionPicker = makePicker({role,root,node:n,api,urlOf,navigate,canLeave});
  function route(url) {
    root.toggleAttribute('data-ed-home',isOverview(url));
    const relative = url.pathname.replace(/^\/workspace\//,'');
    const matches = links.filter(it=>{
      const [path,query] = it.path.split('?');
      if (path === 'settings/profile' && relative.startsWith('settings/')) return true;
      if (!(relative === path || relative.startsWith(path + '/'))) return false;
      const panel = new URLSearchParams(query).get('panel');
      return !panel || url.searchParams.get('panel') === panel;
    }).sort((a,b)=>b.path.length-a.path.length);
    const task = tasks.find(it=>relative==='lectures' && url.searchParams.get('work')===it.path.split('=')[1]);
    const session = /^lectures\/\d+\/sessions\/\d+\/(attendance|assignments)$/.exec(relative);
    const active = task ? {...task,group:'차시 업무'} : session ? {group:'강의 · 차시',label:session[1] === 'attendance' ? '출결 입력' : '과제 확인',path:relative} : matches[0];
    void sessionPicker.show(url);
    update(url,active);
    for (const a of root.querySelectorAll('a[data-edition-path]')) {
      if (a.dataset.editionPath === active?.path) a.setAttribute('aria-current','page');
      else a.removeAttribute('aria-current');
    }
  }
  main.prepend(root);
  return {root,route,clean(){sessionPicker.clear(); clean();}};
}
