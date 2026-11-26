import assert from 'node:assert/strict';
import {test} from 'node:test';
import {runInNewContext} from 'node:vm';
import {demoSwitcherScript} from '../../deploy/dawon/dawon-demo-header.mjs';

const origin = 'https://demo.hakwonplus.com';

test('the demo script leaves layout and navigation to the native workspace',() => {
  assert.doesNotThrow(() => new Function(demoSwitcherScript));
  assert.doesNotMatch(demoSwitcherScript,/data-edition-desk|#183650|학원 행정 콘솔/);
});

test('switching between roles respects a visible unsaved form',()=>{
  const events={},location=new URL('/?preview=student',origin);
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
  const target={closest:selector=>selector === 'a[data-demo-app]' ? {dataset:{demoApp:'admin'}} : null};
  clicks({target,button:0,preventDefault(){blocked=true;}});
  assert.equal(asked,1);
  assert.equal(blocked,true);
});
