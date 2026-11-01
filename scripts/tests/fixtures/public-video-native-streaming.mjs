import assert from 'node:assert/strict';
import http from 'node:http';
import { chromium } from '@playwright/test';
import { installNativeFixtureController } from '../../public-video-native-diagnostic.mjs';
export async function runStreamingCloseFixtures() {
const results = []; let current, browser;
const sockets = new Set();
const own = server => { server.on('connection',s=>{sockets.add(s);s.on('close',()=>sockets.delete(s));});return server; };
const listen = server => new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const close = server => new Promise(resolve=>server.close(resolve));
const provider = own(http.createServer((req,res)=>{
  const local=current;
  if(req.url==='/embed') {
    res.writeHead(200,{'content-type':'text/html'});
    res.end("<button onclick=\"fetch('/stream').then(async r=>{window.reader=r.body.getReader();await window.reader.read();document.body.dataset.received='yes'}).catch(()=>{})\">start</button>");
  } else if(req.url==='/stream') {
    local.streamStarted=true;
    if(local.name==='approved-open-body') {res.writeHead(200,{'content-type':'text/plain'});res.write('synthetic-first-chunk');}
    else setTimeout(()=>{
      local.headersWritten=true;
      if(local.name==='pending-header-redirect') {res.writeHead(302,{location:'/forbidden'});res.end();}
      else {res.writeHead(200,{'content-type':'text/plain'});res.end('synthetic-body');}
    },180);
  } else {local.forbiddenHits++;res.end('forbidden');}
}));
const app = own(http.createServer((req,res)=>{res.writeHead(200,{'content-type':'text/html'});res.end(`<iframe src="${current.embedUrl}"></iframe>`);}));
const waitFor = async f=>{const until=Date.now()+2500;while(!f()){assert.ok(Date.now()<until,'wait-deadline');await new Promise(r=>setTimeout(r,5));}};
  try {
    await listen(provider);await listen(app);
    const providerOrigin='http://localhost:'+provider.address().port,appOrigin='http://127.0.0.1:'+app.address().port;
    browser=await chromium.launch({headless:true,args:['--site-per-process','--disable-background-networking']});
    for(const name of ['approved-open-body','pending-header-success','pending-header-redirect']) {
      const context=await browser.newContext({serviceWorkers:'block'});const page=await context.newPage();let guard;
      current={name,embedUrl:providerOrigin+'/embed',streamStarted:false,headersWritten:false,forbiddenHits:0};const local=current;
      try {
        guard=await installNativeFixtureController(context,page,{appOrigin,providerOrigin,embedUrl:local.embedUrl,totalMs:1800,commandMs:500});
        await page.goto(appOrigin);const frame=page.frameLocator('iframe');await frame.getByRole('button').click();
        await waitFor(()=>local.streamStarted);
        if(name==='approved-open-body') {
          await frame.locator('body[data-received=yes]').waitFor({timeout:1000});
          assert.equal(guard.snapshot().responseCounts['player:200'],1);
          assert.ok(guard.snapshot().activeRequests>=1,'Native body remains in flight');
        }
        const started=performance.now();await guard.beginClose();const elapsed=performance.now()-started;
        const snapshot=guard.snapshot();
        assert.equal(snapshot.closed,true);assert.equal(snapshot.activeRequests,0);assert.equal(snapshot.activeHandlers,0);assert.equal(snapshot.pendingCommands,0);
        assert.equal(local.forbiddenHits,0);
        if(name==='pending-header-redirect') assert.ok(snapshot.failures.includes('redirect'));
        else {guard.assertClean();assert.ok(elapsed<1000,'Approved streaming body must not consume whole operation budget');}
        if(name!=='approved-open-body')assert.equal(local.headersWritten,true,'Pending headers must settle before close');
        results.push({name,passed:true,closeElapsedMs:Math.round(elapsed),snapshot,headersWritten:local.headersWritten});console.log(name+': PASS');
      } catch(error){results.push({name,passed:false,message:error.message,snapshot:guard?.snapshot()});console.log(name+': FAIL '+error.message);}
      finally{await context.close();}
    }
  } finally {
    if(browser)await browser.close();await Promise.all([...sockets].map(s=>new Promise(resolve=>{s.once('close',resolve);s.destroy();})));
    await Promise.all([close(provider),close(app)]);
    const report={results,
      externalRequests:0,cleanup:{browserClosed:!browser?.isConnected(),serversClosed:!provider.listening&&!app.listening,sockets:sockets.size}};

    console.log(JSON.stringify({passed:results.filter(x=>x.passed).length,failed:results.filter(x=>!x.passed).length,cleanup:report.cleanup}));
  }
  assert.equal(results.length, 3);
  assert.equal(results.filter(result => !result.passed).length, 0, JSON.stringify(results.filter(result => !result.passed)));
  return results;
}
