(function(M){
'use strict';
class Input{
 constructor(canvas){this.keys=new Set;this.edges=new Set;this.mouse={x:0,y:0,fire:false,aim:false};this.prev=[];this.pad=null;this.deadzone=.17;this.sensitivity=1;this.invert=false;this.profile='auto';this.active=true;this.touch={x:0,y:0,rx:0,ry:0,fire:false,aim:false,gas:0,brake:0};this.last='keyboard';
 const map={KeyE:'interact',KeyR:'reload',KeyF:'melee',KeyM:'map',KeyJ:'missions',Escape:'pause',KeyC:'recenter',Space:'jump',KeyG:'weapon',KeyH:'heal',KeyB:'recruit'};
 addEventListener('keydown',e=>{if(/INPUT|SELECT|TEXTAREA/.test(e.target.tagName))return;if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Tab'].includes(e.code))e.preventDefault();if(!this.keys.has(e.code)&&map[e.code])this.edges.add(map[e.code]);this.keys.add(e.code);this.last='keyboard';});
 addEventListener('keyup',e=>this.keys.delete(e.code));
 canvas.addEventListener('mousedown',e=>{this.mouse.fire=e.button===0;this.mouse.aim=e.button===2;this.last='mouse';if(M.game?.mode==='play'&&!document.pointerLockElement)canvas.requestPointerLock?.();});
 addEventListener('mouseup',e=>{if(e.button===0)this.mouse.fire=false;if(e.button===2)this.mouse.aim=false;});
 addEventListener('mousemove',e=>{if(document.pointerLockElement===canvas){this.mouse.x+=e.movementX;this.mouse.y+=e.movementY;}});
 canvas.addEventListener('contextmenu',e=>e.preventDefault());
 addEventListener('blur',()=>{this.active=false;this.clear();if(M.game?.mode==='play')M.game.setMode('pause');});addEventListener('focus',()=>{this.active=true;});
 document.addEventListener('visibilitychange',()=>{if(document.hidden){this.active=false;this.clear();if(M.game?.mode==='play')M.game.setMode('pause');}else this.active=true;});
 addEventListener('gamepaddisconnected',()=>{this.prev=[];this.pad=null;if(this.last==='pad'&&M.game?.mode==='play'){this.clear();M.game.setMode('pause');M.game.toast('Manette déconnectée — jeu en pause.');}});
 }
 clear(){this.keys.clear();this.edges.clear();this.mouse={x:0,y:0,fire:false,aim:false};this.touch={x:0,y:0,rx:0,ry:0,fire:false,aim:false,gas:0,brake:0};}
 poll(){let pads=[];try{pads=[...(navigator.getGamepads?.()||[])];}catch{}const p=pads.find(p=>p?.connected&&p.mapping==='standard')||pads.find(p=>p?.connected);const was=this.pad;this.pad=p||null;
 if(was&&!p&&this.last==='pad'&&M.game?.mode==='play'){this.clear();M.game.setMode('pause');M.game.toast('Manette déconnectée — jeu en pause.');}
 const key=k=>this.keys.has(k);let left={x:0,y:0},right={x:0,y:0},b=[],v=[];
 if(p&&this.active){let raw=this.profile==='sony'||(this.profile==='auto'&&!p.mapping&&/054c|dualsense|sony|wireless controller/i.test(p.id));this.mapping=raw?'Sony HID':p.mapping||'Non reconnu : choisir un profil';
 let order=raw?[1,2,0,3,4,5,6,7,8,9,10,11,14,15,16,17,12,13]:Array.from({length:18},(_,i)=>i);
 v=order.map(i=>M.clamp(p.buttons[i]?.value||0,0,1));b=order.map((i,j)=>!!p.buttons[i]?.pressed||v[j]>.5);
 left=M.stick(p.axes[0],p.axes[1],this.deadzone);right=M.stick(p.axes[2],p.axes[raw?5:3],this.deadzone);
 if(raw){v[6]=M.clamp(((p.axes[3]??-1)+1)/2,0,1);v[7]=M.clamp(((p.axes[4]??-1)+1)/2,0,1);b[6]=v[6]>.5;b[7]=v[7]>.5;}
 const map={0:'weapon',1:'jump',2:'melee',3:'interact',8:'missions',9:'pause',11:'recenter',12:'recruit',13:'heal',14:'reload',17:'map'};
 for(const [i,act]of Object.entries(map))if(b[i]&&!this.prev[i])this.edges.add(act);
 if(Math.hypot(left.x,left.y)>.05||Math.hypot(right.x,right.y)>.05||b.some(Boolean))this.last='pad';
 }
 this.prev=b;const x=(key('KeyD')||key('ArrowRight')?1:0)-(key('KeyA')||key('KeyQ')||key('ArrowLeft')?1:0),y=(key('KeyW')||key('KeyZ')||key('ArrowUp')?1:0)-(key('KeyS')||key('ArrowDown')?1:0);
 const out={x:M.clamp(x+left.x+this.touch.x,-1,1),forward:M.clamp(y-left.y-this.touch.y,-1,1),lookX:right.x,lookY:right.y,mouseX:this.mouse.x,mouseY:this.mouse.y,aim:this.mouse.aim||v[6]>.12||this.touch.aim,fire:this.mouse.fire||v[7]>.15||key('KeyX')||this.touch.fire,sprint:key('ShiftLeft')||key('ShiftRight')||b[10],gas:Math.max(y>0?1:0,v[7]||0,this.touch.gas),brake:Math.max(y<0?1:0,v[6]||0,this.touch.brake),steer:M.clamp(x+left.x+this.touch.x,-1,1),handbrake:key('Space')||b[5],edges:new Set(this.edges)};
 this.edges.clear();this.mouse.x=0;this.mouse.y=0;return out;
 }
 vibrate(power=.2,time=80){try{const p=this.pad?.vibrationActuator;p?.playEffect('dual-rumble',{duration:time,strongMagnitude:power,weakMagnitude:power*.5})?.catch(()=>{});}catch{}}
}
M.Input=Input;
})(Marlon);
