// Embedded in the dedicated review Worker. Reads only the signed-in role's
// linked course scope, then opens the native session editor for the chosen row.
export function createTaskPicker({role, root, node, api, urlOf, navigate, canLeave}) {
  const actions = {attendance:'출결 입력',assignments:'과제 확인'};
  let panel, controller, scope, key;
  const validId = id => Number.isSafeInteger(id) && id > 0;
  const base = (work,course) => 'lectures?work=' + work + (course ? '&course=' + course : '');
  function clear() {
    controller?.abort(); panel?.remove(); panel = null; key = null;
  }
  async function show(url) {
    const work = url.searchParams.get('work');
    if (url.pathname !== '/workspace/lectures' || !Object.hasOwn(actions,work)) { clear(); return; }
    const course = url.searchParams.get('course') || '';
    if (key === work + '/' + course) return;
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
        const feed = await api(role,'students/teacher-alerts/?settings=1',signal);
        if (signal.aborted) return;
        if (!Array.isArray(feed.lectures)) throw Error('courses');
        scope = feed.lectures.filter(row=>validId(row.id) && typeof row.title === 'string');
      }
      if (!scope.length) { status('선택할 수 있는 편성 강의가 없습니다.'); return; }
      const select = node('select',null,{'aria-label':'업무 강의 선택'});
      select.append(node('option','강의를 선택하세요',{value:''}));
      for (const row of scope) select.append(node('option',row.title,{value:String(row.id)}));
      select.value = scope.some(row=>String(row.id) === course) ? course : '';
      const label = node('label',role === 'teacher' ? '담당 강의' : '편성 강의');
      label.append(select); fields.append(label);
      select.onchange = () => {
        if (canLeave()) navigate(urlOf(base(work,select.value)));
        else select.value = course;
      };
      if (!course) { body.replaceChildren(); return; }
      if (!select.value) { status('이 강의는 조회할 수 없습니다. 다른 강의를 선택해 주세요.'); return; }
      status('차시를 불러오는 중입니다.');
      const result = await api(role,'lectures/sessions/?lecture=' + course,signal);
      if (signal.aborted) return;
      const sessions = Array.isArray(result) ? result : result?.results;
      if (!Array.isArray(sessions)) throw Error('sessions');
      const rows = sessions.filter(row=>validId(row.id) && String(row.lecture) === course)
        .sort((a,b)=>(a.order ?? Infinity)-(b.order ?? Infinity) || a.id-b.id);
      if (!rows.length) { status('이 강의에 등록된 차시가 없습니다.'); return; }
      const list = node('ul');
      for (const row of rows) {
        const route = 'lectures/' + course + '/sessions/' + row.id + '/' + work;
        const a = node('a',null,{href:urlOf(route),'data-staff-link':'','data-edition-path':route});
        a.append(node('span',row.display_label || (row.order != null ? row.order + '차시' : '차시')),
          node('strong',row.title || '제목 미등록'),node('small',row.date || '날짜 미정'));
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
  return {show,clear};
}
