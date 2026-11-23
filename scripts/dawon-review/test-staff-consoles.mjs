import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {test} from 'node:test';
import {runInNewContext} from 'node:vm';
import {staffConsoleScript, staffHome, isStaffHome} from '../../deploy/dawon/dawon-staff-consoles.mjs';

// The public Worker serializes the browser entry. Exercise that exact source in a
// fresh realm, without access to any of this module's function declarations.
function browser(role, start = '/workspace/dashboard') {
  const location = new URL(start,'https://demo.hakwonplus.com');
  const frames = [], listeners = new Map(), calls = [];
  class Tag {
    constructor(tag) { this.tag = tag; this.children = []; this.attrs = {}; this.dataset = {}; }
    get isConnected() { return this === body || this === head || !!this.parent?.isConnected; }
    get textContent() { return this.text ?? this.children.map(child => child.textContent).join(''); }
    set textContent(value) { this.text = value; }
    setAttribute(key,value) {
      this.attrs[key] = String(value);
      if (key.startsWith('data-')) this.dataset[key.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())] = String(value);
    }
    getAttribute(key) { return this.attrs[key]; }
    removeAttribute(key) { delete this.attrs[key]; }
    hasAttribute(key) { return Object.hasOwn(this.attrs,key); }
    prepend(child) { child.remove(); child.parent=this; this.children.unshift(child); }
    append(...children) { for (const child of children) { child.remove(); child.parent=this; this.children.push(child); } }
    replaceChildren(...children) { this.children.slice().forEach(child=>child.remove()); this.append(...children); }
    remove() {
      if (this.parent) this.parent.children.splice(this.parent.children.indexOf(this),1);
      this.parent = null;
    }
    matches(selector) {
      return selector.split(',').some(part => part === this.tag || /^\[[a-z-]+\]$/.test(part) && this.hasAttribute(part.slice(1,-1)));
    }
    closest(selector) { return this.matches(selector) ? this : this.parent?.closest(selector); }
    querySelectorAll(selector) {
      return this.children.flatMap(child => [...(child.matches(selector) ? [child] : []),...child.querySelectorAll(selector)]);
    }
    querySelector(selector) { return this.querySelectorAll(selector)[0]; }
    scrollTo() {}
  }
  const body = new Tag('body'), head = new Tag('head'), layout = new Tag('div'), main = new Tag('main');
  layout.dataset.dawonStaff = role;
  layout.append(main); body.append(layout);
  const on = (name,listener) => listeners.set(name,[...(listeners.get(name)||[]),listener]);
  const document = {head,body,createElement:tag=>new Tag(tag),createTextNode:text=>Object.assign(new Tag('text'),{textContent:text}),
    addEventListener:on,querySelectorAll:()=>[],querySelector:selector=>{
      if (selector === '#dawon-demo-switcher') return {dataset:{shell:['student','guardian'].includes(role) ? 'learner' : 'native'}};
      if (selector === '[data-workspace-shell] [data-dawon-staff]') return location.pathname.startsWith('/workspace/') ? layout : null;
      if (selector === '[data-dawon-staff] main') return main;
      return null;
    }};
  const window = {addEventListener:on,dispatchEvent:event=>listeners.get(event.type)?.forEach(fn=>fn(event))};
  const history = {state:{idx:0},pushState(state,title,path){ this.state=state; location.href=new URL(path,location).href; },
    replaceState(state,title,path){ this.state=state; location.href=new URL(path,location).href; }};
  const store = () => { const data = new Map(); return {getItem:key=>data.get(key) ?? null,setItem:(key,val)=>data.set(key,val)}; };
  const sessionStorage = store(), localStorage=store();
  const claims = Buffer.from(JSON.stringify({tenant_id:719,dawon_demo_role:role})).toString('base64url');
  localStorage.setItem('academy:auth-active-generation:v1','fixture');
  localStorage.setItem('academy:auth-tokens:v1:fixture',JSON.stringify({generation:'fixture',access:'fixture.'+claims+'.fixture'}));
  let fail = false;
  const fetch = async (path,init) => { calls.push({path,init});
    return {ok:!fail,json:async()=>({followups:[{kind:'counsel',day:'2099-01-10',student:'예시 학생',course:'예시 강의'}]})}; };
  const realm = {document,window,history,location,sessionStorage,localStorage,fetch,URL,URLSearchParams,AbortController,atob,crypto:{randomUUID},HTMLElement:Tag,
    PopStateEvent:class { constructor(type,options){this.type=type;Object.assign(this,options);} },
    MutationObserver:class { observe(){} },requestAnimationFrame:fn=>frames.push(fn)};
  runInNewContext(staffConsoleScript,realm);
  const flush = () => { for(let step=0;frames.length;step++){ assert.ok(step<15,'navigation converges');frames.shift()(); } };
  const active = () => main.querySelectorAll('[data-console]').find(a=>a.getAttribute('aria-current')==='page')?.dataset.console;
  const click = choice => { const target = main.querySelectorAll('[data-console]').find(a=>a.dataset.console===choice);
    assert.ok(target,'clickable '+choice); listeners.get('click').forEach(fn=>fn({button:0,target,preventDefault(){}})); flush(); };
  const replace = (url,userState) => {history.replaceState({...history.state,usr:userState},'',url); flush();};
  return {main,history,location,click,active,flush,replace,calls,sessionStorage,fail(){fail=true;}};
}

