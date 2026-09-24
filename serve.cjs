// Development server, loopback only. No dependency or remote access required.
'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=__dirname,port=Number(process.env.PORT)||8080;
http.createServer((req,res)=>{
 let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname)}catch{res.writeHead(400);res.end();return}
 const file=path.resolve(root,pathname==='/'?'index.html':pathname.slice(1));
 if(!file.startsWith(root+path.sep)||pathname.split('/').some(x=>x.startsWith('.'))){res.writeHead(403);res.end();return}
 const types={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.mp4':'video/mp4','.webm':'video/webm','.txt':'text/plain; charset=utf-8'};
 fs.readFile(file,(err,data)=>{if(err){res.writeHead(404);res.end('Fichier introuvable');return}res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.setHeader('Cache-Control','no-cache');res.end(data)});
}).listen(port,'127.0.0.1',()=>console.log(`MARLON : http://127.0.0.1:${port} — Ctrl+C pour arrêter`));
