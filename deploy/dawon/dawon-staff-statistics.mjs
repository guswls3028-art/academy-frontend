export const staffStatisticsStyle = `
[data-staff-statistics]{grid-column:1/-1;min-width:0;background:white;border:1px solid var(--ed-line,#c8d3d7);border-radius:8px;padding:16px 18px;margin:12px 0;color:var(--ed-ink,#24343c)}
[data-staff-statistics] h2,[data-staff-statistics] h3{margin:0 0 8px;font-weight:700;line-height:1.35}
[data-staff-statistics] h2{font-size:19px}[data-staff-statistics] h3{font-size:15px}
[data-staff-statistics] p{margin:6px 0;font-size:13px;line-height:1.5}
.dsx-head{display:flex;align-items:center;justify-content:space-between;gap:8px}.dsx-head button,[data-staff-statistics] button{cursor:pointer;color:inherit;border:1px solid var(--ed-line);border-radius:4px;background:white;min-height:36px;padding:5px 10px;font:inherit;font-size:13px}.dsx-main[hidden]{display:none}
.dsx-filters{display:flex;gap:8px 14px;flex-wrap:wrap;margin:12px 0}
.dsx-filters label{display:grid;gap:3px;min-width:0;flex:1 1 142px;font-size:12px;font-weight:650}
[data-staff-statistics] select{max-width:100%;min-width:0;width:100%;border:1px solid var(--ed-line);background:white;color:inherit;border-radius:4px;padding:6px 8px;font:inherit;font-size:14px;min-height:36px}
.dsx-metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(102px,1fr));gap:10px;margin:12px 0;padding:12px 0;border-block:1px solid var(--ed-line)}
.dsx-metrics div{min-width:0}.dsx-metrics dt{font-size:12px;color:#4e5b60}.dsx-metrics dd{margin:3px 0;font-size:18px;font-weight:700;font-variant-numeric:tabular-nums}
.dsx-exam-title{padding-top:7px;word-break:keep-all;overflow-wrap:anywhere}
.dsx-bars{list-style:none;margin:7px 0 10px;padding:0;display:grid;gap:6px}
.dsx-bars li{display:grid;grid-template-columns:8em minmax(10px,1fr) 4em;gap:8px;align-items:center;font-size:13px}
.dsx-track{display:block;height:8px;background:#e9eeef;border-radius:4px;overflow:hidden}.dsx-track i{display:block;height:100%;background:var(--ed-accent,#387180)}
[data-staff-statistics] details{margin-top:9px;border-top:1px solid var(--ed-line);padding-top:5px}
[data-staff-statistics] summary{cursor:pointer;width:fit-content;font-weight:650;font-size:14px;padding:8px 0}
.dsx-table{width:100%;border-collapse:collapse;font:inherit;font-size:13px;line-height:1.4}
.dsx-table th,.dsx-table td{text-align:left;vertical-align:top;padding:7px 5px;border-bottom:1px solid var(--ed-line);overflow-wrap:anywhere}
.dsx-table thead{background:var(--ed-tint,#edf3f3)}.dsx-table caption{text-align:left;padding:6px 0;font-weight:650}
.dsx-chart{display:block;width:100%;height:148px;margin:6px 0}.dsx-axis{stroke:#c4ced1;stroke-width:1}.dsx-avg{stroke:#64777f;fill:#64777f}.dsx-own{stroke:var(--ed-accent,#2d6683);fill:var(--ed-accent,#2d6683)}
.dsx-chart line:not(.dsx-axis){stroke-width:3}.dsx-avg:not(circle){stroke-dasharray:6 4}.dsx-chart text{font:12px sans-serif;fill:#4e5b60}
@media(max-width:700px){
[data-staff-statistics]{padding:12px;margin:8px 0}.dsx-filters{gap:5px 8px}.dsx-filters label{flex-basis:42%}[data-staff-statistics] select,[data-staff-statistics] button,[data-staff-statistics] summary{min-height:44px}[data-staff-statistics] summary{align-content:center}
.dsx-metrics{grid-template-columns:repeat(3,minmax(0,1fr))}.dsx-metrics dd{font-size:16px}
.dsx-metrics div:last-child:nth-child(5),.dsx-metrics div:last-child:nth-child(4){grid-column:span 2}.dsx-metrics dt{word-break:keep-all}
main:has([data-staff-statistics]) [aria-label="반별 시험 목록"]{max-width:100%;overflow-x:auto}
main:has([data-staff-statistics]) [aria-label="반별 시험 목록"] table,main:has([data-staff-statistics]) table[aria-label="반별 시험 목록"]{min-width:550px}
main:has([data-staff-statistics]) [aria-label="반별 시험 목록"] tr>:first-child{min-width:150px;word-break:keep-all}
main:has([data-staff-statistics]) [data-testid="results-performance-console"]>section[aria-labelledby="performance-console-title"]{padding:12px;gap:8px;min-height:0}
main:has([data-staff-statistics]) #performance-console-title{font-size:18px;margin:0}
}`;

