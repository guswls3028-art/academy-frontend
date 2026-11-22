export function renderStudentMenu(ctx) {
  const {topic,payload,view,params,key,today,format,shift,element,link,status,recordsFor} = ctx;
  if (!['notices','attendance','video','exam'].includes(topic) || params.get('preview') === 'guardian' || params.get('view') === 'day') return false;
  const id = value => Number.isSafeInteger(value) && value > 0;
  const dated = value => typeof value === 'string' && /^\d{4}-\d\d-\d\d$/.test(value) && !Number.isNaN(Date.parse(value));
  const dateLabel = value => dated(value) ? format(value,{year:'numeric',month:'long',day:'numeric',weekday:'short'}) : '날짜 미정';
  const sessions = payload.sessions ?? [];
  const section = element('section',null,'dw-direct');
  view.append(section);
  const dateSort = (a,b) => String(b.date || '').localeCompare(String(a.date || ''));
  function route(label,path) {
    return link(label,path,'dw-directLink');
  }
  if (topic === 'notices') {
    const requested = params.get('notice');
    function noticeText(body) {
      if (!body || !/<[a-z][^>]*>/i.test(body)) return body;
      const template = document.createElement('template');
      template.innerHTML = body;
      const fragment = template.content;
      for (const node of fragment.querySelectorAll('style,script,template')) node.remove();
      for (const node of fragment.querySelectorAll('br,p,div,li,h1,h2,h3,h4,blockquote,tr')) node.append(document.createTextNode('\n'));
      return fragment.textContent.trim();
    }
    const notices = (payload.notices ?? []).filter(row => !requested || (id(row.id) && String(row.id) === requested));
    if (!notices.length) section.append(status(requested ? '이 공지를 조회할 수 없습니다.' : '등록된 공지가 없습니다.'));
    for (const notice of notices) {
      const article = element('article',null,'dw-directCard');
      article.append(element('h2',notice.title),element('p',dateLabel(notice.date),'dw-directMeta'),
        element('p',noticeText(notice.detail) || '등록된 공지 본문이 없습니다.','dw-directBody'));
      if (notice.has_attachments && id(notice.id)) article.append(route('첨부파일 보기','/student/notices/' + notice.id + '?from=menu'));
      section.append(article);
    }
    if (requested) section.append(route('전체 공지 보기','/learn/notices'));
  }
  if (topic === 'attendance') {
    const offset = new Date(key + 'T00:00:00Z').getUTCDay();
    const start = shift(key,-offset);
    const controls = element('nav',null,'dw-directWeekNav');
    controls.setAttribute('aria-label','출결 주간 이동');
    const weekUrl = day => '/learn/attendance?date=' + day;
    controls.append(route('이전 주',weekUrl(shift(start,-7))),element('h2',format(start,{month:'long',day:'numeric'})+' – '+format(shift(start,6),{month:'long',day:'numeric'})),route('다음 주',weekUrl(shift(start,7))));
    section.append(controls);
    const week = element('ol',null,'dw-directWeek');
    const records = recordsFor(payload);
    for (let n=0;n<7;n++) {
      const date = shift(start,n);
      const day = element('li');
      const label = element('h3',format(date,{month:'numeric',day:'numeric',weekday:'short'}));
      if (date === today) label.append(element('small','오늘'));
      day.append(label);
      const rows = records.filter(row => row.date === date);
      for (const row of rows) {
        const item = element('div',null,'dw-directLesson');
        const state = element('strong',row.attendanceState,'dw-attendanceState');
        state.toggleAttribute('data-pending',row.pending);
        item.append(state,element('span',row.title),element('small',row.lecture));
        day.append(item);
      }
      if (!rows.length) day.append(element('p','수업 없음','dw-directMeta'));
      week.append(day);
    }
    section.append(week);
  }
  if (topic === 'video') {
    const courses = new Map();
    for (const session of [...sessions].sort(dateSort)) {
      const videos = session.video_items ?? session.videos ?? [];
      const materials = session.materials ?? [];
      if (!videos.length && !materials.length) continue;
      const group = session.lecture_id ?? session.lecture;
      if (!courses.has(group)) courses.set(group,{name:session.lecture,rows:[]});
      courses.get(group).rows.push({session,videos,materials});
    }
    if (!courses.size) section.append(status('공개된 수업 영상이나 자료가 없습니다.'));
    for (const course of courses.values()) {
      const block = element('section',null,'dw-directCard');
      block.append(element('h2',course.name));
      for (const {session,videos,materials} of course.rows) {
        const row = element('section',null,'dw-directSession');
        row.append(element('h3',[Number.isInteger(session.order) && session.order > 0 && !new RegExp('^' + session.order + '\\s*(차시|회차|회)').test(session.title) ? session.order + '회차' : '',session.title].filter(Boolean).join(' · ')),element('p',dateLabel(session.date),'dw-directMeta'));
        for (const video of videos) {
          if (id(video.id) && id(session.id)) row.append(route(video.title + ' · 재생','/student/video/play?video=' + video.id + '&session=' + session.id + '&from=menu'));
          else if (typeof video === 'string' && id(session.id)) row.append(route(video + ' · 수업 영상 보기','/login/dawon?demo=student&view=video&session=' + session.id));
        }
        for (const material of materials) if (id(material.id)) {
          row.append(route(material.title + ' · 자료 보기','/student/community?tab=materials&material=' + material.id + '&from=menu'));
        }
        block.append(row);
      }
      section.append(block);
    }
  }
  if (topic === 'exam') {
    const rows = [...sessions].sort(dateSort).flatMap(s => (s.exams ?? []).map(exam => ({s,exam})));
    if (!rows.length) section.append(status('조회 가능한 테스트가 없습니다.'));
    for (const {s,exam} of rows) {
      const item = element('article',null,'dw-directCard');
      item.append(element('h2',exam.title),element('p',[s.lecture,s.title,dateLabel(s.date)].filter(Boolean).join(' · '),'dw-directMeta'));
      if (exam.result_available === true && id(exam.id)) {
        const score = exam.score == null ? '' : exam.score + (exam.max == null ? '점' : ' / ' + exam.max + '점');
        item.append(route([score,'성적표 보기'].filter(Boolean).join(' · '),'/student/exams/' + exam.id + '/result?from=menu'));
      } else {
        item.append(element('p',exam.attempt_status || '결과 대기','dw-directMeta'));
        if (id(exam.id)) item.append(route('시험 상세 보기','/student/exams/' + exam.id + '?from=menu'));
      }
      section.append(item);
    }
  }
  return true;
}

