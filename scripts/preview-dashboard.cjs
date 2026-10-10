const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../public');
const mime={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.mjs':'text/javascript','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.json':'application/json'};
http.createServer((req,res)=>{
 let file;
 try{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  if(pathname==='/__qa/reference.png'&&process.env.DASHBOARD_QA_IMAGE){
   fs.readFile(process.env.DASHBOARD_QA_IMAGE,(err,bytes)=>{if(err){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':'image/png','Cache-Control':'no-store'});res.end(bytes);});return;
  }
  if(pathname==='/__qa/compare.html'&&process.env.DASHBOARD_QA_IMAGE){
   res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});
   res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;display:flex;gap:8px;background:#ddd}img,iframe{width:1487px;height:1058px;border:0;flex:none}iframe{background:white}</style></head><body><img src="/__qa/reference.png" alt="Reference design"><iframe src="/dashboard-preview.html?clean=1" title="Rendered dashboard"></iframe></body></html>');return;
  }
  if(pathname==='/__qa/focus.html'&&process.env.DASHBOARD_QA_IMAGE){
   res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});
   res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;display:flex;gap:8px;background:#ddd}.crop{position:relative;overflow:hidden;width:800px;height:350px;flex:none}img,iframe{position:absolute;left:-200px;top:-200px;width:1487px;height:1058px;border:0}</style></head><body><div class="crop"><img src="/__qa/reference.png" alt="Reference hero detail"></div><div class="crop"><iframe src="/dashboard-preview.html?clean=1" title="Rendered hero detail"></iframe></div></body></html>');return;
  }
  file=path.resolve(root,'.'+(pathname==='/'?'/dashboard-preview.html':pathname));
 }catch{res.writeHead(400).end();return;}
 if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 fs.readFile(file,(err,bytes)=>{if(err){res.writeHead(404).end('Not found');return;}res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(bytes);});
}).listen(4173,'127.0.0.1',()=>console.log('Dashboard preview: http://localhost:4173/dashboard-preview.html'));
