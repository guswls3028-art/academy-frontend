import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';
import {runInNewContext} from 'node:vm';
import {editionResponse, installEdition, staffProgramUrl} from '../../deploy/dawon/dawon-editions.mjs';
import {catalog} from '../../deploy/dawon/dawon-edition-desks.mjs';
import {demoSwitcherScript} from '../../deploy/dawon/dawon-demo-header.mjs';
import {staffConsoleScript} from '../../deploy/dawon/dawon-staff-consoles.mjs';

const origin = 'https://demo.hakwonplus.com';
function request(path,method='GET') {
  const url = new URL(path,origin);
  return editionResponse(new Request(url,{method}),url);
}
test('each standalone candidate exposes both staff roles and redirects former family entrances to the shared app',async()=>{
  for (const key of ['A','B','C']) {
    const path = '/' + key.toLowerCase();
    assert.equal(request(path,'HEAD').status,200);
    assert.equal(await request(path,'HEAD').text(),'');
    assert.equal(request(path,'POST').status,405);
    const index = await request(path).text();
    assert.deepEqual([...index.matchAll(/<a href="([^"]+)"/g)].map(m=>m[1]).sort(),[path+'/admin',path+'/teacher']);
    for (const role of ['admin','teacher','student','guardian']) {
      assert.equal(index.includes('href="' + path + '/' + role + '"'), ['admin','teacher'].includes(role));
      const result = request(path + '/' + role);
      const dest = new URL(result.headers.get('location'));
      assert.equal(result.status,302);
      assert.equal(dest.origin,origin);
      assert.equal(dest.pathname,['admin','teacher'].includes(role) ? '/login/dawon' : '/');
      assert.equal(dest.searchParams.get('demo') || dest.searchParams.get('preview'),role);
      assert.equal(dest.searchParams.get('edition'),['admin','teacher'].includes(role) ? key : null);
      assert.equal(result.headers.get('set-cookie'),null);
    }
  }
  assert.equal(request('/a/unknown'),null);
  assert.equal(request('/workspace/lectures'),null);
});

test('the edition directory includes every authorized native menu in the same role and group',async()=>{
  const source=await readFile(new URL('../../src/shared/product/dawon/staffMenu.ts',import.meta.url),'utf8');
  const definitions=source.slice(source.indexOf('const teacher ='),source.indexOf('export const staffGuide'));
  const menus=runInNewContext(definitions.replace('export const staffMenus','const staffMenus')+';staffMenus');
  for (const role of ['admin','teacher']) {
    assert.deepEqual(catalog[role],JSON.parse(JSON.stringify(menus[role].map(section=>[section.label,section.items]))));
  }
  assert.deepEqual(Object.keys(catalog).sort(),['admin','teacher']);
});

function tab(initial, stored) {
  const location=new URL(initial,origin),listeners=new Map(),documentElement={dataset:{}};
  let pref=stored;
  const history={state:{idx:1},replaceState(state,_title,path){location.href=new URL(path,location).href;this.state=state;},pushState(...args){this.replaceState(...args);}};
  const context={location,history,URL,document:{documentElement,querySelector:()=>null,querySelectorAll:()=>[],addEventListener(){}},
    window:{addEventListener:(type,fn)=>listeners.set(type,fn)},sessionStorage:{getItem:()=>pref,setItem:(_key,value)=>{pref=value;}}};
  runInNewContext('('+installEdition.toString()+')('+staffProgramUrl.toString()+')',context);
  return {location,history,documentElement,back(path){location.href=new URL(path,origin).href;listeners.get('popstate')();}};
}
test('new tabs, role links, reload and browser history keep their own edition and native filters',()=>{
  for (const edition of ['A','B','C']) {
    const page=tab('/login/dawon?demo=teacher&edition='+edition,'C');
    page.history.pushState({idx:2},'','/workspace/dashboard?panel=alerts#queue');
    assert.equal(page.location.searchParams.get('edition'),edition);
    assert.equal(page.location.searchParams.get('panel'),'alerts');
    assert.equal(page.location.hash,'#queue');
    assert.equal(page.documentElement.dataset.dawonEdition,edition);
    const reloaded=tab(page.location.href);
    assert.equal(reloaded.documentElement.dataset.dawonEdition,edition);
    page.back('/workspace/students/home?edition=B');
    assert.equal(page.documentElement.dataset.dawonEdition,'B');
    page.history.replaceState({idx:2},'','/login/dawon?demo=admin');
    assert.equal(page.location.searchParams.get('edition'),'B');
  }
  assert.equal(tab('/workspace/dashboard?edition=unknown').documentElement.dataset.dawonEdition,'A');
});
test('the exact bundled demo script parses in its own browser realm',()=>{
  assert.doesNotThrow(()=>new Function(demoSwitcherScript));
});

test('searching the edition directory permits navigation and edited business forms still prompt',()=>{
  const origin='https://demo.hakwonplus.com',events={},location=new URL('/workspace/dashboard?edition=C',origin);
  let promptCount=0;
  class Field {
    constructor(isSearch){this.isSearch=isSearch;}
    closest(){return this.isSearch ? this : null;}
    getClientRects(){return [1];}
  }
  const search=new Field(true),business=new Field(false);
  const document={head:{append(){}},body:{},querySelector:s=>s==='#dawon-demo-switcher'?{dataset:{shell:'native'}}:null,
    querySelectorAll:()=>[search,business],createElement:()=>({setAttribute(){}}),addEventListener:(type,fn)=>{events[type]=fn;}};
  const history={state:{idx:0},replaceState(){},pushState(_state,_title,url){location.href=new URL(url,origin).href;}};
  const window={confirm(){promptCount++;return false;},addEventListener(){},dispatchEvent(){}};
  runInNewContext(staffConsoleScript,{location,window,document,URL,URLSearchParams,history,HTMLElement:Field,
    MutationObserver:class{observe(){}},PopStateEvent:class{},requestAnimationFrame:()=>1,crypto:{randomUUID:()=>'key'}});
  const anchor={href:origin+'/workspace/students/home',matches:()=>true,hasAttribute:()=>false};
  const click=()=>events.click({button:0,target:{closest:()=>anchor},preventDefault(){}});
  events.input({target:search});click();
  assert.equal(promptCount,0);
  assert.equal(location.pathname,'/workspace/students/home');
  events.input({target:business});click();
  assert.equal(promptCount,1);
});

test('opening the version chooser respects a visible unsaved form',()=>{
  const events={},location=new URL('/login/dawon?demo=teacher&edition=B',origin);
  let clicks,asked=0,blocked=false;
  const nav={dataset:{shell:'learner'},querySelectorAll:()=>[],addEventListener:(_type,fn)=>{clicks=fn;}};
  class Field {
    matches(selector){return selector.startsWith('input:not');}
    closest(){return this;}
    get isConnected(){return true;}
    getClientRects(){return [1];}
  }
  const document={documentElement:{dataset:{}},body:{dataset:{}},getElementById:()=>nav,querySelector:()=>null,querySelectorAll:()=>[],
    addEventListener:(type,fn)=>{events[type]=fn;}};
  const window={addEventListener(){},confirm(){asked++;return false;}};
  const history={state:null,pushState(){},replaceState(){}};
  runInNewContext(demoSwitcherScript,{location,document,window,history,URL,URLSearchParams,sessionStorage:{setItem(){}},HTMLElement:Field,MutationObserver:class{observe(){}}});
  events.input({target:new Field()});
  const target={closest:selector=>selector.includes('a[data-edition-home]')?{dataset:{}}:null};
  clicks({target,button:0,preventDefault(){blocked=true;}});
  assert.equal(asked,1);
  assert.equal(blocked,true);
});

test('a shared family screen never takes on a saved staff edition',() => {
  for (const path of ['/?preview=student','/?preview=guardian','/learn/curriculum','/login/dawon?demo=guardian','/student/video/play']) {
    const family=tab(path,'C');
    assert.equal(family.documentElement.dataset.dawonEdition,undefined);
    family.history.pushState({},'','/learn/attendance?date=2026-11-19');
    assert.equal(family.location.searchParams.has('edition'),false);
  }
});
