'use strict';
const vm=require('vm'),fs=require('fs'),assert=require('node:assert/strict'),M=require('../src/core.js');
const listeners={},docListeners={},canvasListeners={};let pad=null,mode='play',toasts=[];
const canvas={addEventListener:(k,f)=>canvasListeners[k]=f};
M.game={get mode(){return mode},setMode:m=>mode=m,toast:t=>toasts.push(t)};
vm.runInNewContext(fs.readFileSync(require('path').join(__dirname,'../src/input.js'),'utf8'),{Marlon:M,window:{},navigator:{getGamepads:()=>[pad]},document:{hidden:false,pointerLockElement:null,addEventListener:(k,f)=>docListeners[k]=f},addEventListener:(k,f)=>listeners[k]=f,console});
const input=new M.Input(canvas);let count=0;
function test(name,fn){fn();count++;console.log('PASS '+name);}
function makePad(){return{id:'DualSense Wireless Controller',connected:true,index:0,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:18},()=>({pressed:false,value:0}))};}
test('Stick gauche seul déplace, stick droit seul oriente',()=>{pad=makePad();pad.axes=[0,-1,.5,0];const u=input.poll();assert.equal(u.x,0);assert.equal(u.forward,1);assert(u.lookX>0);pad.axes=[0,0,1,1];const v=input.poll();assert.equal(v.x,0);assert.equal(v.forward,0);});
test('Gâchettes indépendantes du déplacement à pied',()=>{pad=makePad();pad.buttons[7]={pressed:true,value:.8};pad.buttons[6]={pressed:true,value:.3};const u=input.poll();assert.equal(u.forward,0);assert.equal(u.gas,.8);assert.equal(u.brake,.3);assert(u.fire&&u.aim);});
test('Un appui produit une seule action',()=>{pad=makePad();pad.buttons[3]={pressed:true,value:1};assert(input.poll().edges.has('interact'));assert(!input.poll().edges.has('interact'));pad.buttons[3]={pressed:false,value:0};input.poll();pad.buttons[3]={pressed:true,value:1};assert(input.poll().edges.has('interact'));});
test('Déconnexion : mouvement neutralisé et pause',()=>{pad=makePad();pad.axes[1]=-1;input.poll();pad=null;const u=input.poll();assert.equal(u.forward,0);assert.equal(u.gas,0);assert.equal(mode,'pause');assert(toasts.length>0);});
test('Perte de focus : entrées clavier, souris et tactiles libérées',()=>{input.keys.add('KeyW');input.mouse.fire=true;input.touch.gas=1;mode='play';listeners.blur();const u=input.poll();assert.equal(u.forward,0);assert(!u.fire);assert.equal(u.gas,0);assert.equal(mode,'pause');listeners.focus();});
test('Profil Sony brut : caméra sur axes 2/5, gâchettes 3/4',()=>{pad=makePad();pad.mapping='';pad.axes=[0,-1,.6,-1,1,-.6];input.profile='sony';const u=input.poll();assert.equal(u.forward,1);assert(u.lookX>0&&u.lookY<0);assert.equal(u.brake,0);assert.equal(u.gas,1);});
test('Pas de contamination des touches clavier par la manette',()=>{assert.equal(input.keys.size,0);pad=makePad();pad.axes[0]=1;input.poll();assert.equal(input.keys.size,0);pad=null;input.poll();assert.equal(input.keys.size,0);});
console.log(`${count} tests réussis.`);
