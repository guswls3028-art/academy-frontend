const menus = [
  ["notices", "공지사항", "bell"],
  ["attendance", "출결 현황", "check"],
  ["video", "수업 영상·자료", "video"],
  ["exam", "테스트 결과", "chart"],
  ["homework", "과제 현황", "clipboard"],
  ["curriculum", "수업 진도", "book"],
  ["clinic", "클리닉", "calendar"],
  ["questions", "질문하기", "message"],
  ["grades", "학교 성적", "clipboard"],
];

const menuGroups = [
  ['학원 생활', ['notices', 'attendance']],
  ['수업 기록', ['video', 'exam', 'homework', 'curriculum']],
  ['신청·문의·제출', ['clinic', 'questions', 'grades']],
];

const paths = {
  home: "M3 11 12 3l9 8M5 10v11h5v-7h4v7h5V10",
  menu: "M4 6h16M4 12h16M4 18h16",
  bell: "M4 17h16l-2.5-3V9a5.5 5.5 0 0 0-11 0v5L4 17ZM10 21h4",
  check: "M9 3h6a6 6 0 0 1 6 6v6a6 6 0 0 1-6 6H9a6 6 0 0 1-6-6V9a6 6 0 0 1 6-6Zm-2 9 3.5 3.5L17 9",
  video: "M8 5l11 7-11 7z",
  chart: "M4 4v16h16M8 16v-4M13 16V8M18 16V5",
  clipboard: "M8 5H5v16h14V5h-3M8 3h8v5H8zM8 12h8M8 16h6",
  book: "M12 6C9 3 6 3 3 4v15c3-1 6-1 9 2 3-3 6-3 9-2V4c-3-1-6-1-9 2v15",
  calendar: "M4 6h16v15H4zM7 3v6M17 3v6M4 11h16M9 15h1M14 15h1",
  message: "M3 5h18v12H9l-6 4zm4 4h10M7 13h6",
  qr: "M4 4h5v5H4zm11 0h5v5h-5zM4 15h5v5H4zm11 0h2m3 0v2m0 3h-5v-3",
  close: "m6 6 12 12M18 6 6 18",
  right: "m9 5 7 7-7 7",
  left: "m15 5-7 7 7 7",
};

function icon(key) {
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + paths[key] + '"/></svg>';
}

