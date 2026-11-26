import assert from 'node:assert/strict';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import { editionResponse, installStaffReturn, legacyEditionRedirect, staffReturnPath } from '../../deploy/dawon/dawon-editions.mjs';
import { insertDemoSwitcher } from '../../deploy/dawon/dawon-demo-header.mjs';

const origin = 'https://demo.hakwonplus.com';
const desired = '/workspace/students/home?student=2&scope=class&status=pending#record';
const url = value => new URL(value,origin);

test('retired aliases open their role on the native workspace',() => {
  for (const [path,dest] of [
    ['/teacher?edition=B','/login/dawon?demo=admin'],
    ['/learn/teacher-portal?edition=A','/login/dawon?demo=admin'],
    ['/?preview=admin&edition=C','/login/dawon?demo=admin'],
    ['/admin?edition=C','/login/dawon?demo=admin'],
    ['/learn/schedule?edition=B&preview=guardian','/?preview=guardian'],
    ['/learn/grades?preview=guardian&edition=C','/?preview=guardian'],
    ['/admin?edition=invalid','/login/dawon?demo=admin'],
  ]) assert.equal(legacyEditionRedirect(url(path)).headers.get('location'),url(dest).href);
  assert.equal(legacyEditionRedirect(url('/learn/grades?edition=C')).headers.get('location'),url('/learn/grades').href);
  assert.equal(legacyEditionRedirect(url('/learn/attendance?edition=B&date=2026-11-19&preview=guardian')).headers.get('location'),url('/learn/attendance?date=2026-11-19&preview=guardian').href);
});

