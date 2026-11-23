import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import {createStaffStatistics} from '../../deploy/dawon/dawon-staff-statistics.mjs';

class Element {
  constructor(tag,text,attrs={}) { this.tag=tag;this.content=text??'';this.attrs=attrs;this.children=[];this.style={}; }
  append(...nodes){ for(const node of nodes){node.parent=this;this.children.push(node);} }
  replaceChildren(...nodes){this.children=[];this.append(...nodes);}
  get isConnected(){return !!this.parent || this.tag==='root';}
  get lastElementChild(){return this.children.at(-1);}
  get textContent(){return this.content+this.children.map(c=>c.textContent).join(' ');}
  set textContent(value){this.content=value;}
  setAttribute(k,v){this.attrs[k]=v;}
  focus(){}
  remove(){if(this.parent)this.parent.children=this.parent.children.filter(n=>n!==this);this.parent=null;}
  find(fn){if(fn(this))return this;for(const child of this.children){const hit=child.find(fn);if(hit)return hit;}}
  querySelector(selector){const match=selector.match(/data-stat-choice="(\w+)"/);return match&&this.find(n=>n.attrs['data-stat-choice']===match[1]);}
}
function fixture({role='teacher',fail=false,rosterCount=2,aggregate=true}={}){
  const root=new Element('root'),calls=[];
  const start='https://example.test/workspace/results?edition=B';
  const location=new URL(start);
  const history={replaceState(_state,_title,url){location.href=url;}};
  const node=(...args)=>new Element(...args);
  const make=vm.runInNewContext('('+createStaffStatistics.toString()+')',{URL,URLSearchParams,AbortController,Intl,location,history,document:{createElementNS:(_,tag)=>node(tag)}});
  const sample={scored_count:2,score_summary:{average:5,highest:10,unscored_count:1,top_reference_percent:30,top_reference_average:80,distribution_counts:[1,0,0,0,1]},trends:[{enrollment_id:3,current_rate:77}]};
  const r=(id,score)=>({enrollment_id:id,lecture_id:1,student_name:'예시 '+id,ranking_score:score,exam_max_score:20,result_status:'DONE',is_provisional:false});
  const api=async(actual,path)=>{
    calls.push(path);assert.equal(actual,role);
    if(fail){fail=false;throw Error('retry');}
    if(path==='students/teacher-alerts/?settings=1')return {lectures:[{id:1,title:'예시 강의'},{id:2,title:'빈 강의'}]};
    if(path==='lectures/sessions/?lecture=2')return [];
    if(path==='lectures/sessions/?lecture=1')return [1,2].map(id=>({id,lecture:1,date:'2020-01-0'+id,title:id+'차시',order:id}));
    if(path==='results/admin/sessions/1/exams/')return [{exam_id:3,title:'이전 시험'}];
    if(path==='results/admin/sessions/2/exams/')return [{exam_id:4,title:'첫 시험'},{exam_id:5,title:'둘째 시험'}];
    if(/^results\/admin\/exams\/[345]\/analysis-insights\/\?lecture_id=1$/.test(path))return {...sample,scored_count:rosterCount};
    if(/^results\/admin\/exams\/[345]\/results\/\?lecture_id=1$/.test(path))return {results:[r(1,0)],next:'/?page=2'};
    if(/^results\/admin\/exams\/[345]\/results\/\?lecture_id=1&page=2$/.test(path))return {results:[r(2,10),{...r(3,null),result_status:'PENDING'}],next:null};
    if(path==='results/admin/exams/5/questions/?lecture_id=1')return aggregate?[{question_id:20,question_number:1,attempts:3,correct:2}]:[];
    if(path==='exams/5/questions/')return [{id:20,number:1,region_meta:{topic:'예시 주제'}}];
    if(path==='results/admin/exams/5/enrollments/1/?lecture_id=1')return {enrollment_id:1,target_id:5,items:[{question_id:20,is_correct:false}]};
    if(path==='results/admin/exams/5/enrollments/2/?lecture_id=1')return {enrollment_id:2,target_id:5,items:[{question_id:20,is_correct:true}]};
    throw Error('unexpected route '+path);
  };
  const ui=make({root,role,api,node});
  const choice=k=>root.querySelector('[data-stat-choice="'+k+'"]');
  const choose=async(k,v)=>{const sel=choice(k);sel.value=v;await sel.onchange();};
  const show=async q=>{location.href=start+(q?'&'+q:'');await ui.show(location);};
  return {root,calls,location,show,choose,choice,ui};
}
for(const role of ['teacher','admin'])test(role+' scoped report, persisted selection, multi-exam trend, question rates, and zero',async()=>{
  const f=fixture({role});await f.show();assert.equal(f.choice('statsSession').value,'2');
  await f.choose('statsExam','5');await f.choose('statsStudent','1');
  for(const [key,value] of Object.entries({edition:'B',statsCourse:'1',statsSession:'2',statsExam:'5',statsStudent:'1'}))assert.equal(f.location.searchParams.get(key),value);
  assert.match(f.root.textContent,/원점수\s*0점/);assert.match(f.root.textContent,/강의 내 백분위\s*50/);assert.match(f.root.textContent,/상위 집단 평균 대비\s*0%/);
  const trend=f.root.find(n=>n.tag==='details'&&n.textContent.includes('최대 10회'));trend.open=true;await trend.ontoggle();
  assert.match(trend.textContent,/이전 시험.*25% 0%.*첫 시험.*25% 0%.*둘째 시험.*25% 0%/);assert.ok(trend.find(n=>n.tag==='svg'));
  const q=f.root.find(n=>n.tag==='details'&&n.textContent.includes('문항별'));q.open=true;await q.ontoggle();
  assert.match(q.textContent,/예시 주제.*66.7%.*오답/);assert.ok(f.calls.some(path=>path.endsWith('page=2')));
  const toggle=f.root.find(n=>n.attrs['data-stat-native']==='');toggle.onclick();assert.equal(toggle.attrs['aria-expanded'],'false');toggle.onclick();assert.equal(toggle.attrs['aria-expanded'],'true');
  await f.choose('statsStudent','3');assert.match(f.root.textContent,/확정된 점수가 없습니다/);assert.match(f.root.textContent,/시험 결과 원점수\s*— 득점률\s*— 강의 내 백분위\s*— 상위 집단 평균 대비\s*—/);
  await f.show('statsCourse=2');assert.match(f.root.textContent,/등록된 차시가 없습니다/);
  await f.ui.show(new URL('https://example.test/workspace/dashboard'));assert.equal(f.root.children.length,0);
});
test('unknown scope never queries an unlisted course; retry and reset recover',async()=>{
  const f=fixture({fail:true});await f.show('statsCourse=77');assert.match(f.root.textContent,/불러오지 못/);
  await f.root.find(n=>n.tag==='button'&&n.textContent==='다시 시도').onclick();
  assert.match(f.root.textContent,/현재 범위에서 조회할 수 없습니다/);assert.ok(!f.calls.some(p=>p.includes('77')));
  await f.root.find(n=>n.tag==='button'&&n.textContent==='강의 다시 선택').onclick();assert.ok(f.choice('statsExam'));
  await f.show('statsCourse=1&statsStudent=98');assert.match(f.root.textContent,/학생 기록을 현재 범위/);assert.ok(!f.calls.some(p=>p.includes('98')));
});
test('inconsistent cohort cannot display a guessed percentile',async()=>{
  const f=fixture({rosterCount:3});await f.show('statsStudent=1');assert.match(f.root.textContent,/강의 내 백분위\s*—/);
});

test('empty aggregate derives item-level rates from all confirmed students in the selected class only',async()=>{
  const f=fixture({aggregate:false});await f.show('statsExam=5&statsStudent=1');
  const q=f.root.find(n=>n.tag==='details'&&n.textContent.includes('문항별'));q.open=true;await q.ontoggle();
  assert.match(q.textContent,/50% \(1\/2\).*오답/);assert.equal(f.calls.filter(p=>p.includes('enrollments/1/')).length,1);
  assert.ok(!f.calls.some(p=>p.includes('enrollments/3/')));
});