const style = [
  ':root{color-scheme:light;--dw-orange:#e3681c;--dw-accent:#963c0e;--dw-ink:#232a33;--dw-muted:#56616b;--dw-cell:#303740;--dw-cell-outside:#68717b;--dw-line:#e6e1de;--dw-width:980px;--dw-footer:61px}',
  '*{box-sizing:border-box}html{min-height:100%;background:#faf9f8}body{margin:0;padding-bottom:calc(var(--dw-footer) + env(safe-area-inset-bottom,0px));color:var(--dw-ink);font:16px/1.5 system-ui,-apple-system,"Malgun Gothic",sans-serif}',
  'h1,h2,p{margin:0}a{color:inherit;text-decoration:none}button{font:inherit}a:focus-visible,button:focus-visible,summary:focus-visible{outline:2px solid var(--dw-accent);outline-offset:3px}.dw-icon,svg{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round;flex:none}',
  '.dw-wrap{width:min(calc(100% - 48px),var(--dw-width));margin:0 auto}.dw-header{position:relative;z-index:2;min-height:57px;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:0 24px;background:#fff;border-bottom:1px solid var(--dw-line)}',
  '.dw-brand,.dw-headerActions{display:flex;align-items:center;gap:12px}.dw-brand>a{font-weight:650;color:var(--dw-muted)}.dw-brand strong{font-weight:760}.dw-headerActions a{display:inline-flex;align-items:center;gap:6px;min-height:44px;font-size:14px;font-weight:700;color:var(--dw-accent)}',
  `
  .dw-header{position:sticky;top:var(--dawon-demo-bar-height,0px);z-index:4;padding:0}
  .dw-headerInner{min-height:56px;display:flex;align-items:center;justify-content:space-between;gap:12px}
  .dw-brand{min-width:0}.dw-brand>a{color:var(--dw-ink);white-space:nowrap;font-weight:750}.dw-brand>span{color:#a39891}.dw-brand>strong{font-size:14px;color:var(--dw-muted);font-weight:600}
  .dw-brand button,.dw-drawerHead button{display:grid;place-items:center;border:0;background:transparent;color:var(--dw-muted);width:44px;height:44px;border-radius:8px;cursor:pointer}
  .dw-brand button:hover,.dw-drawerHead button:hover{background:#f4efeb}.dw-brand>[data-dw-menu]{margin-inline-start:-8px}
  .dw-drawerPanel{position:fixed;inset:0 auto 0 0;box-sizing:border-box;margin:0;padding:0;width:min(312px,calc(100vw - 40px));height:100dvh;max-height:none;max-width:none;border:0;border-right:1px solid var(--dw-line);background:#fff;color:var(--dw-ink);overflow:hidden}
  .dw-drawerPanel[open]{display:flex;flex-direction:column}.dw-drawerPanel::backdrop{background:#23201b66}html:has(.dw-drawerPanel[open]){overflow:hidden}
  .dw-drawerHead{display:flex;align-items:center;justify-content:space-between;gap:12px;flex:none;padding:calc(9px + env(safe-area-inset-top,0px)) 14px 9px 20px;border-bottom:1px solid var(--dw-line)}.dw-drawerHead h2{font-size:18px;line-height:1.4;margin:0}
  .dw-drawerPanel nav{padding:8px 12px max(16px,env(safe-area-inset-bottom));overflow:auto;overscroll-behavior:contain}
  .dw-drawerPanel section{border-top:1px solid var(--dw-line);margin-top:8px;padding-top:8px}.dw-drawerPanel nav h2{margin:3px 12px;font-size:13px;color:var(--dw-muted);font-weight:650}
  .dw-drawerPanel nav a{display:flex;align-items:center;gap:12px;min-height:44px;padding:8px 12px;border-radius:8px;font-size:15px;font-weight:600}
  .dw-drawerPanel nav a svg{width:19px;height:19px;color:var(--dw-muted)}.dw-drawerPanel nav a:hover{background:#faf6f2}.dw-drawerPanel nav a[aria-current]{color:var(--dw-accent);background:#fff0e5;font-weight:720}.dw-drawerPanel nav a[aria-current] svg{color:inherit}
  @media(prefers-reduced-motion:no-preference){.dw-drawerPanel[open]{animation:dw-enter .16s ease-out}@keyframes dw-enter{from{transform:translateX(-24px)}to{transform:translateX(0)}}}
  `,
  '.dw-hero{background:var(--dw-orange);color:#fff;padding:40px 0 42px}.dw-hero .dw-wrap{display:flex;align-items:baseline;flex-wrap:wrap;gap:4px 12px}.dw-hero h1{font-size:clamp(29px,4.4vw,52px);line-height:1.16;letter-spacing:-.045em;font-weight:760}.dw-hero p{font-size:clamp(17px,2.1vw,25px);font-weight:650;line-height:1.4}',
  '.dw-content{padding-block:24px 30px}.dw-homeMenu section+section{margin-top:20px}.dw-homeMenu h2{font-size:14px;font-weight:700;color:var(--dw-muted);margin:0 0 7px 2px}.dw-homeMenu ul{list-style:none;display:grid;gap:6px;margin:0;padding:0}.dw-rowLink,.dw-spotlight{display:flex;align-items:center;gap:14px;min-height:62px;border:1px solid var(--dw-line);border-radius:10px;padding:11px 16px;background:#fff;font-size:clamp(16px,2vw,21px);font-weight:720;box-shadow:0 2px 4px #31251d10}.dw-rowLink:hover,.dw-spotlight:hover{border-color:#d69c77;background:#fffaf6}.dw-rowLink>svg:first-child{color:#655449;width:20px;height:20px}.dw-rowLink{box-shadow:0 1px 3px #31251d0b}.dw-rowLink>span{min-width:0;overflow-wrap:anywhere}.dw-rowLink>svg:last-child,.dw-spotlight>svg{margin-left:auto;color:#747d86;width:18px;height:18px}.dw-spotlight{min-height:52px;margin-bottom:20px;background:#f0efed;box-shadow:none;font-size:15px}.dw-spotlight strong{font-size:13px;color:var(--dw-accent)}.dw-footnote{margin-top:24px;color:var(--dw-muted);font-size:13px}',
  '.dw-bottom{position:fixed;inset:auto 0 0;z-index:3;background:#fff;border-top:1px solid var(--dw-line);padding-bottom:env(safe-area-inset-bottom,0px)}.dw-bottom .dw-wrap{display:grid;grid-template-columns:repeat(4,minmax(0,1fr))}.dw-bottom a{min-height:var(--dw-footer);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;color:var(--dw-muted);font-size:13px;font-weight:650}.dw-bottom [aria-current]{color:var(--dw-accent);font-weight:750}.dw-bottom a{position:relative}.dw-bottom a[aria-current]::before{content:"";position:absolute;top:0;width:28px;height:3px;background:#b65217;border-radius:0 0 3px 3px}.dw-bottom a:hover{background:#fff5ee}',
  '.dw-title{display:flex;align-items:center;gap:6px;margin-bottom:14px}.dw-title h1{font-size:clamp(23px,3vw,31px);letter-spacing:-.04em}.dw-back{display:grid;place-items:center;width:44px;height:44px;border:1px solid var(--dw-line);border-radius:8px;background:#fff;flex:none}',
  `
  .dw-card{background:#fff;border:1px solid var(--dw-line);border-radius:12px;box-shadow:0 2px 5px #31251d0b;padding:clamp(12px,2.5vw,22px)}
  .dw-action,.dw-step,.dw-todayLink,.dw-controls a{display:inline-flex;align-items:center;justify-content:center;min-height:44px;min-width:44px;border-radius:8px;font-size:14px;font-weight:650;line-height:1.35}
  .dw-action,.dw-step,.dw-todayLink{padding:6px 12px;border:1px solid var(--dw-line);background:#fff;color:var(--dw-ink)}
  .dw-action{color:var(--dw-accent);cursor:pointer}.dw-action:hover,.dw-step:hover,.dw-todayLink:hover{background:#fff5ee}
  .dw-calendarHeader,.dw-detailHead{display:flex;align-items:center;justify-content:space-between;gap:12px}
  .dw-calendarHeader{padding-bottom:14px;border-bottom:1px solid var(--dw-line);margin-bottom:12px;flex-wrap:wrap}
  .dw-period,.dw-calendarOptions,.dw-controls{display:flex;align-items:center}.dw-period{gap:12px}
  .dw-period h2,.dw-detailDate{font-size:clamp(17px,2vw,21px);font-weight:730;letter-spacing:-.035em;line-height:1.4}
  .dw-period h2{margin:0;text-align:center;font-variant-numeric:tabular-nums}.dw-year{display:block;color:var(--dw-muted);font-size:12px;line-height:1.4;font-weight:600}
  .dw-step{padding:0;font-size:22px;color:#45413e}.dw-calendarOptions{gap:10px}
  .dw-modeSwitch{border-radius:10px;padding:2px;background:#f1eeeb}.dw-modeSwitch a{padding:5px 12px;color:var(--dw-muted);border:1px solid transparent}
  .dw-modeSwitch [aria-current=true]{background:white;border-color:#dfd7cf;color:var(--dw-accent);box-shadow:0 1px 3px #34251113}
  .dw-days{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px;text-align:center}
  .dw-weekday{padding:4px 0 6px;color:var(--dw-muted);font-size:13px;font-weight:650}
  .dw-day{min-width:0;min-height:52px;display:grid;grid-template-rows:22px 11px;align-content:center;justify-items:center;align-items:center;border:1px solid #ebe8e5;border-radius:8px;color:var(--dw-cell);font-variant-numeric:tabular-nums}
  .dw-dayNumber{font-size:16px;font-weight:650;line-height:1}.dw-dayHint{display:flex;align-items:center;justify-content:center;gap:3px;font-size:10px;font-weight:700;line-height:11px}
  .dw-day[data-outside=true]{color:var(--dw-cell-outside);background:#faf9f8}.dw-day[data-records]{background:#fff6ed;border-color:#ead2bd}
  .dw-day[aria-current=date]{color:#833607;background:#fff0e2;border-color:#c88250}.dw-day[data-last-viewed]{box-shadow:inset 0 0 0 2px #9d4a1c}
  .dw-day:hover{background:#f9eee6;border-color:#b77a55}.dw-marker{flex:none;display:inline-block;width:7px;height:7px;border-radius:50%;background:#a64b18}
  .dw-marker[hidden]{display:none}.dw-legend{margin:12px 0 0;color:var(--dw-muted);font-size:13px;display:flex;align-items:center;gap:7px}
  .dw-legend .dw-markerPending{margin-left:8px}.dw-markerPending{background:white;border:1.5px solid #806e61}.dw-attendanceState{font-size:14px;font-weight:700;color:var(--dw-accent)}
  .dw-attendanceState[data-pending]{color:var(--dw-muted)}.dw-day[data-only-pending]:not([aria-current=date]){background:white}
  .dw-detailHead{padding-bottom:12px;border-bottom:1px solid var(--dw-line)}.dw-count{color:var(--dw-muted);font-size:14px;font-variant-numeric:tabular-nums;white-space:nowrap}
  .dw-dayList{list-style:none;padding:0;margin:0}.dw-record{position:relative;display:flex;align-items:center;justify-content:space-between;gap:6px 18px;flex-wrap:wrap;padding:14px 2px;overflow-wrap:anywhere}
  .dw-record+.dw-record{border-top:1px solid var(--dw-line)}.dw-recordText{min-width:0;flex:1 1 220px}
  .dw-record strong{display:block;font-size:16px;line-height:1.45}.dw-recordText span{display:block;color:var(--dw-muted);font-size:14px;line-height:1.5;margin-top:3px;white-space:pre-line}
  .dw-taskRow{display:block;padding:0}.dw-taskRow summary{cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:48px;padding:12px 2px;list-style:none}.dw-taskRow summary::-webkit-details-marker{display:none}
  .dw-taskRow summary:focus-visible{outline:2px solid var(--dw-accent);outline-offset:2px}.dw-taskRow summary:hover{background:#fff9f4}.dw-taskToggle{color:var(--dw-accent);font-size:14px;font-weight:700;display:inline-flex;align-items:center;gap:8px;white-space:nowrap}.dw-taskToggle::after{content:"";width:7px;height:7px;border:solid currentColor;border-width:0 1.5px 1.5px 0;transform:rotate(45deg)}.dw-taskRow details[open] .dw-taskToggle::after{transform:rotate(225deg)}
  .dw-taskBody{display:grid;grid-template-columns:max-content minmax(0,1fr);align-items:baseline;gap:10px 14px;margin:0 0 14px;padding:14px;border-radius:8px;background:#faf7f4;line-height:1.55}.dw-taskBody dt{font-size:14px;font-weight:700;color:var(--dw-muted)}.dw-taskBody dd{margin:0;white-space:pre-line;overflow-wrap:anywhere}
  .dw-recordAction,.dw-nearest{min-height:44px;display:inline-flex;align-items:center;gap:7px;color:var(--dw-accent);font-size:14px;font-weight:700}
  .dw-recordAction::after,.dw-nearest::after{content:"";width:6px;height:6px;border:solid currentColor;border-width:1.5px 1.5px 0 0;transform:rotate(45deg)}
  .dw-recordAction::before{content:"";position:absolute;inset:0}.dw-record:has(.dw-recordAction:hover){background:#fff9f4}
  .dw-empty{margin-top:14px;padding:12px 14px;border-radius:8px;background:#f8f6f4}.dw-empty .dw-state{margin:0}.dw-nearest{align-self:start}
  .dw-state{margin:10px 0;color:var(--dw-muted);overflow-wrap:anywhere}.dw-actions{margin-top:14px;display:flex;gap:8px;flex-wrap:wrap}
  .dw-back:has(span){display:flex;align-items:center;gap:3px;width:auto;padding:0 10px;font-size:14px;font-weight:650;white-space:nowrap}.dw-back span{line-height:1.35}.dw-back:has(span) svg{width:16px}
  .dw-spotlight[hidden],.dw-homeNoticeError[hidden]{display:none}.dw-spotlight span{min-width:0;overflow-wrap:anywhere}.dw-spotlight time{margin-left:auto;white-space:nowrap;font-size:12px;color:var(--dw-muted);font-weight:600}.dw-spotlight>svg{margin-left:0}.dw-homeNoticeError{margin:0 0 12px;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:2px 8px 2px 12px;font-size:14px;color:var(--dw-muted);background:#f5f2ef;border-radius:8px}
  .dw-alertDay h2{margin:0;padding:0 0 10px;border-bottom:1px solid var(--dw-line);font-size:15px;font-weight:700}.dw-alertDay+.dw-alertDay{margin-top:18px}
  .dw-recordText,.dw-taskBody dd,.dw-questionNote,.dw-empty{word-break:keep-all;overflow-wrap:anywhere}
  .dw-content{scroll-margin-top:calc(var(--dawon-demo-bar-height,0px) + 60px)}.dw-content :is(input,textarea,button,summary,a){scroll-margin-block:115px 72px}
  .dw-title{gap:10px}.dw-questionTools{display:flex;border-bottom:1px solid var(--dw-line);gap:14px}.dw-questionTools a{display:inline-flex;align-items:center;min-height:44px;font-size:15px;font-weight:650;border-bottom:2px solid transparent;color:var(--dw-muted)}.dw-questionTools [aria-current]{border-color:#ae4b12;color:var(--dw-accent)}
  .dw-questionNote{margin:12px 0;color:var(--dw-muted);font-size:14px;line-height:1.55}.dw-questionForm label{font-size:14px;font-weight:680}.dw-questionForm input,.dw-questionForm textarea{font-weight:400;background:#fff;color:var(--dw-ink)}
  .dw-questionForm button[type=submit]{justify-self:start;background:#a74610;border-color:#a74610;color:#fff;min-width:112px;padding-inline:18px}.dw-photoField{border-block:1px solid var(--dw-line);padding:0 2px 2px}.dw-photoField summary{display:flex;align-items:center;gap:8px;min-height:44px;font-weight:650;font-size:14px;cursor:pointer}.dw-photoField summary::after{content:"";margin:0 4px 3px auto;width:7px;height:7px;border:solid currentColor;border-width:0 1.5px 1.5px 0;transform:rotate(45deg)}.dw-photoField[open] summary::after{transform:rotate(225deg)}.dw-photoField p{font-size:13px;color:var(--dw-muted);margin:6px 0}
  .dw-photoButtons{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:8px}.dw-questionForm .dw-questionPhoto{display:block}.dw-questionForm .dw-questionPhoto[hidden]{display:none}
  .dw-questionRow{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:48px;font-weight:650}.dw-questionRow span{color:var(--dw-muted);font-size:13px;font-weight:600;white-space:nowrap}.dw-questionText{line-height:1.65;margin-block:8px}.dw-questionNote~h2,.dw-questionNote~h3{margin:14px 0 4px}.dw-questionForm [type=file]{max-width:100%}
  body[data-learner-menu=questions]:has(.dw-questionForm,.dw-questionTools) .dw-content{max-width:760px}
  @media(max-width:580px){.dw-questionForm button[type=submit]{justify-self:stretch}.dw-legend{gap:5px}.dw-headerInner{min-height:52px}}
  .dw-spotlight strong{flex:none}
  .dw-action[aria-current=page]{background:#fff1e6;border-color:#dbab84;color:#843008}
  @media(max-width:580px){
    .dw-calendarHeader{display:grid;grid-template-columns:minmax(0,1fr);gap:10px;padding-bottom:10px;margin-bottom:8px}
    .dw-period,.dw-calendarOptions{justify-content:space-between}.dw-day{min-height:48px}
    .dw-record{padding:12px 0}.dw-taskRow{padding:0}.dw-recordText{flex-basis:180px}.dw-detailHead{gap:8px}
  }
  @media(prefers-reduced-motion:no-preference){.dw-day,.dw-rowLink,.dw-recordAction,.dw-modeSwitch a{transition:background-color .12s,border-color .12s}}
  `,
  '.dw-questionForm,.dw-questionForm label{display:grid;gap:8px}.dw-questionForm{gap:16px;margin-top:16px}.dw-questionForm input,.dw-questionForm textarea{font:inherit;border:1px solid var(--dw-line);border-radius:8px;padding:10px;width:100%}.dw-questionForm textarea{min-height:8em}.dw-questionPhoto{max-width:min(100%,480px);max-height:450px;object-fit:contain}.dw-questionRow{padding:14px 0;border-bottom:1px solid var(--dw-line)}.dw-questionText{white-space:pre-wrap;overflow-wrap:anywhere}.dw-questionForm [hidden]{display:none}',
  '@media(max-width:580px){.dw-wrap{width:calc(100% - 28px)}.dw-header{padding:0;gap:6px}.dw-brand,.dw-headerActions{gap:6px}.dw-brand strong{font-size:15px}.dw-hero{padding:26px 0 28px}.dw-hero .dw-wrap{display:grid;gap:4px}.dw-hero p{font-size:17px}.dw-content{padding-top:16px}.dw-homeMenu section+section{margin-top:16px}.dw-homeMenu ul{gap:5px}.dw-rowLink{min-height:49px;padding:9px 12px}.dw-spotlight{margin-bottom:12px;padding-inline:10px}.dw-bottom a{font-size:12px}}',
].join('\n');