test('only permitted staff entrances carry local work and native filters',async () => {
  for (const actor of ['teacher','admin']) {
    assert.equal(staffReturnPath('/workspace/results?statsCourse=7&statsSession=3&statsExam=9&statsStudent=11',actor),'/workspace/results?statsCourse=7&statsSession=3&statsExam=9&statsStudent=11');
    assert.equal(staffReturnPath('/workspace/results?statsCourse=-2&statsExam=no',actor),'/workspace/results');
    assert.equal(staffReturnPath('/workspace/lectures?statsCourse=7',actor),'/workspace/lectures');
  }
  for (const invalid of ['https://example.test','//example.test','/workspace/../login','/workspace/%2e%2e/login','/api/v1/me','/workspace/mobile/students'])
    assert.equal(staffReturnPath(invalid,'teacher'),null);
  assert.equal(staffReturnPath('/workspace/staff?month=2026-11','teacher'),null);
  assert.equal(staffReturnPath('/workspace/teacher-alerts','admin'),null);
  assert.equal(staffReturnPath('/workspace/dashboard?panel=attendance','teacher'),null);
  assert.equal(staffReturnPath('/workspace/students/home?student=2&demo=admin&edition=B&returnTo=elsewhere','teacher'),'/workspace/students/home?student=2');
  for (const role of ['teacher','admin']) assert.equal(staffReturnPath(desired,role),desired);
  const entry=url('/c'); entry.searchParams.set('work','/workspace/staff?month=2026-11');
  const landing = new URL(editionResponse(new Request(entry),entry).headers.get('location'));
  assert.equal(landing.pathname,'/');
  const shell = insertDemoSwitcher('<html><head></head><body></body></html>',landing,false);
  assert.match(shell,/href="\/login\/dawon\?demo=admin&amp;work=/);
  assert.doesNotMatch(shell,/data-demo-app="teacher"/);
  for (const role of ['admin','teacher','guardian','student']) {
    const input=url('/c/'+role); input.searchParams.set('work',desired);
    const dest=new URL(editionResponse(new Request(input),input).headers.get('location'));
    assert.equal(dest.searchParams.get('work'),['admin','teacher'].includes(role) ? desired : null);
  }
});

function tab(path, initialGeneration=null) {
  const location=url(path), events={}, replaced=[];
  let active=initialGeneration, mounted=null, mutated;
  location.replace=next=>replaced.push(new URL(next,location).href);
  const history={
    replaceState(_state,_title,next){if(next!=null) location.href = new URL(next,location).href;},
    pushState(_state,_title,next){if(next!=null) location.href = new URL(next,location).href;},
  };
  const document={body:{},documentElement:{dataset:{}},
    getElementById:()=>({dataset:{shell:'native'}}),querySelector:()=>mounted && {dataset:{dawonStaff:mounted}}};
  runInNewContext('('+installStaffReturn.toString()+')('+staffReturnPath.toString()+')',{
    history,location,document,URL,URLSearchParams,localStorage:{getItem:()=>active},
    window:{addEventListener:(type,fn)=>{events[type]=fn;}},
    MutationObserver:class{constructor(fn){mutated=fn;}observe(){}},
  });
  return {location,replaced,events,go:next=>history.replaceState({},'',next),
    authenticate:next=>{active=next;},mount:role=>{mounted=role;mutated?.();}};
}

test('cold guard offers a role choice; signed-in tab invalidation keeps ordinary login',() => {
  const cold=tab(desired);
  cold.go('/login?edition=C');
  const choice=new URL(cold.replaced[0]);
  assert.equal(choice.pathname,'/');
  assert.equal(choice.searchParams.get('work'),desired);
  const warm=tab(desired,'active');
  warm.go('/login?edition=C');
  assert.deepEqual(warm.replaced,[]);
});

test('cold task pickers and native session schedules survive role selection and sign-in',() => {
  const targets = [
    '/workspace/lectures?work=attendance&course=7',
    '/workspace/lectures?work=assignments&course=7',
    '/workspace/lectures/7/sessions/12/scores?schedule=9',
    '/workspace/lectures/7/sessions/12?schedule=9',
    '/workspace/sessions/12/attendance?schedule=9',
  ];
  for (const role of ['admin','teacher']) for (const target of targets) {
    const cold=tab(target); cold.go('/login?edition=C');
    const chooser=new URL(cold.replaced[0]);
    assert.equal(chooser.searchParams.get('work'),target);
    chooser.pathname = '/staff/'+role;
    const login=new URL(editionResponse(new Request(chooser),chooser).headers.get('location'));
    assert.equal(login.searchParams.get('work'),target);
    const p=tab(login.href);
    assert.equal(login.searchParams.get('demo'),'admin'); p.go('/login?demo=admin&edition=C'); p.authenticate('fresh');
    p.go('/workspace/dashboard?edition=C'); p.mount('admin');
    const restored=new URL(p.replaced[0]); assert.equal(restored.searchParams.has('edition'),false);
    assert.equal(restored.pathname+restored.search,target);
  }
  assert.equal(staffReturnPath('/workspace/lectures?work=unknown&schedule=9','teacher'),'/workspace/lectures');
  assert.equal(staffReturnPath('/workspace/students/home?work=attendance','admin'),'/workspace/students/home');
  assert.equal(staffReturnPath('/workspace/lectures/7/sessions/12/scores?schedule=unknown','admin'),'/workspace/lectures/7/sessions/12/scores');
});

function pending() {
  const login=url('/login/dawon?demo=admin&edition=C');
  login.searchParams.set('work',desired);
  const p=tab(login.href);
  p.go('/login?demo=admin&edition=C');
  assert.equal(p.location.searchParams.get('work'),desired);
  return p;
}

test('canonical login, refresh and a confirmed fresh matching session restore the target once',() => {
  const canonical=pending();
  const p=tab(canonical.location.href);
  p.authenticate('fresh');
  p.go('/workspace/dashboard?edition=C');
  assert.deepEqual(p.replaced,[]);
  p.mount('admin'); p.mount('admin');
  assert.equal(p.replaced.length,1);
  const dest=new URL(p.replaced[0]);
  assert.equal(dest.searchParams.has('edition'),false);
  assert.equal(dest.pathname+dest.search+dest.hash,desired);
});

test('role mismatch, other-tab sign-in, browser Back, or missing successful login cancel the return',() => {
  for (const scenario of ['wrong-role','another-tab','back','unchanged','different-page']) {
    const p=pending();
    if (scenario==='another-tab') p.events.storage({key:'academy:auth-active-generation:v1'});
    if (scenario==='back') p.events.popstate();
    if (scenario!=='unchanged') p.authenticate('fresh');
    p.go(scenario==='different-page'?'/workspace/lectures':'/workspace/dashboard');
    p.mount(scenario==='wrong-role'?'teacher':'admin');
    assert.deepEqual(p.replaced,[],scenario);
  }
});

test('a workspace response waits for native staff identity before highlighting a role',() => {
  const shell=insertDemoSwitcher('<html><head></head><body></body></html>',url('/workspace/dashboard?demo=admin&edition=C'),true);
  assert.doesNotMatch(shell,/<a[^>]*data-demo-app="[^"]+"[^>]*aria-current=/);
});

test('staff and family pages share an original comparison link followed by the three roles',() => {
  for (const [path,native] of [['/',false],['/workspace/lectures?class=7',true],['/login/dawon?demo=admin',true]]) {
    const shell = insertDemoSwitcher('<html><head></head><body></body></html>',url(path),native);
    assert.deepEqual([...shell.matchAll(/data-demo-app="(.*?)"/g)].map(m => m[1]), ['original','admin','student','guardian']);
    assert.match(shell,/href="https:\/\/original-demo\.hakwonplus\.com\/workspace\/dashboard" referrerpolicy="no-referrer" data-demo-app="original"/);
    assert.doesNotMatch(shell,/data-dawon-edition|data-edition-home|edition=|href="\/staff\//);
  }
});

test('the original workspace highlights its own tab and returns to the dedicated demo', () => {
  const shell = insertDemoSwitcher('<html><head></head><body></body></html>',new URL('https://original-demo.hakwonplus.com/workspace/lectures'),true);
  assert.match(shell,/data-demo-app="original" aria-current="page"/);
  for(const path of ['/login/dawon?demo=admin','/?preview=student','/?preview=guardian']){
    assert.ok(shell.includes('href="https://demo.hakwonplus.com'+path+'"'));
  }
});
test('old bookmarks preserve class, lecture, filters and explicit role on the native route',() => {
  for (const variant of ['a','b','c']) {
    for (const role of ['teacher','admin','guardian','student']) {
      const input=url('/'+variant+'/'+role), dest=editionResponse(new Request(input),input).headers.get('location');
      assert.equal(new URL(dest).searchParams.get(['admin','teacher'].includes(role)?'demo':'preview'),role==='teacher'?'admin':role);
      assert.ok(!dest.includes('edition'));
    }
  }
  const before=url('/workspace/lectures/7/sessions/9/scores?group=2&edition=B&schedule=3');
  assert.equal(legacyEditionRedirect(before).headers.get('location'),url('/workspace/lectures/7/sessions/9/scores?group=2&schedule=3').href);
});
