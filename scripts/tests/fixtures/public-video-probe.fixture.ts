import { test, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { appendFileSync, mkdirSync } from 'node:fs';
import { installReleaseContextGuard } from '../../../e2e/helpers/releaseApiBoundary';
test.setTimeout(90_000);
for (const id of ['xgjL2HyrdFM', 'Q70aZV1TH1Y']) test(`public player ${id}`, async ({ browser }) => {
  let origin = ''; const tenant = 'qa-public-video-probe';
  const server = createServer((req, res) => {
    if (req.url === '/api/v1/landing-public/videos/') {
      res.writeHead(200, {'Content-Type':'application/json','Access-Control-Allow-Origin':origin,'Access-Control-Allow-Credentials':'true'});
      res.end(JSON.stringify({results:[{youtube_video_id:id,canonical_url:`https://www.youtube.com/watch?v=${id}`,thumbnail_url:`https://i.ytimg.com/vi/${id}/hqdefault.jpg`}]})); return;
    }
    res.writeHead(200, {'Content-Type':'text/html'});
    res.end(`<!doctype html><meta charset="utf-8"><button id="open">Open</button><button id="close">Close</button><main></main><script>
      const source=fetch('/api/v1/landing-public/videos/',{headers:{'X-Tenant-Code':'${tenant}'}}).then(r=>r.json());
      document.querySelector('#open').onclick=async()=>{await source;const f=document.createElement('iframe');f.title='YouTube';f.width='640';f.height='480';f.referrerPolicy='strict-origin-when-cross-origin';f.src='https://www.youtube.com/embed/${id}?'+new URLSearchParams({autoplay:'0',playsinline:'1',origin:location.origin});document.querySelector('main').replaceChildren(f)};
      document.querySelector('#close').onclick=()=>document.querySelector('main').replaceChildren();</script>`);
  });
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  origin=`http://127.0.0.1:${(server.address() as {port:number}).port}`;
  const context=await browser.newContext({serviceWorkers:'block'});
  const guard=await installReleaseContextGuard(context,{mode:'development',apiOrigin:origin,webOrigin:origin,tenantCode:tenant});
  const page=await context.newPage(); const nativeCodes:string[]=[]; let nativeVisible=false; let rejected:string[]=[];
  page.on('console', message=>{const code=/^academy-release-native-keepalive:(origin|tenant|mutation|shape|transport)$/.exec(message.text())?.[1];if(code)nativeCodes.push(code)});
  try {
    await page.goto(origin); await page.getByRole('button',{name:'Open',exact:true}).click();
    await expect(page.frameLocator('iframe').getByRole('button',{name:/^(?:Play(?: video)?|동영상 재생|재생)(?: \(k\))?$/i}).filter({visible:true}).first()).toBeVisible({timeout:30_000}); nativeVisible=true;
    await page.getByRole('button',{name:'Close',exact:true}).click(); await expect(page.locator('iframe')).toHaveCount(0);
  } finally {
    await guard.beginClose(); await context.close();
    try{guard.assertClean()}catch(error){rejected=[...String(error).matchAll(/\[([a-z-]+)\]/g)].map(match=>match[1]);if(!rejected.length)rejected=['unclassified']}
    server.closeAllConnections(); await new Promise<void>(resolve=>server.close(()=>resolve()));
    mkdirSync('test-results',{recursive:true});const evidence=JSON.stringify({id,nativeVisible,rejected,nativeCodes});appendFileSync('test-results/public-video-probe.jsonl',evidence+'\n');console.log(evidence);
  }
  expect(rejected).toEqual([]); expect(nativeCodes).toEqual([]);
});