for (const role of ['admin','teacher']) {
  test(role + ' uses real scoped homes, preserves filter state, restores console on entry',async()=>{
    const page = browser(role);
    page.flush();
    assert.equal(page.active(),'A');
    page.click('B');
    assert.equal(page.active(),'B');
    assert.equal(page.location.pathname,role==='admin'?'/workspace/dashboard':'/workspace/teacher-alerts');
    assert.equal(page.location.searchParams.get('panel'),role==='admin'?'alerts':null);
    page.location.searchParams.set('rule','homework_missing');
    page.replace(page.location.href,null);
    page.click('C');
    assert.equal(page.location.pathname,'/workspace/students/home');
    assert.equal(page.active(),'C');
    await new Promise(resolve=>setImmediate(resolve));
    assert.match(page.main.textContent,/예시 학생/);
    assert.equal(page.calls[0].path,'/api/v1/students/teacher-alerts/?settings=1');
    page.replace(page.location.href,{directoryTerm:'예시'});
    page.click('B');
    assert.equal(page.location.searchParams.get('rule'),'homework_missing');
    page.click('C');
    assert.equal(page.history.state.usr.directoryTerm,'예시');
    page.replace('/login/dawon?demo='+role,null);
    page.replace('/workspace/dashboard',null);
    assert.equal(page.active(),'C');
    assert.equal(page.location.pathname,'/workspace/students/home');
  });
}
test('requested login console, failure recovery and public learner boundary',async()=>{
  const page = browser('teacher','/login/dawon?demo=teacher&console=C');
  page.fail(); page.flush(); page.replace('/workspace/dashboard',null);
  assert.equal(page.active(),'C');
  await new Promise(resolve=>setImmediate(resolve));
  assert.match(page.main.textContent,/상담 일정을 불러오지 못했습니다.*다시 시도/);
  for(const role of ['student','guardian']){
    const learner=browser(role);
    learner.flush(); assert.equal(learner.active(),undefined); assert.equal(learner.calls.length,0);
    assert.equal(staffHome(role,'A'),null);
  }
});
test('opening a record never replaces the saved home filters',()=>{
  const origin='https://demo.hakwonplus.com';
  assert.equal(isStaffHome(new URL('/workspace/dashboard?panel=student&student=1',origin),staffHome('admin','B')),false);
  assert.equal(isStaffHome(new URL('/workspace/students/home?student=1',origin),staffHome('teacher','C')),false);
  assert.equal(isStaffHome(new URL('/workspace/teacher-alerts?rule=homework_missing',origin),staffHome('teacher','B')),true);
});