export function createStaffStatistics({root,role,api,node}) {
  const id=value=>Number.isSafeInteger(Number(value)) && Number(value)>0;
  const numeric=value=>typeof value==='number' && Number.isFinite(value);
  const fmt=(value,unit='')=>numeric(value)?new Intl.NumberFormat('ko-KR',{maximumFractionDigits:1}).format(value)+unit:'—';
  const params=['statsCourse','statsSession','statsExam','statsStudent'];
  const bands=['0–20%','20% 초과–40%','40% 초과–60%','60% 초과–80%','80% 초과–100%'];
  const cache=new Map();
  let section,flow,trendFlow,signature,stage,choices,studentRows,summary,seriesRows,seriesView;
  let filters,body,studentPanel,trend,questionBox,questionRevision=0,collapsed=false;
  function clear() {
    flow?.abort(); trendFlow?.abort(); section?.remove(); section=null; signature=null; cache.clear();
    seriesRows=null; seriesView=null; stage=null; collapsed=false;
  }
  const full=(path,course)=>path+'?lecture_id='+course;
  async function get(path,signal) {
    if (cache.has(path)) return cache.get(path);
    const data=await api(role,path,signal);
    if (signal.aborted) throw new Error('cancelled');
    cache.set(path,data); return data;
  }
  // Follow the server's next page number on the same authorized endpoint.
  async function rows(path,signal) {
    const all=[],pages=new Set(); let current=path;
    while(current){
      if(pages.has(current)) throw Error('pagination');
      pages.add(current);const data=await get(current,signal);
      if(Array.isArray(data))return [...all,...data];
      if(!Array.isArray(data?.results))throw Error('list');
      all.push(...data.results);current=null;
      if(data.next){
        const page=new URL(data.next,location.origin).searchParams.get('page');
        if(!id(page))throw Error('pagination');
        current=path+(path.includes('?')?'&':'?')+'page='+page;
      }
    }
    return all;
  }
  const examsOf=(session,signal)=>rows('results/admin/sessions/'+session.id+'/exams/',signal);
  async function latestExamSession(sessions,signal){
    const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul'}).format();
    const past=sessions.filter(s=>s.date&&s.date<=today).reverse();
    const future=sessions.filter(s=>s.date>today);
    const groups=[past,future,sessions.filter(s=>!s.date)];
    // Usually one request. Only inspect scheduled exams when no dated past exam was found.
    for(const group of groups){
      for(let i=0;i<group.length;){
        const batch=group.slice(i,i+(i?3:1));
        const links=await Promise.all(batch.map(s=>examsOf(s,signal)));
        if(signal.aborted)throw Error('cancelled');
        const found=links.findIndex(exams=>exams.some(e=>id(e.exam_id)));
        if(found>=0)return batch[found];
        i+=batch.length;
      }
    }
    return past[0]||future[0]||sessions[0];
  }
  function note(text,kind='status'){return node('p',text,{role:kind});}
  function retry(target,text,action){
    const button=node('button','다시 시도',{type:'button'});button.onclick=action;
    target.replaceChildren(note(text,'alert'),button);
  }
  function setChoice(level,value){
    const url=new URL(location.href);
    for(const key of params.slice(0,level)){
      const parent=filters.querySelector('[data-stat-choice="'+key+'"]')?.value;
      if(parent)url.searchParams.set(key,parent);
    }
    for(const key of params.slice(level)) url.searchParams.delete(key);
    if(value)url.searchParams.set(params[level],value);
    history.replaceState(history.state,'',url.href); return show(url);
  }
  function pick(label,opts,selected,level){
    const wrapper=node('label',label),select=node('select',null,{'aria-label':label,'data-stat-choice':params[level]});
    for(const item of opts)select.append(node('option',item.title,{value:String(item.id)}));
    select.value=String(selected);select.onchange=()=>setChoice(level,select.value);
    wrapper.append(select);filters.append(wrapper);
  }
  function valueFrom(list,key,otherwise){
    const value=choices.get(key);
    if(!value)return otherwise;
    return list.find(row=>String(row.id)===value);
  }
  function missing(level,label){
    const reset=node('button',label+' 다시 선택',{type:'button'});
    reset.onclick=()=>setChoice(level,'');
    body.replaceChildren(note('이 '+label+' 기록을 현재 범위에서 조회할 수 없습니다.','alert'),reset);
  }
  function metric(items){
    const dl=node('dl',null,{class:'dsx-metrics'});
    for(const [label,value] of items){const part=node('div');part.append(node('dt',label),node('dd',value));dl.append(part);}
    return dl;
  }
  function table(caption,headers,values){
    const t=node('table',null,{class:'dsx-table'}),head=node('thead'),tr=node('tr'),body=node('tbody');
    t.append(node('caption',caption));for(const label of headers)tr.append(node('th',label,{scope:'col'}));head.append(tr);
    for(const row of values){const r=node('tr');row.forEach((value,index)=>r.append(index?node('td',value):node('th',value,{scope:'row'})));body.append(r);}
    t.append(head,body);return t;
  }
  function bars(summary){
    const list=node('ul',null,{class:'dsx-bars','aria-label':'득점률 구간별 인원'});
    const max=Math.max(1,...summary.distribution_counts);
    summary.distribution_counts.forEach((n,i)=>{
      const li=node('li'),track=node('span',null,{class:'dsx-track','aria-hidden':'true'}),fill=node('i');
      fill.style.width=(100*n/max)+'%';track.append(fill);li.append(node('span',bands[i]),track,node('strong',n+'명'));list.append(li);
    });return list;
  }
  function checkedAnalysis(data){
    const s=data?.score_summary;
    if(!s || !Array.isArray(s.distribution_counts) || s.distribution_counts.length!==5 ||
       s.distribution_counts.some(n=>!Number.isInteger(n)||n<0)||!Number.isInteger(data.scored_count))throw Error('analysis');
    return data;
  }
  const analysis=(course,exam,signal)=>get(full('results/admin/exams/'+exam+'/analysis-insights/',course),signal).then(checkedAnalysis);
  const complete=row=>row && row.result_status==='DONE' && !row.is_provisional && numeric(row.ranking_score);
  function rate(row){
    return complete(row)&&numeric(row.exam_max_score)&&row.exam_max_score>0
      ?Math.min(100,Math.max(0,row.ranking_score/row.exam_max_score*100)):null;
  }
  async function rosterFor(course,exam,signal){
    const roster=await rows(full('results/admin/exams/'+exam+'/results/',course),signal);
    return roster.filter(r=>r.lecture_id===course&&id(r.enrollment_id));
  }
  function drawChart(points,owner){
    const svg=(tag,attrs)=>{const e=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [k,v] of Object.entries(attrs))e.setAttribute(k,v);return e;};
    const chart=svg('svg',{class:'dsx-chart',viewBox:'0 0 400 148','aria-hidden':'true'});
    const y=n=>115-Number(n),x=i=>points.length===1?211:38+338*i/(points.length-1);
    for(const n of [0,50,100]){chart.append(svg('line',{x1:35,y1:y(n),x2:383,y2:y(n),class:'dsx-axis'}));const text=svg('text',{x:1,y:y(n)+4});text.textContent=n+'%';chart.append(text);}
    for(const k of owner?['avg','own']:['avg']){
      let last=null;points.forEach((p,i)=>{if(!numeric(p[k])){last=null;return;}const cx=x(i),cy=y(p[k]),cl='dsx-'+k;
        if(last)chart.append(svg('line',{x1:last[0],y1:last[1],x2:cx,y2:cy,class:cl}));
        chart.append(svg('circle',{cx,cy,r:4,class:cl}));last=[cx,cy];});
    }
    points.forEach((_,i)=>{const t=svg('text',{x:x(i),y:137,'text-anchor':'middle'});t.textContent=String(i+1);chart.append(t);});
    return chart;
  }
  function activeStudent(){return studentRows?.find(r=>String(r.enrollment_id)===choices.get('statsStudent'));}
  function drawTrend(){
    const owner=activeStudent();
    const points=seriesRows.map(({row,roster})=>{
      const graded=roster.filter(complete),rates=graded.map(rate);
      const avg=rates.length&&rates.every(numeric)?rates.reduce((sum,n)=>sum+n,0)/rates.length:null;
      const own=owner?rate(roster.find(r=>r.enrollment_id===owner.enrollment_id)):null;
      return {title:row.title,avg,own};
    });
    const heads=['순서 · 시험','강의 평균 득점률'];if(owner)heads.push(owner.student_name+' 득점률');
    const data=points.map((p,i)=>[(i+1)+'. '+p.title,fmt(p.avg,'%'),...(owner?[fmt(p.own,'%')]:[])]);
    seriesView.replaceChildren(node('p','선택한 강의의 전체 시험을 시행 순서로 비교합니다. 시험마다 유형과 난이도가 다를 수 있습니다.'),node('p',owner?'점선은 강의 평균, 실선은 선택한 학생의 득점률입니다.':'점선은 각 시험에서 채점된 학생의 평균 득점률입니다.'));
    if(points.some(p=>numeric(p.avg)||numeric(p.own)))seriesView.append(drawChart(points,owner));
    seriesView.append(table('시행 순서별 비교',heads,data));
  }
  async function loadTrend(){
    if(!trend.open)return;
    if(seriesRows){drawTrend();return;}
    trendFlow?.abort();const request=trendFlow=new AbortController(),signal=request.signal,local=stage;
    seriesView.replaceChildren(note('차시별 비교 기록을 불러오는 중…'));
    try{
      let found=[];const seen=new Set();
      // Work backwards only on demand, stopping after ten distinct linked exams.
      const available=local.sessions.slice(0,local.sessions.findIndex(s=>s.id===local.session.id)+1).reverse();
      for(const session of available){
        const exams=await examsOf(session,signal);
        const until=session.id===local.session.id?exams.findIndex(e=>e.exam_id===local.exam.id):exams.length-1;
        for(const e of exams.slice(0,until+1).reverse()){
          if(!id(e.exam_id)||seen.has(e.exam_id))continue;
          seen.add(e.exam_id);found.push({id:e.exam_id,title:[session.date,e.title].filter(Boolean).join(' · ')});
          if(found.length===10) break;
        }
        if(found.length===10)break;
      }
      found=found.reverse();const result=[];
      for(let i=0;i<found.length;i+=3)result.push(...await Promise.all(found.slice(i,i+3).map(async row=>({row,roster:await rosterFor(local.course.id,row.id,signal)}))));
      if(signal.aborted)return;seriesRows=result;drawTrend();
    }catch{if(!signal.aborted)retry(seriesView,'차시별 기록을 불러오지 못했습니다.',loadTrend);}
  }
  async function questionMarks(course,exam,enrollment,signal){
    const path=full('results/admin/exams/'+exam+'/enrollments/'+enrollment+'/',course),key='marks:'+path;
    if(cache.has(key))return cache.get(key);
    const reading=api(role,path,signal).then(detail=>{
      if(signal.aborted||detail?.enrollment_id!==enrollment||detail?.target_id!==exam||!Array.isArray(detail.items))throw Error('question scope');
      return detail.is_provisional?[]:detail.items.filter(q=>id(q.question_id)).map(q=>({
        question_id:q.question_id,question_number:q.question_number,is_correct:q.is_correct
      }));
    });
    cache.set(key,reading);
    try{return await reading;}catch(error){if(cache.get(key)===reading)cache.delete(key);throw error;}
  }
  async function aggregateMarks(course,exam,members,signal){
    const counts=new Map();
    for(let i=0;i<members.length;i+=3){
      if(signal.aborted)throw Error('cancelled');
      const group=await Promise.all(members.slice(i,i+3).map(r=>questionMarks(course,exam,r.enrollment_id,signal)));
      for(const items of group){
        for(const q of new Map(items.map(q=>[q.question_id,q])).values()){
          if(typeof q.is_correct!=='boolean')continue;
          const total=counts.get(q.question_id)||{question_id:q.question_id,question_number:q.question_number,attempts:0,correct:0};
          total.attempts++;if(q.is_correct)total.correct++;counts.set(q.question_id,total);
        }
      }
    }
    return [...counts.values()];
  }
  async function drawQuestions(){
    if(!questionBox.open)return;
    const target=questionBox.lastElementChild,owner=activeStudent(),signal=flow.signal,revision=++questionRevision;
    const current=()=>!signal.aborted&&revision===questionRevision;
    target.replaceChildren(note('문항 기록을 불러오는 중…'));
    try{
      const exam=stage.exam.id,course=stage.course.id;
      const [statsResult,structureResult,detailResult]=await Promise.allSettled([
        rows(full('results/admin/exams/'+exam+'/questions/',course),signal),
        rows('exams/'+exam+'/questions/',signal),
        owner&&complete(owner)?questionMarks(course,exam,owner.enrollment_id,signal):[]
      ]);
      if(!current())return;
      if(statsResult.status==='rejected')throw Error('question statistics');
      let stats=statsResult.value;
      const structure=structureResult.status==='fulfilled'?structureResult.value:[],marks=detailResult.status==='fulfilled'?detailResult.value:[];
      const graded=studentRows.filter(complete);
      if(!stats.length&&graded.length){
        target.replaceChildren(note('강의의 채점 완료 학생 '+graded.length+'명에 대한 문항 정오를 집계하는 중…'));
        stats=await aggregateMarks(course,exam,graded,signal);
      }
      if(!current())return;
      const byId=new Map(structure.map(q=>[q.id,q])),byStat=new Map(stats.map(q=>[q.question_id,q])),answers=new Map(marks.map(q=>[q.question_id,q]));
      const ids=[...new Set([...byId.keys(),...byStat.keys(),...answers.keys()])];
      const values=ids.map(id=>{const q=byId.get(id),s=byStat.get(id),a=answers.get(id);return {number:q?.number??s?.question_number??a?.question_number,topic:q?.region_meta?.topic||'—',
        accuracy:s?.attempts>0&&numeric(s.correct)?fmt(s.correct/s.attempts*100,'%')+' ('+s.correct+'/'+s.attempts+')':'—',mark:a?.is_correct===true?'정답':a?.is_correct===false?'오답':'—'};}).sort((a,b)=>a.number-b.number);
      target.replaceChildren(...(values.length?[table('문항별 채점 기록',['문항','주제','정답률',...(owner?['학생 결과']:[])],values.map(q=>[fmt(q.number,'번'),q.topic,q.accuracy,...(owner?[q.mark]:[])]))]:[note('등록된 문항별 기록이 없습니다.')]));
      if(values.length)target.append(node('p','정답률은 이 강의의 채점 기록 중 문항별 정답 수를 정오가 확정된 답안 수로 나눈 비율입니다.'));
      if(structureResult.status==='rejected'||detailResult.status==='rejected'){
        const partial=node('div');retry(partial,'일부 문항의 주제 또는 학생 결과를 불러오지 못했습니다.',drawQuestions);target.append(partial);
      }
    }catch{if(current())retry(target,'문항 기록을 불러오지 못했습니다.',drawQuestions);}
  }
  function detail(label){
    const box=node('details');box.append(node('summary',label),node('div'));return box;
  }
  function statusOf(row){
    if(complete(row))return 'done';
    if(row.result_status==='ABSENT'||row.result_status==='NOT_SUBMITTED')return 'absent';
    if(row.result_status==='FAILED')return 'failed';
    if(row.is_provisional||['PARTIAL','PROCESSING','PENDING'].includes(row.result_status))return 'pending';
    return 'unknown';
  }
  function unconfirmedText(){
    const counts={absent:0,pending:0,failed:0},total=summary.data.score_summary.unscored_count;
    if(!Number.isInteger(total)||total<=0)return '';
    for(const row of studentRows){const status=statusOf(row);if(Object.hasOwn(counts,status))counts[status]++;}
    const known=counts.absent+counts.pending+counts.failed;
    if(known>total)return '상세 상태를 확인할 수 없습니다.';
    const labels=[['미응시·미제출',counts.absent],['채점 대기·진행',counts.pending],['처리 실패',counts.failed],['상태 미확인',total-known]];
    return labels.filter(([,n])=>n>0).map(([label,n])=>label+' '+n+'명').join(' · ');
  }
  function renderStudent(){
    studentPanel.replaceChildren();
    const {data}=summary,s=data.score_summary,owner=activeStudent();
    if(owner){
      const confirmed=complete(owner),score=confirmed?owner.ranking_score:null;
      const ownRate=rate(owner);
      const cohort=studentRows.filter(complete);
      const percentile=confirmed && cohort.length===data.scored_count && cohort.length?100*cohort.filter(r=>r.ranking_score<=score).length/cohort.length:null;
      const ref=numeric(ownRate)&&numeric(s.top_reference_average)&&s.top_reference_average>0?100*ownRate/s.top_reference_average:null;
      studentPanel.append(node('h3',owner.student_name+' · 시험 결과'),metric([['원점수',fmt(score,'점')],['득점률',fmt(ownRate,'%')],['강의 내 백분위',fmt(percentile)],['상위 집단 평균 대비',fmt(ref,'%')]]));
      if(!confirmed)studentPanel.append(note(statusOf(owner)==='absent'?'미응시·미제출 기록입니다.':statusOf(owner)==='failed'?'채점 처리에 실패했습니다. 기본 성적 업무에서 기록을 확인하세요.':'확정된 점수가 없습니다.'));
      else studentPanel.append(node('p','백분위는 같은 강의 응시생 중 이 원점수 이하인 학생의 비율입니다. 상위 집단 평균 대비는 학생 득점률을 상위 집단 평균 득점률로 나눈 값입니다.'));
    }
  }
  function renderResults(){
    const {data}=summary,s=data.score_summary;
    body.replaceChildren(node('h3',stage.exam.title,{class:'dsx-exam-title'}),metric([['채점 완료',fmt(data.scored_count,'명')],['점수 미확정',fmt(s.unscored_count,'명')],['평균 원점수',fmt(s.average,'점')],['최고 원점수',fmt(s.highest,'점')],
      [numeric(s.top_reference_percent)?'상위 '+fmt(s.top_reference_percent,'%')+' 평균 득점률':'상위 집단 평균 득점률',fmt(s.top_reference_average,'%')]]));
    const status=unconfirmedText();if(status)body.append(node('p',status));
    if(data.scored_count)body.append(node('h3','득점률 분포'),bars(s));
    else body.append(note('아직 채점 완료된 결과가 없습니다.'));
    studentPanel=node('div');body.append(studentPanel);renderStudent();
    trend=detail('최근 시험 득점률 추이 · 최대 10회');seriesView=trend.lastElementChild;trend.ontoggle=loadTrend;
    questionBox=detail('문항별 정답률과 주제');questionBox.ontoggle=drawQuestions;body.append(trend,questionBox);
  }
  async function show(url){
    if(url.pathname!=='/workspace/results'||url.searchParams.has('panel')){clear();return;}
    const signatureNow=JSON.stringify(params.map(k=>url.searchParams.get(k)));
    if(signature===signatureNow && section?.isConnected)return;
    const next=new URLSearchParams(url.search);
    const selected=next.get('statsStudent');
    const scope=stage&&[stage.course,stage.session,stage.exam];
    if(scope&&scope.every((entry,i)=>next.get(params[i])===String(entry.id)||next.get(params[i])===choices.get(params[i]))&&
      (!selected||studentRows.some(r=>String(r.enrollment_id)===selected))){
      choices=next;signature=signatureNow;
      filters.querySelector('[data-stat-choice="statsStudent"]').value=selected||'';
      renderStudent();
      if(trend.open&&seriesRows)drawTrend();
      if(questionBox.open)await drawQuestions();
      return;
    }
    signature=signatureNow;flow?.abort();trendFlow?.abort();const request=flow=new AbortController(),signal=request.signal;
    choices=next;seriesRows=null;studentRows=null;stage=null;
    const focused=document.activeElement?.dataset?.statChoice;
    if(!section){section=node('section',null,{'data-staff-statistics':'','aria-label':'시험 성적 통계'});root.append(section);}
    const head=node('div',null,{class:'dsx-head'}),main=node('div',null,{class:'dsx-main',id:'dawon-statistics-body'});
    const toggle=node('button',null,{type:'button','aria-controls':'dawon-statistics-body','data-stat-native':''});
    function display(){
      main.hidden=collapsed;toggle.textContent=collapsed?'시험 통계 열기':'기본 성적 업무 보기';
      toggle.setAttribute('aria-expanded',String(!collapsed));
    }
    toggle.onclick=()=>{collapsed=!collapsed;display();};
    display();head.append(node('h2','시험 성적 통계'),toggle);
    filters=node('div',null,{class:'dsx-filters'});body=node('div');main.append(filters,body);section.replaceChildren(head,main);
    body.append(note('성적 기록을 불러오는 중…'));
    try{
      const feed=await get('students/teacher-alerts/?settings=1',signal);if(signal.aborted)return;
      if(!Array.isArray(feed?.lectures))throw Error('courses');
      const courses=feed.lectures.filter(c=>id(c.id)&&c.title);
      if(!courses.length){body.replaceChildren(note('조회할 수 있는 강의가 없습니다.'));return;}
      const course=valueFrom(courses,'statsCourse',courses[0]);if(!course){missing(0,'강의');return;}pick('강의',courses,course.id,0);
      const sessions=(await rows('lectures/sessions/?lecture='+course.id,signal)).filter(s=>s.lecture===course.id && id(s.id)).sort((a,b)=>String(a.date||'').localeCompare(String(b.date||'')) || a.order-b.order || a.id-b.id);
      if(signal.aborted)return;
      if(!sessions.length){body.replaceChildren(note('등록된 차시가 없습니다.'));return;}
      const session=choices.has('statsSession')?valueFrom(sessions,'statsSession'):await latestExamSession(sessions,signal);
      if(signal.aborted)return;
      if(!session){missing(1,'차시');return;}
      pick('차시',sessions.map(s=>({id:s.id,title:[s.date,s.display_label||s.title].filter(Boolean).join(' · ')})),session.id,1);
      const links=await examsOf(session,signal);if(signal.aborted)return;
      const exams=links.filter(e=>id(e.exam_id)).map(e=>({id:e.exam_id,title:e.title}));
      if(!exams.length){body.replaceChildren(note('이 차시에 연결된 시험이 없습니다.'));return;}
      const exam=valueFrom(exams,'statsExam',exams[0]);if(!exam){missing(2,'시험');return;}pick('시험',exams,exam.id,2);
      const [data,roster]=await Promise.all([analysis(course.id,exam.id,signal),rosterFor(course.id,exam.id,signal)]);
      if(signal.aborted)return;
      studentRows=roster;
      pick('학생', [{id:'',title:'강의 전체'},...studentRows.map(r=>({id:r.enrollment_id,title:r.student_name}))],activeStudent()?.enrollment_id||'',3);
      if(choices.get('statsStudent')&&!activeStudent()){missing(3,'학생');return;}
      stage={course,session,exam,sessions};summary={data};renderResults();
    }catch{if(!signal.aborted)retry(body,'성적 통계를 불러오지 못했습니다.',()=>{cache.clear();signature=null;return show(new URL(location.href));});}
    finally{if(!signal.aborted && focused)filters.querySelector('[data-stat-choice="'+focused+'"]')?.focus({preventScroll:true});}
  }
  return {show,clear};
}
