'use strict';
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const {pipeline}=require('node:stream');
const root=fs.realpathSync(process.env.GITHUB_WORKSPACE+'/compiled/dist');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.woff2':'font/woff2','.woff':'font/woff','.ico':'image/x-icon','.svg':'image/svg+xml','.png':'image/png','.json':'application/json'};
http.createServer((req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1:18747');
  const fixture={'X-Dawon-QA-Fixture':'staff-r47-disposable'};
  if(url.pathname.startsWith('/api/v1/')||url.pathname==='/healthz'){
    const hdr={...req.headers,host:'dawon.localhost','x-forwarded-host':'dawon.localhost','x-tenant-code':'dawon'};
    const up=http.request({host:'127.0.0.1',port:18847,method:req.method,path:url.pathname+url.search,headers:hdr},(incoming)=>{
      res.writeHead(incoming.statusCode,{...incoming.headers,...fixture});
      incoming.pipe(res);
    });
    up.on('error',()=>{if(!res.headersSent)res.writeHead(502);res.end()});req.pipe(up);return;
  }
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return}
  let file=path.resolve(root,'.'+decodeURIComponent(url.pathname));
  if(!file.startsWith(root+'/')&&file!==root){res.writeHead(404);res.end();return}
  if(!path.extname(file))file=path.join(root,'index.html');
  if(!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404,fixture);res.end();return}
  res.writeHead(200,{...fixture,'content-type':types[path.extname(file)]||'application/octet-stream','cache-control':url.pathname.startsWith('/assets/')?'public, max-age=31536000, immutable':'no-store'});
  if(req.method==='HEAD'){res.end();return}pipeline(fs.createReadStream(file),res,()=>{});
}).listen(18747,'127.0.0.1');