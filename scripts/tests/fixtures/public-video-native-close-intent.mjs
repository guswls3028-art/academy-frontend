import assert from 'node:assert/strict';
import http from 'node:http';
import { chromium } from '@playwright/test';
import { installNativeFixtureController } from '../../public-video-native-diagnostic.mjs';
export async function runClosingIntentFaults() {
let current,browser;const results=[],sockets=new Set();
const own=s=>{s.on('connection',c=>{sockets.add(c);c.on('close',()=>sockets.delete(c));});return s;};
const listen=s=>new Promise(r=>s.listen(0,'127.0.0.1',r));const close=s=>new Promise(r=>s.close(r));
const provider=own(http.createServer((req,res)=>{
  const local=current;local.hits[req.url]=(local.hits[req.url]||0)+1;
  if(req.url==='/embed'){res.writeHead(200,{'content-type':'text/html'});res.end('<button onclick="fetch(\'/asset\').then(r=>r.text()).catch(()=>{})">start</button>');}
  else if(req.url==='/asset')setTimeout(()=>{if(local.name==='admitted-header-error')req.socket.destroy();else res.end('done');},220);
  else res.end('forbidden');
}));
const app=own(http.createServer((req,res)=>{res.writeHead(200,{'content-type':'text/html'});res.end(`<iframe src="${current.embedUrl}"></iframe>`);}));
const waitFor=async f=>{const limit=Date.now()+2500;while(!f()){assert.ok(Date.now()<limit,'fixture-wait');await new Promise(r=>setTimeout(r,5));}};
  try{
    await listen(provider);await listen(app);
    const providerOrigin='http://localhost:'+provider.address().port,appOrigin='http://127.0.0.1:'+app.address().port;
    browser=await chromium.launch({headless:true,args:['--site-per-process','--disable-background-networking']});
    for(const name of ['network-start-missing','network-start-order-false','admitted-header-error','duplicate-request-key']){
      current={name,embedUrl:providerOrigin+'/embed',hits:{},networkEvents:0,injections:0};const local=current;
      const context=await browser.newContext({serviceWorkers:'block'}),page=await context.newPage();let guard;
      const factory=context.newCDPSession.bind(context);
      context.newCDPSession=async target=>{
        const session=await factory(target),originalOn=session.on.bind(session);
        originalOn('Network.requestWillBeSent',event=>{if(new URL(event.request.url).pathname==='/secret')local.networkEvents++;});
        session.on=(method,callback)=>originalOn(method,method==='Network.requestWillBeSent' ? event=>{
          if(new URL(event.request.url).pathname==='/secret'&&guard&&name.startsWith('network-start-')){
            local.injections++;
            if(name==='network-start-missing')return;
            const closing=guard.state.closing;guard.state.closing=false;
            try{callback(event);}finally{guard.state.closing=closing;}
          }else callback(event);
        }:callback);
        return session;
      };
      try{
        guard=await installNativeFixtureController(context,page,{appOrigin,providerOrigin,embedUrl:local.embedUrl,totalMs:4000,commandMs:700});
        await page.goto(appOrigin);const frame=page.frameLocator('iframe');await frame.getByRole('button').click();await waitFor(()=>local.hits['/asset']===1);
        const closing=guard.beginClose();
        if(name.startsWith('network-start-'))await page.evaluate(url=>{void fetch(url).catch(()=>{});},providerOrigin+'/secret');
        else if(name==='duplicate-request-key')await frame.getByRole('button').evaluate(b=>{void b.ownerDocument.defaultView.fetch('/asset').catch(()=>{});});
        await closing;
        const snapshot=guard.snapshot();
        assert.equal(snapshot.closed,true);assert.equal(snapshot.activeRequests,0);assert.equal(snapshot.activeHandlers,0);assert.equal(snapshot.pendingCommands,0);
        assert.equal(local.hits['/secret']||0,0);
        if(name==='admitted-header-error')assert.ok(local.hits['/asset']>=1&&local.hits['/asset']<=2);
        else assert.equal(local.hits['/asset'],1);
        if(name.startsWith('network-start-')){guard.assertClean();assert.equal(snapshot.intentionalClosingAborts,1);assert.equal(local.networkEvents,1);}
        else{assert.throws(()=>guard.assertClean(),/response-shape/);assert.equal(snapshot.intentionalClosingAborts??0,0);}
        results.push({name,passed:true,snapshot,networkEvents:local.networkEvents,injections:local.injections});console.log(name+': PASS');
      }catch(error){results.push({name,passed:false,message:error.message,snapshot:guard?.snapshot(),networkEvents:local.networkEvents,injections:local.injections});console.log(name+': FAIL '+error.message);}
      finally{await context.close();}
    }
  }finally{
    if(browser)await browser.close();await Promise.all([...sockets].map(s=>new Promise(r=>{s.once('close',r);s.destroy();})));
    await Promise.all([close(app),close(provider)]);
    const report={results,externalRequests:0,
      cleanup:{browserClosed:!browser?.isConnected(),serversClosed:!app.listening&&!provider.listening,sockets:sockets.size}};

    console.log(JSON.stringify({passed:results.filter(x=>x.passed).length,failed:results.filter(x=>!x.passed).length,cleanup:report.cleanup}));
  }
  assert.equal(results.length, 4);
  assert.equal(results.filter(result => !result.passed).length, 0, JSON.stringify(results.filter(result => !result.passed)));
  return results;
}