export const studentMenuCss = `
.dw-direct{display:grid;gap:12px;min-width:0}.dw-direct h2,.dw-direct h3,.dw-direct p{margin:0}.dw-direct h2{font-size:1.15rem}.dw-direct h3{font-size:1rem}.dw-directCard{display:grid;gap:7px;border:1px solid var(--dw-line);border-radius:10px;padding:16px;background:#fff;overflow-wrap:anywhere}.dw-directMeta,.dw-directLesson small{color:var(--dw-muted);font-size:.88rem}.dw-directBody{white-space:pre-wrap;line-height:1.65}.dw-directLink{display:inline-flex;align-items:center;min-height:44px;justify-self:start;color:var(--dw-accent);font-weight:700;text-decoration:underline;text-underline-offset:3px}.dw-directLink:focus-visible{outline:2px solid currentColor;outline-offset:2px}.dw-directSession{display:grid;gap:3px;padding-top:10px;border-top:1px solid var(--dw-line)}.dw-directWeekNav{display:flex;align-items:center;justify-content:space-between;gap:8px}.dw-directWeekNav h2{text-align:center;font-size:1rem}.dw-directWeek{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));list-style:none;margin:0;padding:0;border:1px solid var(--dw-line);border-radius:10px;overflow:hidden}.dw-directWeek>li{padding:10px;min-width:0;overflow-wrap:anywhere}.dw-directWeek>li+li{border-inline-start:1px solid var(--dw-line)}.dw-directWeek h3{margin-bottom:8px}.dw-directWeek h3 small{display:inline-block;margin-left:4px;color:var(--dw-accent)}.dw-directLesson{display:grid;justify-items:start;gap:3px;font-size:.9rem}.dw-directLesson+.dw-directLesson{border-top:1px solid var(--dw-line);padding-top:7px;margin-top:7px}@media(max-width:720px){.dw-directWeek{grid-template-columns:1fr}.dw-directWeek>li{display:grid;grid-template-columns:6.5rem minmax(0,1fr);gap:4px 8px}.dw-directWeek h3{grid-column:1;grid-row:1;margin:0}.dw-directWeek>li>:not(h3){grid-column:2}.dw-directWeek>li+li{border-inline-start:0;border-top:1px solid var(--dw-line)}}
`;
