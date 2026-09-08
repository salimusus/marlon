'use strict';
// Fabrique une variante de index.html en appliquant des remplacements de texte,
// puis en prend des captures : sert à comparer visuellement des réglages de rendu.
const fs=require('fs'), path=require('path'), cp=require('child_process');
const ROOT=path.join(__dirname,'..');
const name=process.argv[2];
const patches=JSON.parse(fs.readFileSync(process.argv[3],'utf8'));
let s=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
for(const [a,b] of patches){ if(!s.includes(a)){ console.error('INTROUVABLE: '+a.slice(0,90)); process.exit(1);} s=s.replace(a,b); }
const tmp=path.join(ROOT,'.variant-'+name+'.html');
fs.writeFileSync(tmp,s);
const r=cp.spawnSync(process.execPath,[path.join(__dirname,'shot.js'),tmp],
  {stdio:'inherit',env:Object.assign({},process.env,{SHOT_DIR:path.join(ROOT,'shots',name)})});
fs.unlinkSync(tmp);
process.exit(r.status||0);
