'use strict';
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const {extractScript}=require('./run');
const root=path.join(__dirname,'..');
new Function(extractScript(fs.readFileSync(path.join(root,'index.html'),'utf8')));
new Function(fs.readFileSync(path.join(root,'cinematic.js'),'utf8'));
console.log('PASS syntax: game and cinematic');
let failed=false;
for(const name of ['empire.js','strategy.js','controls-tv.js','visual.js','traffic.js','save-strategy.js','cinematic.js','cosmetic-performance.js']){
 const file=path.join(__dirname,name);
 const result=spawnSync(process.execPath,[file],{stdio:'inherit',cwd:root});
 if(result.error)throw result.error;
 if(result.status!==0)failed=true;
}
process.exitCode=failed?1:0;
