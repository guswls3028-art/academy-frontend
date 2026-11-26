'use strict';
const https=require('node:https');
const fs=require('node:fs');
const {Readable}=require('node:stream');
const path=require('node:path');
const target=require('./target.json');
const dawon='demo.hakwonplus.com';
const original='original-demo.hakwonplus.com';
const dawonOrigin='https://dawon-review-origin.hakwonplus.com';
const originalStatic='https://abcd1234.dawon-original-reference.pages.dev';
const root=fs.realpathSync(process.env.GITHUB_WORKSPACE+'/reference-compiled/dist');

function referenceAsset(address,opts) {
  const name=decodeURIComponent(address.pathname);
  let file=path.resolve(root,'.'+name);
  if(!file.startsWith(root+'/')&&file!==root)return new Response(null,{status:404});
  if(!path.extname(file))file=path.join(root,'index.html');
  if(!fs.existsSync(file)||!fs.statSync(file).isFile())return new Response(null,{status:404});
  const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8',
    '.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.css':'text/css; charset=utf-8',
    '.png':'image/png','.woff2':'font/woff2','.woff':'font/woff'};
  return new Response(opts.method==='HEAD' ? null : fs.readFileSync(file),{
    headers:{'content-type':types[path.extname(file)]||'application/octet-stream'}
  });
}

(async()=>{
  const origin=await fetch('http://127.0.0.1:18747/version.json');
  if(origin.headers.get('x-dawon-qa-fixture')!=='staff-r47-disposable')throw Error('Fixture identity mismatch');
  const {handle}=await import('./worker/demo-worker.mjs');
  const env={
    ORIGIN_KEY:'isolated-fixture',ADMIN_VERSION:'dawon-review-20261126-admin-r48',
    UI_VERSION:'dawon-review-20261127-compare-r49',REFERENCE_STATIC_ORIGIN:originalStatic,
  };
  const dir=process.env.RUNNER_TEMP;
  const server=https.createServer({key:fs.readFileSync(dir+'/r49-tls.key'),cert:fs.readFileSync(dir+'/r49-tls.crt')},async(req,res)=>{
    try{
      const host=req.headers.host;
      if(![dawon,original].includes(host)){res.writeHead(404);res.end();return}
      const bytes=[];
      let size=0;
      for await(const chunk of req){
        size+=chunk.length;
        if(size>1_000_000){res.writeHead(413);res.end();return}
        bytes.push(chunk);
      }
      const method=req.method;
      const source=new URL(req.url,'https://'+host);
      const response=await handle(new Request(source,{method,headers:req.headers,...(bytes.length?{body:Buffer.concat(bytes)}:{})}),
        env, async(input,opts={})=>{
          const address=new URL(input);
          if(address.origin===originalStatic)return referenceAsset(address,opts);
          if(address.origin!==dawonOrigin) throw Error('Unexpected isolated upstream '+address.origin);
          const headers=new Headers(opts.headers);
          for(const name of ['host','accept-encoding','content-length','connection'])headers.delete(name);
          return fetch('http://127.0.0.1:18747'+address.pathname+address.search,{...opts,headers,duplex:'half',redirect:'manual'});
        });
      const headers=Object.fromEntries(response.headers);
      for(const name of ['content-length','content-encoding','transfer-encoding'])delete headers[name];
      const cookies=response.headers.getSetCookie();
      if(cookies.length)headers['set-cookie']=cookies;
      res.writeHead(response.status,headers);
      if(response.body && method!=='HEAD')Readable.fromWeb(response.body).pipe(res);
      else res.end();
    }catch(error){console.error(error.message);if(!res.headersSent)res.writeHead(502);res.end()}
  });
  server.listen(19449,'127.0.0.1');
})().catch(e=>{console.error(e.message);process.exitCode=1});