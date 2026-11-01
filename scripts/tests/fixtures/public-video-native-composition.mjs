import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { installNativeResponseGuard } from '../../public-video-native-diagnostic.mjs';
import { fileURLToPath, pathToFileURL } from 'node:url';
export async function runActualGuardComposition() {
const tempRoot = fs.realpathSync(os.tmpdir());
const dir = fs.mkdtempSync(path.join(tempRoot, 'academy-native-composition-')) + path.sep;
try {
const repo = fileURLToPath(new URL('../../../', import.meta.url));
const runnerPath = repo + 'scripts/public-video-provider-diagnostic.mjs';
const runner = await import(pathToFileURL(runnerPath));
const guardPath = repo + 'e2e/helpers/releaseApiBoundary.ts';
const guardSource = fs.readFileSync(guardPath, 'utf8');
const prepared = runner.prepareDiagnosticSources(guardSource,
  fs.readFileSync(repo + 'e2e/admin/public-video-realuse.spec.ts', 'utf8'));
const nativeSource = runner.prepareNativeDiagnosticSource(prepared.source);
const policy = await runner.loadPolicy(nativeSource);
const fixedEmbedUrl = 'https://www.youtube.com/embed/xgjL2HyrdFM?' + new URLSearchParams({ autoplay:'0', playsinline:'1', origin:runner.WEB_ORIGIN });
const boundary = { mode:'development', webOrigin:runner.WEB_ORIGIN, apiOrigin:'http://127.0.0.1:18000', tenantCode:'qa-local-closed-composition' };
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const initialHashes = { runner:hash(runnerPath), guard:hash(guardPath), controller:hash(repo + 'scripts/public-video-native-diagnostic.mjs') };
const key = dir + 'localhost-fixture.key'; const cert = dir + 'localhost-fixture.crt';
if (!fs.existsSync(key) || !fs.existsSync(cert)) execFileSync(process.platform === 'win32' ? 'C:/Program Files/Git/usr/bin/openssl.exe' : 'openssl',
  ['req','-x509','-newkey','rsa:2048','-nodes','-keyout',key,'-out',cert,'-days','1',
    '-subj','/CN=closed-localhost-fixture','-addext','subjectAltName=DNS:www.youtube.com,DNS:i.ytimg.com,DNS:r1.googlevideo.com'], { stdio:'ignore' });
const sockets = new Set();
const own = server => { server.on('connection', socket => { sockets.add(socket); socket.on('close', () => sockets.delete(socket)); }); return server; };
const listen = (server, port=0) => new Promise((resolve,reject) => { server.once('error',reject); server.listen(port,'127.0.0.1',resolve); });
const close = server => new Promise(resolve => server.close(resolve));
const results = []; const deniedConnects = []; let current, browser;
const provider = own(https.createServer({ key:fs.readFileSync(key), cert:fs.readFileSync(cert) }, (req,res) => {
  const path = new URL(req.url, 'https://www.youtube.com').pathname;
  current.hits[path] = (current.hits[path] || 0) + 1;
  if (req.headers.authorization || req.headers['x-tenant-code'] || req.headers['x-csrftoken']) current.credentialHits++;
  if (path.startsWith('/embed/')) {
    res.writeHead(200,{'content-type':'text/html'});
    const headers = current.name === 'credentials' ? ",{headers:{authorization:'synthetic-local-only'}}" : '';
    const action = `fetch('/asset'${headers}).then(r=>r.text()).then(()=>document.body.dataset.done='yes').catch(()=>document.body.dataset.failed='yes')`;
    res.end(`<body><button id="start" onclick="${action}">start</button><script>${current.name === 'immediate-child' ? action : ''}</script></body>`);
  } else if (path === '/asset') {
    if (['redirect','close-late-redirect'].includes(current.name)) {
      setTimeout(() => { res.writeHead(302,{location:'/forbidden'});res.end(); },current.name === 'close-late-redirect' ? 200 : 0);
    } else { res.writeHead(200,{'content-type':'text/plain'}); res.end('ok'); }
  } else if (path === '/leave') {
    res.writeHead(200,{'content-type':'text/html'}); res.end("<script>fetch('/forbidden')</script>");
  } else { res.writeHead(200);res.end('forbidden'); }
}));
const app = own(http.createServer((req,res) => {
  if (req.url !== '/') { res.writeHead(404);res.end();return; }
  res.writeHead(200,{'content-type':'text/html'});res.end(runner.diagnosticHtml());
}));
// The proxy never resolves a provider name and can only connect to two numeric loopback ports.
const proxy = own(http.createServer((req,res) => {
  if (req.url !== runner.WEB_ORIGIN + '/') { deniedConnects.push('http-denied');res.writeHead(403);res.end();return; }
  const upstream = http.request({ host:'127.0.0.1',port:4173,path:'/',method:'GET',headers:{host:'localhost:4173'} }, reply => {res.writeHead(reply.statusCode,reply.headers);reply.pipe(res);});
  upstream.on('error',()=>{res.writeHead(502);res.end();});upstream.end();
}));
proxy.on('connect',(req,client,head) => {
  if (!['www.youtube.com:443','i.ytimg.com:443','r1.googlevideo.com:443'].includes(req.url)) {
    deniedConnects.push('connect-denied');client.end('HTTP/1.1 403 Forbidden\r\n\r\n');return;
  }
  const upstream = net.connect(provider.address().port,'127.0.0.1',()=>{
    client.write('HTTP/1.1 200 Connection Established\r\n\r\n');if(head.length)upstream.write(head);client.pipe(upstream);upstream.pipe(client);
  });
  sockets.add(upstream);upstream.on('close',()=>sockets.delete(upstream));
  upstream.on('error',()=>client.destroy());client.on('error',()=>upstream.destroy());client.on('close',()=>upstream.destroy());
});
const waitFor = async predicate => { const deadline=Date.now()+5000;while(!predicate()) {assert.ok(Date.now()<deadline,'fixture-wait-deadline');await new Promise(r=>setTimeout(r,10));} };
try {
  await listen(provider);await listen(app,4173);await listen(proxy);
  browser = await chromium.launch({headless:true,proxy:{server:'http://127.0.0.1:'+proxy.address().port},
    args:['--site-per-process','--disable-background-networking']});
  for (const name of ['immediate-child','credentials','redirect','sibling','navigation-revoke','close-late-redirect']) {
    current = {name,hits:{},credentialHits:0};const local=current;
    const context = await browser.newContext({serviceWorkers:'block',ignoreHTTPSErrors:true});
    let guard,controller; const result={mode:'native',contextClosed:false};
    try {
      guard = await policy.installReleaseContextGuard(context,boundary);
      const page = await context.newPage();
      controller = await installNativeResponseGuard(context,page,{webOrigin:runner.WEB_ORIGIN,fixedEmbedUrl,
        classify:(url,method,type,trusted)=>policy.publicVideoRequestKind(boundary,url,method,type,new Set(['xgjL2HyrdFM']),trusted),
        admissionGuardInstalled:true,deadlineMs:8000,commandMs:1000,
        responseUrlPatterns:policy.PUBLIC_VIDEO_PROVIDERS.flatMap(host=>[`https://${host}/*`,`https://*.${host}/*`])});
      policy.setNativeDiagnosticController(runner.nativeDiagnosticBridge(controller));
      await page.goto(runner.WEB_ORIGIN,{waitUntil:'domcontentloaded',timeout:5000});
      const frame=page.frameLocator('iframe');await frame.locator('#start').waitFor({timeout:5000});
      if(name==='immediate-child') {
        await frame.locator('body[data-done=yes]').waitFor({timeout:5000});assert.equal(local.hits['/asset'],1);
        guard.assertClean();controller.assertClean();
      } else if(name==='sibling') {
        await page.evaluate(()=>{const f=document.createElement('iframe');f.src='https://www.youtube.com/forbidden';document.body.append(f);});
        await waitFor(()=>{try{guard.assertClean();return false;}catch{return true;}});
      } else if(name==='navigation-revoke') {
        await frame.locator('#start').evaluate(button=>{button.ownerDocument.defaultView.location.href='/leave';});
        await waitFor(()=>controller.snapshot().failures.includes('response-frame'));
      } else {
        await frame.locator('#start').click();
        if(name==='credentials') await waitFor(()=>{try{guard.assertClean();return false;}catch{return true;}});
        else if(name==='redirect') await waitFor(()=>controller.snapshot().failures.includes('redirect'));
        else await waitFor(()=>local.hits['/asset']===1);
      }
      await runner.finishDiagnosticContext({guard,controller,context,result});
      const evidence=runner.closedNativeEvidence(controller);
      assert.equal(result.contextClosed,true);assert.equal(local.credentialHits,0);assert.equal(local.hits['/forbidden']||0,0);
      if(name==='credentials') assert.equal(local.hits['/asset']||0,0);
      if(name==='immediate-child') {assert.equal(result.boundaryPassed,true);assert.equal(result.controllerPassed,true);}
      else assert.ok(!result.boundaryPassed||!result.controllerPassed,'Violation must survive final close');
      if(name==='close-late-redirect') assert.ok(evidence.failures.includes('redirect'));
      results.push({name,passed:true,...result,evidence,hits:local.hits,credentialHits:local.credentialHits});
      console.log(name+': PASS');
    } catch(error) {
      results.push({name,passed:false,message:error.message.slice(0,300),snapshot:controller?.snapshot(),hits:local.hits});
      console.log(name+': FAIL '+error.message.slice(0,200));
    } finally {await runner.finishDiagnosticContext({guard,controller,context,result});}
  }
  assert.deepEqual({runner:hash(runnerPath),guard:hash(guardPath),controller:hash(repo + 'scripts/public-video-native-diagnostic.mjs')},initialHashes,'Source changed during composition');
} finally {
  if(browser)await browser.close();
  await Promise.all([...sockets].map(socket => new Promise(resolve => {
    socket.once('close',resolve);socket.destroy();
  })));
  await Promise.all([close(proxy),close(app),close(provider)]);
  const report={sourceHashes:initialHashes,results,externalProviderConnections:0,qaApiOrDbUsed:false,
    localOnlyProxy:true,testOnlySelfSignedTls:true,deniedProxyConnections:deniedConnects.length,
    cleanup:{browserClosed:!browser?.isConnected(),serversClosed:![proxy,app,provider].some(s=>s.listening),remainingSockets:sockets.size}};
  console.log(JSON.stringify({passed:results.filter(r=>r.passed).length,failed:results.filter(r=>!r.passed).length,cleanup:report.cleanup}));
  assert.equal(report.cleanup.remainingSockets,0);
}
assert.equal(results.length, 6);
assert.equal(results.filter(result => !result.passed).length, 0, JSON.stringify(results.filter(result => !result.passed)));
return results;
} finally {
  const target = path.resolve(dir);
  assert.equal(path.dirname(target), tempRoot);
  assert.ok(path.basename(target).startsWith('academy-native-composition-'));
  fs.rmSync(target, { recursive: true });
}
}
