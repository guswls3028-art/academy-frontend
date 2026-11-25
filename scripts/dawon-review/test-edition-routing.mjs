import assert from 'node:assert/strict';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import { editionResponse, installStaffReturn, legacyEditionRedirect, staffReturnPath } from '../../deploy/dawon/dawon-editions.mjs';
import { insertDemoSwitcher } from '../../deploy/dawon/dawon-demo-header.mjs';

const origin = 'https://demo.hakwonplus.com';
const desired = '/workspace/students/home?student=2&scope=class&status=pending#record';
const url = value => new URL(value,origin);

test('legacy aliases retain valid editions at their real destinations',() => {
  for (const [path,dest] of [
    ['/teacher?edition=B','/login/dawon?demo=teacher&edition=B'],
    ['/learn/teacher-portal?edition=A','/login/dawon?demo=teacher&edition=A'],
    ['/?preview=admin&edition=C','/login/dawon?demo=admin&edition=C'],
    ['/admin?edition=C','/login/dawon?demo=admin&edition=C'],
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
  const chooser=await editionResponse(new Request(entry),entry).text();
  assert.ok(chooser.includes('href="/c/admin?work='));
  assert.ok(chooser.includes('href="/c/teacher"'));
  for (const role of ['guardian','student']) assert.ok(!chooser.includes('href="/c/'+role+'"'));
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
  const document={body:{},documentElement:{dataset:{dawonEdition:'C'}},
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
  assert.equal(choice.pathname,'/c');
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
    chooser.pathname += '/'+role;
    const login=new URL(editionResponse(new Request(chooser),chooser).headers.get('location'));
    assert.equal(login.searchParams.get('work'),target);
    const p=tab(login.href);
    p.go('/login?demo='+role+'&edition=C'); p.authenticate('fresh');
    p.go('/workspace/dashboard?edition=C'); p.mount(role);
    const restored=new URL(p.replaced[0]); restored.searchParams.delete('edition');
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
  assert.equal(dest.searchParams.get('edition'),'C');
  dest.searchParams.delete('edition');
  assert.equal(dest.pathname+dest.search+dest.hash,desired);
});

test('role mismatch, other-tab sign-in, browser Back, or missing successful login cancel the return',() => {
  for (const scenario of ['wrong-role','another-tab','back','unchanged','wrong-edition']) {
    const p=pending();
    if (scenario==='another-tab') p.events.storage({key:'academy:auth-active-generation:v1'});
    if (scenario==='back') p.events.popstate();
    if (scenario!=='unchanged') p.authenticate('fresh');
    p.go('/workspace/dashboard?edition='+(scenario==='wrong-edition'?'B':'C'));
    p.mount(scenario==='wrong-role'?'teacher':'admin');
    assert.deepEqual(p.replaced,[],scenario);
  }
});

test('a workspace response waits for native staff identity before highlighting a role',() => {
  const shell=insertDemoSwitcher('<html><head></head><body></body></html>',url('/workspace/dashboard?demo=admin&edition=C'),true);
  assert.doesNotMatch(shell,/<a[^>]*data-demo-app="[^"]+"[^>]*aria-current=/);
});

test('family pages expose all four entrances and staff desks retain their own roles',() => {
  const base='<html><head></head><body></body></html>';
  for (const path of ['/?preview=guardian','/learn/curriculum','/student/video/play','/login/dawon?demo=guardian']) {
    const html=insertDemoSwitcher(base,url(path),path.startsWith('/student/')||path.startsWith('/login/'));
    assert.deepEqual([...html.matchAll(/data-demo-app="([^"]+)"/g)].map(m=>m[1]),['teacher','admin','student','guardian']);
    for (const role of ['teacher','admin']) assert.ok(html.includes('href="/staff/'+role+'"'));
    assert.doesNotMatch(html,/<html[^>]*data-dawon-edition|<a[^>]*data-edition-home/);
  }
  for (const key of ['A','B','C']) {
    const html=insertDemoSwitcher(base,url('/workspace/dashboard?edition='+key),true);
    assert.deepEqual([...html.matchAll(/data-demo-app="([^"]+)"/g)].map(m=>m[1]),['teacher','admin']);
    assert.ok(html.includes('data-edition-home href="/'+key.toLowerCase()+'"'));
  }
});

test('each public staff role can enter every complete program before signing in',async () => {
  for (const role of ['teacher','admin']) {
    const route = url('/staff/' + role);
    const page = await editionResponse(new Request(route),route).text();
    assert.ok(page.includes('href="/"'));
    for (const edition of ['a','b','c']) {
      const path = '/' + edition + '/' + role;
      assert.ok(page.includes('href="' + path + '"'));
      const target = url(path);
      assert.equal(editionResponse(new Request(target),target).headers.get('location'),
        origin + '/login/dawon?demo=' + role + '&edition=' + edition.toUpperCase());
    }
    assert.equal(await editionResponse(new Request(route,{method:'HEAD'}),route).text(),'');
    assert.equal(editionResponse(new Request(route,{method:'POST'}),route).status,405);
  }
  assert.equal(editionResponse(new Request(url('/staff/guardian')),url('/staff/guardian')),null);
});
