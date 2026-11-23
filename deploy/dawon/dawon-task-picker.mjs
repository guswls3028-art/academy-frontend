// Embedded in the dedicated review Worker. Reads only the signed-in role's
// linked course scope, then opens the native session editor for the chosen row.
export function createTaskPicker({role, root, node, api, urlOf, navigate, canLeave}) {
  const actions = {attendance:'출결 입력',assignments:'과제 확인'};
  let panel, controller, scope, key;
  const sessionLabels = new Map();
  const validId = id => Number.isSafeInteger(id) && id > 0;
  const base = (work,course) => 'lectures?work=' + work + (course ? '&course=' + course : '');
  async function courseScope(signal) {
    if (scope) return scope;
    const feed = await api(role,'students/teacher-alerts/?settings=1',signal);
    if (signal.aborted || !Array.isArray(feed?.lectures)) throw Error('courses');
    scope = feed.lectures.filter(row=>validId(row.id) && typeof row.title === 'string');
    return scope;
  }
  function labelFor(row,courseTitle) {
    const order = Number.isInteger(row.order) ? row.order + '회차' : '회차 미정';
    return {title:row.title || row.display_label || order,course:courseTitle,order};
  }
  async function resolveSessionLabel(path,signal) {
    if (sessionLabels.has(path)) return sessionLabels.get(path);
    const match = /^lectures\/([1-9]\d*)\/sessions\/([1-9]\d*)$/.exec(path);
    if (!match) return null;
    const courses = await courseScope(signal);
    const course = courses.find(c=>String(c.id) === match[1]);
    if (!course || signal.aborted) return null;
    const row = await api(role,'lectures/sessions/' + match[2] + '/',signal);
    if (signal.aborted || String(row?.id) !== match[2] || row.lecture !== course.id) return null;
    const label = labelFor(row,course.title);
    sessionLabels.set(path,label);
    return label;
  }
  function clear() {
    controller?.abort(); panel?.remove(); panel = null; key = null;
  }
  async function show(url) {
    const work = url.searchParams.get('work');
    if (url.pathname !== '/workspace/lectures' || !Object.hasOwn(actions,work)) { clear(); return; }
    const course = url.searchParams.get('course') || '';
    if (key === work + '/' + course) return;
    const doc = root.ownerDocument;
    const trigger = doc?.activeElement;
    const focusOnArrival = trigger?.closest('[data-edition-desk],.ed-index');
    clear(); key = work + '/' + course;
    controller = new AbortController();
    const {signal} = controller;
    panel = node('section',null,{class:'ed-session-picker','aria-label':actions[work] + ' 차시 선택'});
    const heading = node('header');
    heading.append(node('h2',actions[work]),node('a','강의 목록',{href:urlOf('lectures'),'data-staff-link':''}));
    const fields = node('div',null,{class:'ed-picker-field'});
    const body = node('div',null,{class:'ed-picker-list','aria-live':'polite'});
    const status = text => body.replaceChildren(node('p',text,{role:'status'}));
    panel.append(heading,fields,body); root.append(panel);
    try {
      if (!scope) {
        status('강의를 불러오는 중입니다.');
        await courseScope(signal);
        if (signal.aborted) return;
      }
      if (!scope.length) { status('선택할 수 있는 편성 강의가 없습니다.'); return; }
      const select = node('select',null,{'aria-label':'업무 강의 선택'});
      select.append(node('option','강의를 선택하세요',{value:''}));
      for (const row of scope) select.append(node('option',row.title,{value:String(row.id)}));
      select.value = scope.some(row=>String(row.id) === course) ? course : '';
      const label = node('label',role === 'teacher' ? '담당 강의' : '편성 강의');
      label.append(select); fields.append(label);
      if (focusOnArrival && (doc.activeElement === trigger || (!trigger.isConnected && doc.activeElement === doc.body))) {
        select.focus({preventScroll:true});
      }
      select.onchange = () => {
        if (canLeave()) navigate(urlOf(base(work,select.value)));
        else select.value = course;
      };
      if (!course) { body.replaceChildren(); return; }
      if (!select.value) { status('이 강의는 조회할 수 없습니다. 다른 강의를 선택해 주세요.'); return; }
      status('차시를 불러오는 중입니다.');
      const sessions = [];
      const endpoint = 'lectures/sessions/?lecture=' + course;
      let page = 1;
      for (;;) {
        const result = await api(role,endpoint + (page === 1 ? '' : '&page=' + page),signal);
        if (signal.aborted) return;
        const items = Array.isArray(result) ? result : result?.results;
        if (!Array.isArray(items)) throw Error('sessions');
        sessions.push(...items);
        if (!result.next) break;
        const next = Number(new URL(result.next,url).searchParams.get('page'));
        if (!validId(next) || next <= page) throw Error('pagination');
        page = next;
      }
      const rows = sessions.filter(row=>validId(row.id) && String(row.lecture) === course)
        .sort((a,b)=>(a.order ?? Infinity)-(b.order ?? Infinity) || a.id-b.id);
      if (!rows.length) { status('이 강의에 등록된 차시가 없습니다.'); return; }
      const list = node('ul');
      const courseTitle = scope.find(item => String(item.id) === course)?.title || '';
      for (const row of rows) {
        const sessionPath = 'lectures/' + course + '/sessions/' + row.id;
        const route = sessionPath + '/' + work;
        const a = node('a',null,{href:urlOf(route),'data-staff-link':'','data-edition-path':route});
        const label = labelFor(row,courseTitle);
        sessionLabels.set(sessionPath,label);
        a.append(node('span',label.order),node('strong',row.title || row.display_label || '제목 미등록'),
          node('small',row.date || '날짜 미정'));
        const li = node('li'); li.append(a); list.append(li);
      }
      body.replaceChildren(list);
    } catch {
      if (signal.aborted) return;
      const retry = node('button','다시 시도',{type:'button'});
      retry.onclick = () => { key = null; void show(url); };
      body.replaceChildren(node('p','목록을 불러오지 못했습니다.',{role:'alert'}),retry);
    }
  }
  return {show,clear,sessionLabel:path => sessionLabels.get(path),resolveSessionLabel};
}
