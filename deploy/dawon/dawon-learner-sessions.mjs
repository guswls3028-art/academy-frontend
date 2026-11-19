export function installDawonSessions() {
  const schedule = document.querySelector('#schedule-view');
  const home = document.querySelector('#panel-home .simple-home');
  const video = document.querySelector('#panel-video');
  if (!schedule || !home || !video) return;

  // Legacy calendar code still owns its original nodes and listens for route changes.
  // Its sibling follows the same route without sharing either DOM or local demo data.
  const calendar = document.createElement('section');
  calendar.className = 'dw-lessons';
  calendar.setAttribute('aria-label', '수업 일정');
  schedule.after(calendar);
  const overview = document.createElement('section');
  overview.className = 'dw-lessons dw-home';
  home.prepend(overview);
  const library = document.createElement('section');
  library.className = 'dw-lessons';
  video.prepend(library);
  const extraPanels = new Map();
  for (const [topic, title] of [['attendance','출결 현황'],['exam','테스트 결과'],['homework','과제 현황'],['curriculum','수업 진도']]) {
    const host = document.getElementById('panel-' + topic);
    if (!host) continue;
    host.classList.add('dw-projection');
    const content = document.createElement('section');
    content.className = 'dw-lessons';
    host.prepend(content);
    extraPanels.set(topic, {content, title});
  }
  const styles = document.createElement('style');
  styles.textContent = `
    #schedule-view,.dw-projection>:not(.dw-lessons),#panel-video>:not(.dw-lessons),#panel-home .student-heading {display:none!important}
    .dw-lessons{padding:16px;max-width:760px;margin:0 auto;color:#372719;background:#fff;box-sizing:border-box}
    .dw-lessons[hidden]{display:none!important}.dw-lessons *{box-sizing:border-box}
    .dw-lessons h2,.dw-lessons h3,.dw-lessons p{margin:0 0 8px;overflow-wrap:anywhere}
    .dw-lessons h2{font-size:1.28rem}.dw-lessons h3{font-size:1.04rem}
    .dw-lessons ul{padding-inline-start:21px}.dw-lessons p{color:#705c50}
    .dw-lessons a,.dw-lessons button{color:#92400d;font:inherit}
    .dw-lessons a:focus-visible,.dw-lessons button:focus-visible{outline:3px solid #a64916;outline-offset:1px}
    .dw-controls{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin:8px 0}
    .dw-controls a,.dw-lessons button{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:6px 12px;border:1px solid #ddcebf;background:#fff;border-radius:8px;text-decoration:none}
    .dw-controls a[aria-current],.dw-days a[aria-current]{background:#fff0e1;border-color:#a64916;font-weight:700}
    .dw-days{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:3px}
    .dw-days span,.dw-days a{text-align:center;min-width:0}
    .dw-days a{height:54px;display:flex;flex-direction:column;align-items:center;justify-content:center;border:1px solid #e6d9cd;border-radius:8px;text-decoration:none}
    .dw-days small{font-size:10px;display:block}.dw-card{padding:12px 0;border-top:1px solid #eadfd4}
    .dw-card a,.dw-home a{display:inline-block;padding:8px 0}.dw-home{border-radius:12px;margin:0 0 12px}
  `;
  document.head.append(styles);
  const el = (tag, text, cls) => {
    const node = document.createElement(tag);
    if (text != null) node.textContent = text;
    if (cls) node.className = cls;
    return node;
  };
  const link = (text, href) => {
    const a = el('a', text);
    a.href = href;
    return a;
  };
  const today = new Intl.DateTimeFormat('sv-SE', {timeZone:'Asia/Seoul'}).format(new Date());
  const iso = d => d.toISOString().slice(0,10);
  const parse = key => new Date(key + 'T00:00:00Z');
  const shift = (key, days) => iso(new Date(+parse(key) + days * 86400000));
  const url = (mode, key) => '/learn/schedule?view=' + mode + '&date=' + key;
  const valid = key => /^\d{4}-\d{2}-\d{2}$/.test(key || '') && Number.isFinite(+parse(key)) && iso(parse(key)) === key && key.slice(0,4) >= '1001' && key.slice(0,4) <= '9998';
  let rows = [], status = 'loading', inFlight = false;
  const guardian = () => document.body.dataset.role === 'guardian' || sessionStorage.getItem('dawon-room-role') === 'guardian';
  function stateBox(root) {
    if (status === 'ready') return false;
    root.append(el('p',status === 'loading' ? '수업을 불러오는 중…' : '수업을 불러오지 못했어요.'));
    if (status === 'error') {
      const retry = el('button','다시 시도');
      retry.onclick = load;
      root.append(retry);
    }
    return true;
  }
  function list(root, labels, empty) {
    if (!labels.length) { root.append(el('p', empty)); return; }
    const ul = el('ul');
    for (const label of labels) ul.append(el('li', label));
    root.append(ul);
  }
  const examLabel = e => e.title + (e.score == null ? ' · 결과 대기' : ' · ' + e.score + (e.max == null ? '점' : ' / ' + e.max + '점'));
  const homeworkLabel = h => h.title + ' · ' + ({needs_submission:'제출 필요',awaiting_review:'확인 중',reviewed:'확인 완료'}[h.state] || '배정됨');
  function details(dayRows) {
    const categories = [
      ['출결 현황', r => [r.attendance || '출결 미입력'], '등록된 출결이 없어요.'],
      ['수업 영상·자료', r => r.videos, '공개된 수업 영상·자료가 없어요.'],
      ['테스트 결과', r => r.exams.map(examLabel), '공개된 테스트 결과가 없어요.'],
      ['과제 현황', r => r.homework.map(homeworkLabel), '배정된 과제가 없어요.']
    ];
    for (const [title, values, empty] of categories) {
      const group = el('section', null, 'dw-card');
      group.append(el('h3', title));
      if (!dayRows.length) group.append(el('p', empty));
      for (const row of dayRows) {
        group.append(el('strong', row.lecture + ' · ' + row.title));
        list(group, values(row), empty);
        if (title === '수업 영상·자료' && row.videos.length && !guardian()) {
          group.append(link('수업 영상 보기', '/student/video/sessions/' + row.id));
        }
      }
      calendar.append(group);
    }
  }
  function paintCalendar() {
    const params = new URLSearchParams(location.search);
    const key = valid(params.get('date')) ? params.get('date') : today;
    const mode = ['day','month'].includes(params.get('view')) ? params.get('view') : 'week';
    const date = parse(key);
    const header = el('h2', mode === 'day' ? key + ' 수업 상세' : key.slice(0,7).replace('-','년 ') + '월 수업 일정');
    calendar.replaceChildren(header);
    const controls = el('nav', null, 'dw-controls');
    controls.setAttribute('aria-label','달력 보기');
    for (const [value, label] of [['week','주간'],['month','월별']]) {
      const a = link(label,url(value,key)); a.id = 'dw-mode-' + value;
      if (mode === value) a.setAttribute('aria-current','true');
      controls.append(a);
    }
    calendar.append(controls);
    if (stateBox(calendar)) return;
    const byDate = new Map();
    for (const r of rows) {
      if (!byDate.has(r.date)) byDate.set(r.date,[]);
      byDate.get(r.date).push(r);
    }
    if (mode === 'day') {
      const dayRows = byDate.get(key) || [];
      if (!dayRows.length) calendar.append(el('p','등록된 수업이 없는 날이에요.'));
      details(dayRows);
      return;
    }
    const monthly = mode === 'month';
    const first = monthly ? key.slice(0,7) + '-01' : key;
    const start = shift(first,-parse(first).getUTCDay());
    const monthLength = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth()+1,0)).getUTCDate();
    const count = monthly ? Math.ceil((monthLength + parse(first).getUTCDay())/7)*7 : 7;
    const adjacent = n => monthly ? iso(new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+n,1))) : shift(key,n*7);
    controls.append(link('이전',url(mode,adjacent(-1))),link('오늘',url(mode,today)),link('다음',url(mode,adjacent(1))));
    const grid = el('div',null,'dw-days');
    for (const w of ['일','월','화','수','목','금','토']) grid.append(el('span',w));
    for (let i=0;i<count;i++) {
      const day = shift(start,i), lessons = byDate.get(day) || [];
      const a = link(String(Number(day.slice(8))),url('day',day)); a.id='dw-cal-'+day;
      a.setAttribute('aria-label',day+' · 수업 '+lessons.length+'개');
      if (day === today) a.setAttribute('aria-current','date');
      if (lessons.length) a.append(el('small','수업 '+lessons.length));
      grid.append(a);
    }
    calendar.append(grid);
    const visible=rows.filter(r => r.date && r.date>=start && r.date<=shift(start,count-1));
    if (!visible.length) calendar.append(el('p','이 기간에는 등록된 수업이 없어요.'));
    for (const row of visible) {
      const card=el('div',null,'dw-card');
      card.append(link(row.date+' · '+row.lecture+' · '+row.title,url('day',row.date)));
      calendar.append(card);
    }
  }
  function paintLearningMenus() {
    const ordered = [...rows].sort((a,b)=>(b.date || '').localeCompare(a.date || '') || b.id-a.id);
    for (const [topic, {content, title}] of extraPanels) {
      content.replaceChildren(el('h2',title));
      if (topic === 'exam' && !guardian()) {
        const native = link('등록된 수업의 시험 결과 보기','/login/dawon?demo=student&view=exams');
        native.className = 'route-action dawon-native-exams';
        content.append(native);
      }
      if (stateBox(content)) continue;
      let count = 0;
      for (const row of ordered) {
        let labels = [];
        if (topic === 'attendance') labels = [row.attendance || '출결 미입력'];
        if (topic === 'exam') labels = row.exams.map(examLabel);
        if (topic === 'homework') labels = row.homework.map(homeworkLabel);
        if (topic !== 'curriculum' && !labels.length) continue;
        count++;
        const card = el('section',null,'dw-card');
        card.append(el('h3',row.title),el('p',row.lecture));
        if (labels.length) list(card, labels, '');
        if (row.date) card.append(link(row.date + ' · 날짜 상세',url('day',row.date)));
        else card.append(el('p','날짜 미정'));
        content.append(card);
      }
      if (!count) content.append(el('p',{
        attendance:'등록된 차시가 없어요.',exam:'공개된 테스트 결과가 없어요.',
        homework:'배정된 과제가 없어요.',curriculum:'등록된 차시가 없어요.'
      }[topic]));
    }
  }
  function paint() {
    calendar.hidden = schedule.hidden;
    paintCalendar();
    paintLearningMenus();
    overview.replaceChildren(el('h2',guardian() ? '자녀 수업' : '내 수업'));
    library.replaceChildren(el('h2','수업 영상'));
    if (stateBox(overview)) { stateBox(library); return; }
    const dated = rows.filter(r => r.date).sort((a,b)=>a.date.localeCompare(b.date)||a.id-b.id);
    const next = dated.find(r=>r.date>=today) || dated.at(-1);
    if (next) overview.append(el('p',next.lecture),link(next.date+' · '+next.title,url('day',next.date)));
    else overview.append(el('p','아직 예정된 수업이 없어요.'));
    const videos = rows.filter(r=>r.videos.length);
    if (!videos.length) library.append(el('p','공개된 수업 영상이 없어요.'));
    for (const row of videos) {
      const card=el('section',null,'dw-card');
      card.append(el('h3',row.title),el('p',row.lecture + (row.date ? ' · '+row.date : '')));
      list(card,row.videos,'');
      if (!guardian()) card.append(link('수업 영상 보기','/student/video/sessions/'+row.id));
      library.append(card);
    }
  }
  async function load() {
    if(inFlight) return;
    inFlight=true;status='loading';paint();
    try {
      const res=await fetch('/api/v1/students/demo-learning/',{cache:'no-store',credentials:'omit'});
      if (!res.ok) throw Error();
      const data=await res.json();
      if (!Array.isArray(data.sessions)) throw Error();
      rows=data.sessions;status='ready';
    } catch { status='error'; } finally {inFlight=false;paint();}
  }
  new MutationObserver(()=>{calendar.hidden=schedule.hidden;}).observe(schedule,{attributes:true,attributeFilter:['hidden']});
  document.addEventListener('routechange',()=>queueMicrotask(paint));
  window.addEventListener('pageshow',e=>{if(e.persisted) load();});
  window.addEventListener('popstate',()=>queueMicrotask(paint));
  load();
}