function escapeHtml(value) {
  return String(value).replace(/[&<>"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[char]));
}

function getRole(url) {
  return url.pathname === '/guardian' || url.searchParams.get('preview') === 'guardian' ? 'guardian' : 'student';
}

function learnerHref(topic, role) {
  const roleQuery = role === 'guardian' ? '?preview=guardian' : '';
  if (topic === 'home') return '/' + roleQuery;
  return '/learn/' + topic + roleQuery;
}

export function renderDawonLearner(url, chromeOnly = false) {
  const role = getRole(url);
  const guardian = role === 'guardian';
  const home = ['/', '/student', '/guardian'].includes(url.pathname);
  const topic = home ? 'home' : url.pathname.split('/')[2];
  const visibleMenus = menus.filter(([key]) => !guardian || key !== 'grades')
    .map(([key, label, image]) => [key, key === 'questions' && guardian ? '상담하기' : label, image]);
  const item = visibleMenus.find(menu => menu[0] === topic);
  if (!(home || item || topic === 'alerts')) return null;
  const title = home ? '학습 홈' : (item?.[1] ?? '알림');
  const homeUrl = learnerHref('home', role);
  const sections = menuGroups.map(([name, keys]) => ({
    name: guardian && keys.includes('grades') ? '신청·문의' : name,
    items: keys.map(key => visibleMenus.find(menu => menu[0] === key)).filter(Boolean),
  }));
  const menuLinks = sections.map(({name,items}) => '<section><h2>' + name + '</h2><ul>' +
    items.map(([key,label,image]) => '<li><a class="dw-rowLink" href="' + learnerHref(key,role) +
      '" id="tile-' + key + '">' + icon(image) + '<span>' + label + '</span>' + icon('right') + '</a></li>').join('') + '</ul></section>').join('');
  const menuLink = ([key, label, image]) => '<a href="' + learnerHref(key,role) + '" data-dw-menu-key="' + key + '"' +
    (topic === key ? ' aria-current="page"' : '') + '>' + icon(image) + '<span>' + label + '</span></a>';
  const drawerLinks = '<div class="dw-drawerHome">' + menuLink(['home','학습 홈','home']) + menuLink(['alerts','알림','bell']) + '</div>' + sections.map(({name,items}) => {
    return '<section><h2>' + name + '</h2>' + items.map(menuLink).join('') + '</section>';
  }).join('');
  const actions = guardian ? '/login/dawon?demo=guardian&amp;view=counsel' : '/learn/questions?action=ask&amp;detail=question';
  const tabs = [
    ['home', '홈', 'home', homeUrl],
    ['video', '영상', 'video', learnerHref('video',role)],
    ['alerts', '알림', 'bell', learnerHref('alerts',role)],
    ['questions', guardian ? '상담하기' : '질문하기', 'message', actions],
  ];
  const activeTab = tabs.some(([key]) => key === topic) ? topic : 'home';
  const footer = tabs.map(([key,label,image,href]) => '<a id="tab-' + key + '" data-dw-tab-key="' + key + '" href="' + href + '"' +
    (activeTab === key ? ' aria-current="' + (topic === key ? 'page' : 'location') + '"' : '') + '>' + icon(image) + '<span>' + label + '</span></a>').join('');
  const banner = home ? '<section class="dw-hero"><div class="dw-wrap"><h1>김학생 2</h1><p>' +
    (guardian ? '보호자 2 · 자녀 학습' : '김선생 1') + ' · 수학Ⅱ</p></div></section>' : '';
  const header = '<header class="dw-header"><div class="dw-wrap dw-headerInner"><div class="dw-brand">' +
    '<button type="button" data-dw-menu aria-label="학습 메뉴 열기" aria-haspopup="dialog" aria-controls="dw-navigation" aria-expanded="false">' + icon('menu') + '</button>' +
    '<dialog id="dw-navigation" class="dw-drawerPanel" aria-labelledby="dw-menu-heading"><div class="dw-drawerHead"><h2 id="dw-menu-heading">학습 메뉴</h2>' +
    '<form method="dialog"><button autofocus aria-label="메뉴 닫기">' + icon('close') + '</button></form></div><nav aria-label="학습 메뉴">' + drawerLinks + '</nav></dialog>' +
    '<a href="' + homeUrl + '" aria-label="다원수학 학습 홈">다원수학</a><span aria-hidden="true">/</span><strong>' +
    (home ? title : guardian ? '자녀 학습' : '학생 학습') + '</strong></div><div class="dw-headerActions">' +
    (!guardian ? '<a href="/login/dawon?demo=student" aria-label="QR 출석">' + icon('qr') + '<span>QR 출석</span></a>' : '') + '</div></div></header>';
  if (chromeOnly) return {header, footer, drawerLinks, css:style.replace(':root{',':host{')};
  const content = home ? '<a class="dw-spotlight" href="' + learnerHref('notices',role) +
      '" hidden><strong>공지</strong><span id="dw-latest-notice"></span><time></time>' + icon('right') +
      '</a><p class="dw-homeNoticeError" hidden></p><nav class="dw-homeMenu" aria-label="홈 메뉴">' + menuLinks +
      '</nav><p class="dw-footnote">다원수학 체험판 · 예시 학생과 수업입니다.</p>'
    : '<div class="dw-title"><a class="dw-back" id="dw-back" href="' + homeUrl + '" aria-label="홈으로">' + icon('left') +
      '<span>홈</span></a><h1>' + escapeHtml(title) + '</h1></div><section class="dw-card" aria-label="' +
      escapeHtml(title) + '" id="dw-view"><p class="dw-state" role="status">불러오는 중입니다.</p></section>';
  return '<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">' +
    '<link rel="icon" type="image/svg+xml" href="/dawon-brand.svg"><title>' + escapeHtml(title) + ' | 다원수학</title><style>' + style +
    '</style><script defer src="/dawon-learner-app.js"></script></head><body data-role="' + role + '" data-learner-menu="' + topic +
    '">' + header + banner + '<main class="dw-wrap dw-content">' + content + '</main><nav class="dw-bottom bottomnav" aria-label="하단 메뉴"><div class="dw-wrap">' +
    footer + '</div></nav></body></html>';
}

export function mountLearnerMenu(scope) {
  const panel = scope.querySelector('.dw-drawerPanel');
  const opener = scope.querySelector('[data-dw-menu]');
  if (!panel || !opener) return;
  opener.addEventListener('click', () => {
    panel.showModal();
    opener.setAttribute('aria-expanded','true');
  });
  panel.addEventListener('click', event => {
    if (event.target.closest?.('a[href]') && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) {
      panel.close();
      return;
    }
    if (event.target !== panel) return;
    const box = panel.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) panel.close();
  });
  panel.addEventListener('close', () => {
    opener.setAttribute('aria-expanded','false');
    opener.focus({preventScroll:true});
  });
}

function mountLearner(mountMenu) {
  const role = document.body.dataset.role;
  const topic = document.body.dataset.learnerMenu;
  const guardian = role === 'guardian';
  try { sessionStorage.setItem('dawon-room-role', role); } catch {}
  mountMenu(document);

  if(guardian) document.addEventListener('click',event=>{
    const target=event.target.closest?.('a[href]');
    if(target?.pathname==='/login/dawon' && new URL(target.href).searchParams.get('view')==='counsel'){
      try {sessionStorage.setItem('dawon-counsel-return',location.pathname+location.search);} catch {}
    }
  });
  const view = document.getElementById('dw-view');
  const headline = document.getElementById('dw-latest-notice');
  const params = new URLSearchParams(location.search);
  const today = new Intl.DateTimeFormat('sv-SE', {timeZone:'Asia/Seoul'}).format(new Date());
  const iso = date => date.toISOString().slice(0,10);
  const fromDate = key => new Date(key + 'T00:00:00Z');
  const normalize = key => {
    const date = fromDate(key);
    return /^\d{4}-\d{2}-\d{2}$/.test(key || '') && Number.isFinite(+date) && iso(date) === key && key >= '1900-01-01' && key <= '2100-12-31' ? key : today;
  };
  const shift = (date, days) => iso(new Date(+fromDate(date) + days * 86400000));
  const format = (date, options) => new Intl.DateTimeFormat('ko-KR',{ timeZone:'UTC', ...options }).format(fromDate(date));
  const mode = ['month','day'].includes(params.get('view')) ? params.get('view') : 'week';
  const key = normalize(params.get('date'));
  const period = params.get('period') === 'month' ? 'month' : 'week';

  function element(tag, content, classes) {
    const node = document.createElement(tag);
    if (content) node.textContent = content;
    if (classes) node.className = classes;
    return node;
  }

  function link(label, href, classes) {
    const node = element('a', label, classes);
    node.href = href;
    return node;
  }

  function dateUrl(nextMode, date) {
    const query = new URLSearchParams();
    if (guardian) query.set('preview','guardian');
    query.set('view',nextMode);
    query.set('date',date);
    if (nextMode === 'day') {
      query.set('period',mode === 'day' ? period : mode);
      query.set('originDate',mode === 'day' ? normalize(params.get('originDate') || key) : key);
    }
    return '/learn/' + topic + '?' + query.toString();
  }

  if (view && mode === 'day' && topic !== 'alerts') {
    const back = document.getElementById('dw-back');
    const fromAlerts = params.get('from') === 'alerts';
    const originDate = params.get('originDate');
    const calendar = new URL(dateUrl(period,originDate && normalize(originDate) === originDate ? originDate : key), location.origin);
    calendar.searchParams.set('selected',key);
    back.href = fromAlerts ? '/learn/alerts' + (guardian ? '?preview=guardian' : '') : calendar.pathname + calendar.search;
    back.setAttribute('aria-label',fromAlerts ? '알림으로' : (period === 'month' ? '월간 달력으로' : '주간 달력으로'));
    back.querySelector('span').textContent = fromAlerts ? '알림' : '달력';
  }

  function status(label) {
    const para = element('p', label, 'dw-state');
    para.setAttribute('role','status');
    return para;
  }

  function homeworkRow(record, openByDefault) {
    const task = record.homework;
    const item = element('li',null,'dw-record dw-taskRow');
    const details = element('details');
    details.name = 'dw-homework';
    details.open = openByDefault;
    const summary = element('summary');
    const heading = element('span',null,'dw-recordText');
    heading.append(element('strong',record.title),element('span',record.detail));
    summary.append(heading,element('span','상세','dw-taskToggle'));
    const fields = element('dl',null,'dw-taskBody');
    let deadline = '기한 없음';
    if (task.due_date) deadline = normalize(task.due_date) === task.due_date
      ? format(task.due_date,{year:'numeric',month:'long',day:'numeric',weekday:'short'}) : '기한 확인 필요';
    for (const [label,value] of [
      ['과제 내용',task.student_instructions?.trim() || '등록된 안내가 없습니다.'],
      ['제출기한',deadline],
      ['제출 방법',task.submission_guide?.trim() || '등록된 제출 방법이 없습니다.'],
    ]) fields.append(element('dt',label),element('dd',value));
    details.append(summary,fields);
    item.append(details);
    if (Number.isSafeInteger(task.id) && task.id > 0) {
      const id = String(task.id);
      if (params.has('homework')) details.open = params.get('homework') === id;
      details.addEventListener('toggle',() => {
        if (!details.isConnected) return;
        const url = new URL(location.href);
        if (details.open) url.searchParams.set('homework',id);
        else if (url.searchParams.get('homework') === id) url.searchParams.delete('homework');
        else return;
        if (url.href !== location.href) history.replaceState(history.state,'',url);
      });
    }
    return item;
  }

  function recordList(records) {
    const list = element('ul',null,'dw-dayList');
    for (const [index,record] of records.entries()) {
      if (record.homework) {
        list.append(homeworkRow(record, mode === 'day' && records.length === 1));
        continue;
      }
      const item = element('li',null,'dw-record');
      const text = element('div',null,'dw-recordText');
      const title = element('strong',record.title);
      title.id = 'dw-record-title-' + index;
      text.append(title);
      if (record.detail) text.append(element('span',record.detail));
      item.append(text);
      if (record.attendanceState) {
        const badge = element('span',record.attendanceState,'dw-attendanceState');
        badge.toggleAttribute('data-pending',record.pending);
        item.append(badge);
      }
      if (record.path) {
        const action = link(record.action,record.path,'dw-recordAction');
        action.setAttribute('aria-describedby',title.id);
        item.append(action);
      }
      list.append(item);
    }
    return list;
  }

  function renderList(records, empty) {
    view.append(records.length ? recordList(records) : status(empty));
  }

  function mountQuestions() {
    const storeKey = 'dawon-planning-demo-v1';
    const action = params.get('action');
    const read = () => JSON.parse(localStorage.getItem(storeKey) || '{}');
    const href = (next, id) => {
      const query = new URLSearchParams(params);
      query.set('action',next);
      if (next === 'detail' && action === 'list') query.set('entry','list');
      query.delete('detail');
      if (id) query.set('id',id); else query.delete('id');
      return '/learn/questions?' + query;
    };
    const back = document.querySelector('#dw-back');
    const origin = new URLSearchParams(params);
    ['action','id','detail','entry'].forEach(key => origin.delete(key));
    const fromDay = params.get('entry') === 'date' && origin.get('view') === 'day';
    const toList = action === 'detail' && !fromDay;
    back.href = toList ? href('list') : origin.has('date') ? '/learn/questions?' + origin : '/?preview=student';
    back.setAttribute('aria-label',toList ? '질문 목록으로' : origin.has('date') ? '해당 날짜로' : '홈으로');
    back.querySelector('span').textContent = toList ? '내역' : origin.has('date') ? '날짜별 기록' : '홈';
    view.replaceChildren();
    const nav = element('nav',null,'dw-questionTools');nav.setAttribute('aria-label','질문 메뉴');
    const currentTab = action === 'photo' ? 'ask' : action === 'detail' ? 'list' : action;
    for (const [key,label] of [['ask','질문 작성'],['list','질문 내역']]) {
      const node=link(label,href(key));
      if (currentTab === key) node.setAttribute('aria-current','page');
      nav.append(node);
    }
    view.append(nav,element('p','데모 질문은 이 브라우저에만 저장되며 선생님에게 전송되지 않습니다.','dw-questionNote'));
    const error=element('p');error.setAttribute('role','alert');
    view.append(error);
    let state;
    try {state=read();} catch {error.textContent='질문 기록을 열 수 없습니다. 브라우저 저장 공간을 확인하고 다시 시도해 주세요.';return;}
    const questions=(Array.isArray(state.questions) ? state.questions : []).filter(q=>q?.author==='student' && q.type!=='consult');
    const photoUrl=value=>typeof value==='string' && /^data:image\/(?:jpeg|png|webp);base64,/i.test(value);
    if(action==='list'){
      if(!questions.length)view.append(status('아직 작성한 질문이 없습니다.'));
      for(const q of questions){
        const row=link(q.title,href('detail',q.id),'dw-questionRow');
        row.append(element('span',q.answer?'예시 답변 있음':'답변 없음'));
        view.append(row);
      }
      return;
    }
    if(action==='detail'){
      const q=questions.find(q=>q.id===params.get('id'));
      if(!q){view.append(status('이 질문을 찾을 수 없습니다.'));return;}
      view.append(element('h2',q.title),element('p',q.body,'dw-questionText'));
      if(photoUrl(q.image)){const img=element('img');img.src=q.image;img.alt=q.filename || '첨부한 문제 사진';img.className='dw-questionPhoto';view.append(img);}
      view.append(element('h3',q.answer?'예시 답변':'예시 답변 없음'));
      if(q.answer)view.append(element('p',q.answer,'dw-questionText'));
      return;
    }
    const draft=state.drafts?.question || {};
    const form=element('form',null,'dw-questionForm');
    const field=(tag,label,value,limit)=>{
      const wrap=element('label',label);const input=element(tag);
      input.required=true;input.maxLength=limit;input.value=value || '';wrap.append(input);form.append(wrap);return input;
    };
    const title=field('input','질문 제목',draft.title,80);
    const body=field('textarea','내용',draft.body,1500);
    const photoField=element('details',null,'dw-photoField');
    photoField.open=action==='photo' || Boolean(draft.photo);
    const photoTitle=element('summary','사진 첨부 (선택)');
    const file=element('input');file.type='file';file.accept='image/jpeg,image/png,image/webp';file.hidden=true;
    const buttons=element('div',null,'dw-photoButtons');
    const choose=element('button','사진 선택','dw-action');choose.type='button';
    choose.onclick=()=>{file.removeAttribute('capture');file.click();};
    buttons.append(choose);
    if (matchMedia('(pointer:coarse)').matches || action==='photo'){
      const camera=element('button','사진 촬영','dw-action');camera.type='button';
      camera.onclick=()=>{file.setAttribute('capture','environment');file.click();};buttons.append(camera);
    }
    const preview=element('img',null,'dw-questionPhoto');preview.alt='첨부 사진 미리보기';
    const remove=element('button','사진 제거','dw-action');remove.type='button';buttons.append(remove);
    photoField.append(photoTitle,element('p','JPG, PNG, WEBP · 최대 5MB'),file,buttons,preview);
    const submit=element('button','데모 질문 등록','dw-action');submit.type='submit';
    form.append(photoField,submit);
    view.append(form);
    let photo=photoUrl(draft.photo?.data)?draft.photo:null;
    const paint=()=>{preview.hidden=remove.hidden=!photo;if(photo)preview.src=photo.data;else preview.removeAttribute('src');};
    const persist=()=>{try{const cur=read();cur.drafts={...cur.drafts,question:{title:title.value,body:body.value,photo}};localStorage.setItem(storeKey,JSON.stringify(cur));return true;}catch{error.textContent='저장 공간을 확인해 주세요. 입력한 내용은 이 화면에 남아 있습니다.';return false;}};
    paint();title.oninput=body.oninput=persist;
    remove.onclick=()=>{photo=null;file.value='';paint();persist();};
    file.onchange=async()=>{
      const selected=file.files[0];if(!selected)return;
      error.textContent='';
      if(!['image/jpeg','image/png','image/webp'].includes(selected.type)||selected.size>5*1024*1024){file.value='';error.textContent='5MB 이하 JPEG, PNG, WEBP 사진을 선택해 주세요.';return;}
      submit.disabled=file.disabled=remove.disabled=true;
      const src=URL.createObjectURL(selected);
      try{
        const img=new Image();img.src=src;await img.decode();
        const scale=Math.min(1,720/Math.max(img.naturalWidth,img.naturalHeight));
        const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
        canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
        photo={data:canvas.toDataURL('image/jpeg',0.78),name:selected.name};paint();persist();
      }catch{error.textContent='사진을 읽지 못했습니다. 다른 사진을 선택해 주세요.';}finally{URL.revokeObjectURL(src);submit.disabled=file.disabled=remove.disabled=false;}
    };
    form.onsubmit=event=>{
      event.preventDefault();if(submit.disabled)return;
      if(!title.value.trim()||!body.value.trim()){error.textContent='제목과 내용을 입력해 주세요.';return;}
      try{
        const cur=read();const all=cur.questions || [];
        if(all.length>=20){error.textContent='브라우저 체험 기록은 최대 20개까지 저장할 수 있습니다.';return;}
        const q={id:crypto.randomUUID(),createdAt:new Date().toISOString(),title:title.value.trim(),body:body.value.trim(),type:'question',author:'student',image:photo?.data || null,filename:photo?.name || null};
        cur.questions=[q,...all];cur.drafts={...cur.drafts,question:{}};localStorage.setItem(storeKey,JSON.stringify(cur));submit.disabled=true;location.replace(href('detail',q.id));
      }catch{error.textContent='저장하지 못했습니다. 입력을 유지한 채 다시 시도할 수 있습니다.';}
    };
  }

  function localQuestions() {
    const state = JSON.parse(localStorage.getItem('dawon-planning-demo-v1') || '{}');
    const questions = Array.isArray(state?.questions) ? state.questions : [];
    return questions.filter(row => row?.author === 'student' && row.type !== 'consult' && typeof row.title === 'string')
      .map(row => {
        const date = typeof row.createdAt === 'string' && Number.isFinite(Date.parse(row.createdAt)) ?
          new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul'}).format(new Date(row.createdAt)) : null;
        const query = new URLSearchParams(params);
        query.set('action','detail');
        if (date && mode === 'day') query.set('entry','date');
        query.set('id',row.id);
        return {date, title:row.title, detail:row.answer ? '답변 완료' : '답변 대기',
          ...(row.id ? {path:'/learn/questions?' + query, action:'질문 보기'} : {})};
      });
  }

  function recordsFor(payload) {
    const homeworkStatus = { needs_submission:'제출 필요', awaiting_review:'확인 중', reviewed:'확인 완료' };
    if (topic === 'questions') return guardian ? payload.counsels ?? [] : localQuestions();
    const groups = { notices:payload.notices, clinic:payload.clinics, grades:payload.school_reports };
    if (Object.hasOwn(groups, topic)) return groups[topic] ?? [];
    return (payload.sessions ?? []).flatMap(row => {
      const base = { date:row.date, title:row.title, lecture:row.lecture };
      switch (topic) {
        case 'attendance': {
          const state = row.attendance?.trim();
          const pending = !state || state === '미입력';
          return [{...base, detail:row.lecture, attendanceState:pending ? '입력 대기' : state, pending}];
        }
        case 'curriculum': return [{...base, detail:row.lecture}];
        case 'video': return row.videos.map(title => ({...base, title, detail:row.lecture + ' · ' + row.title,
          ...(guardian ? {} : {path:'/login/dawon?demo=student&view=video&session=' + row.id, action:'수업 영상 보기'})}));
        case 'exam': return row.exams.map(exam => {
          const hasResult = exam.result_available === true && Number.isSafeInteger(exam.id) && exam.id > 0;
          const origin = new URLSearchParams({from:'day', date:key, period});
          if (guardian) origin.set('preview','guardian');
          const originDate = params.get('originDate');
          if (originDate && normalize(originDate) === originDate) origin.set('originDate',originDate);
          return {...base,title:exam.title,detail:row.lecture + ' · ' +
            (exam.score == null ? '결과 대기' : exam.score + (exam.max == null ? '점' : ' / ' + exam.max + '점')),
            ...(hasResult ? {path:'/student/exams/' + exam.id + '/result?' + origin, action:'성적표 보기'} : {})};
        });
        case 'homework': return row.homework.map(homework => ({...base,homework,title:homework.title,detail:row.lecture + ' · ' + (homeworkStatus[homework.state] ?? '배정됨')}));
        default: return [];
      }
    });
  }

  function dayActions() {
    const launchers = {
      exam: guardian ? null : ['테스트 상세 조회','/login/dawon?demo=student&view=exams'],
      questions: guardian ? ['상담 신청·답변 확인','/login/dawon?demo=guardian&view=counsel'] : ['질문하기','/learn/questions?action=ask&detail=question'],
      clinic: guardian ? null : ['클리닉 예약·내 일정','/login/dawon?demo=student&view=clinic'],
      grades: ['학교 성적 입력·조회','/login/dawon?demo=student&view=school-report'],
    };
    const action = launchers[topic];
    if (!action) return;
    const wrapper = element('div',null,'dw-actions');
    if (topic === 'questions' && !guardian) {
      const launch = new URL(location.href);launch.searchParams.set('action','ask');launch.searchParams.set('entry','date');
      wrapper.append(link(action[0],launch.pathname + launch.search,'dw-action'));
      launch.searchParams.set('action','list');wrapper.append(link('질문 내역',launch.pathname + launch.search,'dw-action'));
    } else wrapper.append(link(action[0],action[1],'dw-action'));
    view.append(wrapper);
  }

  const recordKind = {
    notices:'공지', attendance:'출결 기록', video:'수업 영상·자료', exam:'테스트 결과',
    homework:'과제', curriculum:'수업 진도', clinic:'클리닉 일정',
    questions: guardian ? '상담 기록' : '질문', grades:'학교 성적',
  }[topic];

  function showEmpty(records, place) {
    const empty = element('div',null,'dw-empty');
    empty.append(status(place + ' 등록된 기록이 없습니다.'));
    const dates = records.map(row => row.date).filter(date => date && normalize(date) === date);
    const reference = +fromDate(key);
    const nearest = dates.reduce((best, date) => {
      if (!best) return date;
      const distance = Math.abs(+fromDate(date) - reference);
      const bestDistance = Math.abs(+fromDate(best) - reference);
      return distance < bestDistance || (distance === bestDistance && date < best) ? date : best;
    }, null);
    if (nearest) {
      const options = {month:'long',day:'numeric',weekday:'short'};
      if (nearest.slice(0,4) !== key.slice(0,4)) options.year = 'numeric';
      empty.append(link((topic === 'attendance' ? '가장 가까운 수업일' : '가장 가까운 기록') + ' · ' + format(nearest,options),dateUrl('day',nearest),'dw-nearest'));
    }
    view.append(empty);
  }

  function renderCalendar(records) {
    const monthly = mode === 'month';
    const current = fromDate(key);
    const first = fromDate(key.slice(0,7) + '-01');
    const start = monthly ? shift(iso(first),-first.getUTCDay()) : shift(key,-current.getUTCDay());
    const monthLength = new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth()+1,0)).getUTCDate();
    const count = monthly ? 7 * Math.ceil((first.getUTCDay() + monthLength) / 7) : 7;
    const adjacent = offset => monthly ? iso(new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth()+offset,1))) : shift(key,offset*7);
    const heading = element('header',null,'dw-calendarHeader');
    const dates = element('nav',null,'dw-period');
    dates.setAttribute('aria-label','기간 이동');
    const periodStep = (offset, symbol, name) => {
      const control = link(symbol,dateUrl(mode,adjacent(offset)),'dw-step');
      control.setAttribute('aria-label',name);
      return control;
    };
    const end = shift(start,6);
    const periodLabel = monthly ? format(key,{month:'long'}) : format(start,{month:'long',day:'numeric'}) +
      ' – ' + format(end,start.slice(0,7) === end.slice(0,7) ? {day:'numeric'} : {month:'long',day:'numeric'});
    const title = element('h2');
    const yearLabel = monthly || start.slice(0,4) === end.slice(0,4) ? format(key,{year:'numeric'}) :
      format(start,{year:'numeric'}) + ' – ' + format(end,{year:'numeric'});
    title.append(element('span',yearLabel,'dw-year'),document.createTextNode(periodLabel));
    dates.append(periodStep(-1,'‹','이전 기간'),title,periodStep(1,'›','다음 기간'));
    const tools = element('div',null,'dw-calendarOptions');
    const modes = element('nav',null,'dw-controls dw-modeSwitch');
    modes.setAttribute('aria-label','달력 보기');
    for (const [id,label] of [['week','주간'],['month','월간']]) {
      const control = link(label,dateUrl(id,key));
      control.id = 'dw-mode-' + id;
      if (id === mode) control.setAttribute('aria-current','true');
      modes.append(control);
    }
    tools.append(link('오늘',dateUrl(mode,today),'dw-todayLink'),modes);
    heading.append(dates,tools);
    const byDate = new Map();
    const pendingByDate = new Map();
    for (const row of records) {
      if (!row.date) continue;
      byDate.set(row.date,(byDate.get(row.date) ?? 0) + 1);
      if (row.pending) pendingByDate.set(row.date,(pendingByDate.get(row.date) ?? 0) + 1);
    }
    const grid = element('div',null,'dw-days');
    for (const day of ['일','월','화','수','목','금','토']) grid.append(element('span',day,'dw-weekday'));
    let visibleCount = 0;
    for (let index=0; index<count; index++) {
      const date = shift(start,index);
      const items = byDate.get(date) ?? 0;
      const pending = pendingByDate.get(date) ?? 0;
      const attendanceLabels = [items > pending && '출결 입력 ' + (items-pending) + '건',pending && '입력 대기 ' + pending + '건'].filter(Boolean);
      visibleCount += items;
      const cell = link(null,dateUrl('day',date),'dw-day');
      cell.id = 'dw-cal-' + date;
      cell.dataset.outside = String(monthly && date.slice(0,7) !== key.slice(0,7));
      cell.toggleAttribute('data-records',items > pending);
      cell.toggleAttribute('data-only-pending',pending > 0 && pending === items);
      const isToday = date === today;
      const isLastViewed = date === params.get('selected');
      const noticeDate = topic === 'notices' && date === params.get('noticeDate');
      cell.toggleAttribute('data-last-viewed',isLastViewed || noticeDate);
      cell.setAttribute('aria-label',[format(date,{month:'long',day:'numeric',weekday:'long'}), isToday && '오늘',
        isLastViewed && '마지막으로 본 날짜', noticeDate && '선택한 공지 날짜', items ? topic === 'attendance' ? attendanceLabels.join(' · ') : recordKind + ' ' + items + '건' : '기록 없음'].filter(Boolean).join(' · '));
      if (isToday) cell.setAttribute('aria-current','date');
      const label = element('span',String(Number(date.slice(8))),'dw-dayNumber');
      const hint = element('span',null,'dw-dayHint');
      hint.setAttribute('aria-hidden','true');
      if (isToday) hint.append('오늘');
      const mark = element('span',null,'dw-marker');
      mark.hidden = items === pending;
      hint.append(mark);
      if (pending) hint.append(element('span',null,'dw-marker dw-markerPending'));
      cell.append(label,hint);
      grid.append(cell);
    }
    view.append(heading,grid);
    if (visibleCount) {
      const legend = element('p',null,'dw-legend');
      if (topic === 'attendance') {
        legend.append(element('span',null,'dw-marker'),document.createTextNode('출결 입력'),
          element('span',null,'dw-marker dw-markerPending'),document.createTextNode('입력 대기'));
      } else legend.append(element('span',null,'dw-marker'),document.createTextNode(recordKind + ' 있음'));
      view.append(legend);
    } else {
      showEmpty(records,monthly ? '이 달에는' : '이 주에는');
    }
  }

  function render(payload) {
    if (headline) {
      const notice = payload.notices?.[0];
      const spotlight = headline.closest('a');
      document.querySelector('.dw-homeNoticeError').hidden = true;
      spotlight.hidden = !notice?.title;
      headline.textContent = notice?.title || '';
      const stamp = spotlight.querySelector('time');
      stamp.textContent = '';
      stamp.removeAttribute('datetime');
      spotlight.href = '/learn/notices' + (guardian ? '?preview=guardian' : '');
      if (notice?.date && normalize(notice.date) === notice.date) {
        stamp.dateTime = notice.date;
        stamp.textContent = format(notice.date,{month:'numeric',day:'numeric'});
        const destination = new URL(spotlight.href);
        destination.searchParams.set('date',notice.date);
        destination.searchParams.set('noticeDate',notice.date);
        headline.closest('a').href = destination.pathname + destination.search;
      }
    }
    if (!view) return;
    view.replaceChildren();
    if (topic === 'alerts') {
      const alerts = [
        ...(payload.notices ?? []).map(row => ({...row, menu:'notices', action:'공지 보기'})),
        ...(guardian ? (payload.counsels ?? []).filter(row => row.detail === '답변 완료')
          .map(row => ({...row, menu:'questions', action:'상담 내역 보기'})) :
          (payload.clinics ?? []).filter(row => row.booked)
            .map(row => ({...row, menu:'clinic', action:'클리닉 기록 보기'}))),
      ].sort((left,right) => (right.date || '').localeCompare(left.date || ''));
      const days = new Map();
      for (const record of alerts) {
        if (!days.has(record.date)) days.set(record.date,[]);
        days.get(record.date).push({...record, path:'/learn/' + record.menu + '?' +
          new URLSearchParams({ ...(guardian ? {preview:'guardian'} : {}), ...(record.date && normalize(record.date) === record.date ? {view:'day', date:record.date, from:'alerts'} : {}) })});
      }
      if (!days.size) view.append(status('새 알림이 없습니다.'));
      for (const [date,items] of days) {
        const section = element('section',null,'dw-alertDay');
        const label = date && normalize(date) === date ? format(date,{year:'numeric',month:'long',day:'numeric',weekday:'short'}) : '날짜 미확인';
        section.append(element('h2',label),recordList(items));
        view.append(section);
      }
      return;
    }
    const records = recordsFor(payload);
    if (mode === 'day') {
      const dated = records.filter(record => record.date === key);
      const heading = element('header',null,'dw-detailHead');
      heading.append(element('h2',format(key,{year:'numeric',month:'long',day:'numeric',weekday:'long'}),'dw-detailDate'));
      if (dated.length) {
        const count = topic === 'attendance' ? '출결 입력 ' + dated.filter(row=>!row.pending).length + '건 · 입력 대기 ' + dated.filter(row=>row.pending).length + '건' : dated.length + '건';
        heading.append(element('span',count,'dw-count'));
      }
      view.append(heading);
      if (dated.length) view.append(recordList(dated));
      else showEmpty(records,'이 날짜에는');
      if (topic !== 'exam' || dated.some(record => !record.path)) dayActions();
    } else {
      renderCalendar(records);
      const undated = records.filter(record => !record.date);
      if (undated.length) {
        const details = element('details',null,'dw-actions');
        details.append(element('summary','날짜 미확인 기록'));
        details.append(recordList(undated));
        if (topic === 'questions' && !guardian) details.append(link('전체 질문 보기','/learn/questions?action=list','dw-action'));
        if (topic === 'exam' && !guardian) details.append(link('테스트 상세 조회','/login/dawon?demo=student&view=exams','dw-action'));
        view.append(details);
      }
    }
  }

  if (topic === 'questions' && !guardian && ['ask','list','detail','photo'].includes(params.get('action'))) {
    mountQuestions();
    return;
  }

  const projectionCache = 'dawon-learning-projection-r30';
  async function load(force = false) {
    try {
      if (topic === 'questions' && !guardian) {
        render({});
        return;
      }
      if (!force) {
        try {
          const cached = JSON.parse(sessionStorage.getItem(projectionCache) || 'null');
          if (cached && Date.now() - cached.fetchedAt < 5000) {
            render(cached.payload);
            return;
          }
        } catch {}
      }
      const response = await fetch('/api/v1/students/demo-learning/', {cache:'no-store',credentials:'omit'});
      if (!response.ok) throw new Error('learning-data');
      const payload = await response.json();
      try { sessionStorage.setItem(projectionCache,JSON.stringify({payload,fetchedAt:Date.now()})); } catch {}
      render(payload);
    } catch {
      if (!view && headline) {
        const error = document.querySelector('.dw-homeNoticeError');
        headline.closest('a').hidden = true;
        const retry = element('button','다시 시도','dw-action');
        retry.type = 'button';
        retry.onclick = () => { retry.disabled = true; void load(true); };
        error.replaceChildren(element('span','최신 공지를 불러오지 못했습니다.'),retry);
        error.hidden = false;
        return;
      }
      if (!view) return;
      const retry = element('button','다시 시도','dw-action');
      retry.type = 'button';
      retry.onclick = () => { retry.disabled = true; void load(true); };
      const message = topic === 'questions' && !guardian ?
        '질문 기록을 열 수 없습니다. 브라우저 저장 공간을 확인해 주세요.' : '기록을 불러오지 못했습니다.';
      view.replaceChildren(status(message),retry);
      if (mode === 'day') dayActions();
    }
  }

  window.addEventListener('pageshow', event => { if (event.persisted) void load(true); });
  void load(performance.getEntriesByType('navigation')[0]?.type === 'reload');
}

export const dawonLearnerScript = '(' + mountLearner.toString() + ')(' + mountLearnerMenu.toString() + ');';
