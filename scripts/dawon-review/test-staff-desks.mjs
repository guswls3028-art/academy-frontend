import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createTaskPicker} from '../../deploy/dawon/dawon-task-picker.mjs';
import {renderDawonLearner} from '../../deploy/dawon/dawon-learner-sessions.mjs';

const origin = 'https://demo.hakwonplus.com';
function node(tag,text,attrs={}) {
  return {tag,text,attrs,children:[],append(...children){this.children.push(...children);},
    replaceChildren(...children){this.children=children;},remove(){this.removed=true;}};
}
function all(root) { return [root,...root.children.flatMap(all)]; }
function setup(fetch) {
  const root=node('main'),requests=[];
  const api=async(role,path,signal)=>{requests.push({role,path,signal});return fetch(path);};
  const picker=createTaskPicker({role:'teacher',root,node,api,urlOf:path=>'/workspace/'+path,navigate(){},canLeave:()=>true});
  return {root,requests,picker,show:query=>picker.show(new URL('/workspace/lectures?'+query,origin))};
}
test('both session jobs open only a selected, assigned lecture and matching session',async()=>{
  for (const work of ['attendance','assignments']) {
    const {root,requests,show}=setup(path=>path.startsWith('students/')?{lectures:[{id:7,title:'수학'}]}:
      [{id:11,lecture:7,title:'함수의 극한',display_label:'함수의 극한',order:1},{id:999,lecture:8,title:'다른 강의'}]);
    await show('work='+work+'&course=8');
    assert.equal(requests.length,1);
    await show('work='+work+'&course=7');
    assert.deepEqual(requests.map(it=>it.path),['students/teacher-alerts/?settings=1','lectures/sessions/?lecture=7']);
    assert.ok(requests.every(it=>it.role==='teacher'));
    const urls=all(root.children.at(-1)).filter(el=>el.tag==='a').map(el=>el.attrs.href);
    assert.deepEqual(urls,['/workspace/lectures','/workspace/lectures/7/sessions/11/'+work]);
    const labels=all(root.children.at(-1)).map(el=>el.text);
    assert.ok(labels.includes('1회차'));
    assert.equal(labels.filter(text=>text==='함수의 극한').length,1);
  }
});
test('an interrupted request cannot replace a new selection and a failed read can retry',async()=>{
  let finish,failed=true;
  const {root,requests,show}=setup(path=>{
    if(path.startsWith('students/')) return {lectures:[{id:7,title:'수학'},{id:8,title:'미적분'}]};
    if(path.endsWith('=7')) return new Promise(resolve=>{finish=resolve;});
    if(failed){failed=false;throw Error('offline');}
    return [];
  });
  const old=show('work=attendance&course=7');
  while(!finish) await new Promise(r=>setImmediate(r));
  await show('work=assignments&course=8');
  finish([{id:6,lecture:7,title:'이전 차시'}]); await old;
  assert.equal(requests[1].signal.aborted,true);
  const button=all(root.children.at(-1)).find(el=>el.text==='다시 시도');
  assert.ok(button);button.onclick();await new Promise(r=>setImmediate(r));
  assert.ok(all(root.children.at(-1)).some(el=>el.text==='이 강의에 등록된 차시가 없습니다.'));
});
test('both role home pages contain a calendar; guardian return uses the selected day and role',()=>{
  for (const role of ['student','guardian']) {
    const html=renderDawonLearner(new URL('/?preview='+role,origin));
    assert.match(html,/id="dw-home-calendar"/);
  }
  const record=renderDawonLearner(new URL('/learn/attendance?preview=guardian&view=day&date=2026-11-19&from=home',origin));
  assert.match(record,/href="\/\?preview=guardian&amp;view=month&amp;date=2026-11-19#dw-home-calendar"/);
});

test('both family roles see the identical customer-supplied lesson sequence independently of enrolled sessions',() => {
  const rows=role=>{
    const html=renderDawonLearner(new URL('/learn/curriculum?preview='+role,origin));
    const table=html.match(/<section[^>]+data-customer-progress>([\s\S]*?)<\/section>/)[1];
    return [...table.matchAll(/<th scope="row">(\d+)회차<\/th><td>([^<]+)<\/td>/g)].map(m=>[Number(m[1]),m[2]]);
  };
  const student=rows('student');
  assert.deepEqual(rows('guardian'),student);
  assert.deepEqual(student.map(row=>row[0]),Array.from({length:14},(_,i)=>i+1));
  assert.match(student[4][1],/극심화 문제 풀이 1차$/);
  assert.match(student[8][1],/극심화 문제 풀이 2차$/);
  assert.equal(student[13][1],'12 위치와 속도');
});
