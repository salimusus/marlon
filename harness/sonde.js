'use strict';
// Sonde : ouvre le jeu dans Chromium et evalue un script (IIFE ou IIFE async) dans la page.
// Usage : node harness/sonde.js mon-script.js   (JEU=... pour un autre index.html)
const fs=require('fs'), path=require('path'), http=require('http');
const { chromium } = require('./runtime').playwright;
const ROOT=path.join(__dirname,'..');
const shot=fs.readFileSync(path.join(ROOT,'harness','shot.js'),'utf8');
const HOOK=/const HOOK = `([\s\S]*?)`;\n/.exec(shot)[1];
function serve(file){
  const html=fs.readFileSync(file,'utf8')
    .replace(/<script src="https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/three\.js\/r128\/three\.min\.js"><\/script>/,'<script src="/three.min.js"></script>')
    .replace(/<script src="https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/peerjs[^<]*<\/script>/,'')
    .replace(/<link href="https:\/\/fonts\.googleapis\.com[^>]*>/,'')
    .replace(/\nloop\(\);/, '\nloop();\n'+HOOK);
  const three=fs.readFileSync(path.join(ROOT,'harness','vendor','three.min.js'));
  const srv=http.createServer((q,r)=>{ if(q.url.startsWith('/three')){r.writeHead(200,{'Content-Type':'application/javascript'});r.end(three);}
    else {r.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});r.end(html);} });
  return new Promise(res=>srv.listen(0,'127.0.0.1',()=>res({srv,port:srv.address().port})));
}
(async()=>{
  const {srv,port}=await serve(process.env.JEU || path.join(ROOT,'index.html'));
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || undefined,
    args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox','--disable-dev-shm-usage']});
  const page=await browser.newPage({viewport:{width:1024,height:640}});
  const errors=[];
  page.on('console',m=>{ if(m.type()==='error') errors.push(m.text()); });
  page.on('pageerror',e=>errors.push('PAGEERROR: '+e.message));
  await page.goto(`http://127.0.0.1:${port}/`,{waitUntil:'load'});
  await page.waitForFunction(()=>window.__SHOT&&window.__SHOT.ready,null,{timeout:60000});
  const script=fs.readFileSync(process.argv[2],'utf8');
  const out = await page.evaluate(script);
  console.log(JSON.stringify(out,null,1));
  if(errors.length) console.log('ERREURS:', errors.slice(0,5));
  await browser.close(); srv.close();
})().catch(e=>{console.error(e);process.exit(1)});
