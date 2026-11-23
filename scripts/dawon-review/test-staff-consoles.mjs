import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';
import {runInNewContext} from 'node:vm';
import {editionResponse, installEdition} from '../../deploy/dawon/dawon-editions.mjs';
import {catalog} from '../../deploy/dawon/dawon-edition-desks.mjs';
import {demoSwitcherScript} from '../../deploy/dawon/dawon-demo-header.mjs';
import {staffConsoleScript} from '../../deploy/dawon/dawon-staff-consoles.mjs';

const origin = 'https://demo.hakwonplus.com';
function request(path,method='GET') {
  const url = new URL(path,origin);
  return editionResponse(new Request(url,{method}),url);
}
test('each stable entrance exposes all four roles, with no writes or role grants',async()=>{
  for (const key of ['A','B','C']) {
    const path = '/' + key.toLowerCase();
    assert.equal(request(path,'HEAD').status,200);
    assert.equal(await request(path,'HEAD').text(),'');
    assert.equal(request(path,'POST').status,405);
    const index = await request(path).text();
    for (const role of ['admin','teacher','student','guardian']) {
      assert.ok(index.includes('href="' + path + '/' + role + '"'));
      const result = request(path + '/' + role);
      const dest = new URL(result.headers.get('location'));
      assert.equal(result.status,302);
      assert.equal(dest.origin,origin);
      assert.equal(dest.pathname,['admin','teacher'].includes(role) ? '/login/dawon' : '/');
      assert.equal(dest.searchParams.get('demo') || dest.searchParams.get('preview'),role);
      assert.equal(dest.searchParams.get('edition'),key);
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
  runInNewContext('('+installEdition.toString()+')()',context);
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
