/* MARLON / deterministic simulation primitives. No DOM or renderer dependency. */
(function(root){
'use strict';
const M=root.Marlon=root.Marlon||{};
M.clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
M.damp=(a,b,k,dt)=>a+(b-a)*(1-Math.exp(-k*dt));
M.angle=(a,b,k,dt)=>a+Math.atan2(Math.sin(b-a),Math.cos(b-a))*(1-Math.exp(-k*dt));
M.rng=seed=>()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t^=t+Math.imul(t^t>>>7,61|t);return((t^t>>>14)>>>0)/4294967296;};
M.stick=(x,y,d=.17)=>{x=Number.isFinite(x)?x:0;y=Number.isFinite(y)?y:0;const n=Math.hypot(x,y);if(n<=d)return{x:0,y:0};const k=Math.min(1,(n-d)/(1-d))/n;return{x:x*k,y:y*k};};
M.moveVector=(x,forward,yaw)=>{const n=Math.max(1,Math.hypot(x,forward));return{x:(Math.cos(yaw)*x+Math.sin(yaw)*forward)/n,z:(Math.sin(yaw)*x-Math.cos(yaw)*forward)/n};};
M.rayBox=(o,d,b,max=Infinity,pad=0)=>{let lo=0,hi=max;for(const k of ['x','y','z']){const a=b['min'+k]-pad,c=b['max'+k]+pad;if(Math.abs(d[k])<1e-9){if(o[k]<a||o[k]>c)return Infinity;}else{let u=(a-o[k])/d[k],v=(c-o[k])/d[k];if(u>v)[u,v]=[v,u];lo=Math.max(lo,u);hi=Math.min(hi,v);if(lo>hi)return Infinity;}}return lo;};
class Grid{
 constructor(size=25){this.size=size;this.cells=new Map;this.boxes=[];}
 add(b){b.id=this.boxes.length;this.boxes.push(b);for(let x=Math.floor(b.minx/this.size);x<=Math.floor(b.maxx/this.size);x++)for(let z=Math.floor(b.minz/this.size);z<=Math.floor(b.maxz/this.size);z++){const k=x+','+z;if(!this.cells.has(k))this.cells.set(k,[]);this.cells.get(k).push(b);}return b;}
 around(x,z,r=3){const s=new Set;for(let a=Math.floor((x-r)/this.size);a<=Math.floor((x+r)/this.size);a++)for(let b=Math.floor((z-r)/this.size);b<=Math.floor((z+r)/this.size);b++)for(const o of this.cells.get(a+','+b)||[])s.add(o);return [...s];}
 free(x,z,r=.4,y=0){return !this.around(x,z,r).some(b=>b.maxy>y+.2&&b.miny<y+1.7&&x>b.minx-r&&x<b.maxx+r&&z>b.minz-r&&z<b.maxz+r);}
 move(p,dx,dz,r=.4){const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.3));let hit=false;for(let i=0;i<steps;i++){let x=M.clamp(p.x+dx/steps,-309,309),z=M.clamp(p.z+dz/steps,-309,309);if(this.free(x,p.z,r,p.y||0))p.x=x;else hit=true;if(this.free(p.x,z,r,p.y||0))p.z=z;else hit=true;}return hit;}
 ray(o,d,max,pad=0){let best=max;for(const b of this.around(o.x+d.x*max/2,o.z+d.z*max/2,max/2+pad+3)){const t=M.rayBox(o,d,b,max,pad);if(t<best)best=t;}return best;}
}
M.Grid=Grid;
M.drive=(c,u,dt)=>{const old=c.speed;let a=u.gas*10;if(u.brake>0)a-=u.brake*(c.speed>.6?22:7);if(c.speed<-.6&&u.gas>.1)a=u.gas*18;c.speed=M.clamp(c.speed+a*dt,-9,42);c.speed*=Math.exp(-(u.handbrake?2.3:.18)*dt);if(!u.gas&&!u.brake){c.speed*=Math.exp(-.32*dt);if(Math.abs(c.speed)<.08)c.speed=0;}const steering=u.steer*.53/(1+Math.abs(c.speed)*.024);c.steer=M.damp(c.steer||0,steering,9,dt);c.yaw+=Math.tan(c.steer)*c.speed/2.8*dt*(u.handbrake?1.5:1);c.dx=Math.sin(c.yaw)*c.speed*dt;c.dz=-Math.cos(c.yaw)*c.speed*dt;return Math.abs(c.speed-old);};
M.territories=()=>{const names=['Docks Nord','La Verrière','Les Hauts','Belvédère','Port industriel','Saint-Roch','Centre financier','Eastside','Les Forges','La République','Grand Marché','Terminal Sud'];return names.map((name,i)=>({id:i,name,col:i%4,row:Math.floor(i/4),x:-225+(i%4)*150,z:-200+Math.floor(i/4)*200,owner:i===8?'player':i%3===0?'cendre':'onyx',level:0,capture:0}));};
M.adjacent=(a,b)=>Math.abs(a.col-b.col)+Math.abs(a.row-b.row)===1;
M.canAttack=(sectors,t)=>t.owner!=='player'&&sectors.some(s=>s.owner==='player'&&M.adjacent(s,t));
M.newSave=()=>({version:2,cash:900,rep:0,ammo:120,mag:24,health:100,x:-225,z:250,yaw:0,owned:[8],levels:{},completed:[],squad:0,won:false});
M.parseSave=text=>{try{const a=JSON.parse(text);if(a?.version!==2)return null;const s=M.newSave();for(const k of ['cash','rep','ammo','mag','health','x','z','yaw'])if(Number.isFinite(a[k]))s[k]=a[k];s.cash=M.clamp(s.cash,0,1e8);s.health=M.clamp(s.health,1,100);s.mag=M.clamp(Math.floor(s.mag),0,24);s.ammo=M.clamp(Math.floor(s.ammo),0,999);s.x=M.clamp(s.x,-309,309);s.z=M.clamp(s.z,-309,309);s.owned=Array.isArray(a.owned)?[...new Set(a.owned.filter(i=>Number.isInteger(i)&&i>=0&&i<12))]:[8];if(!s.owned.length)s.owned=[8];s.levels=Object.fromEntries(Object.entries(a.levels||{}).filter(([k,v])=>Number.isInteger(+k)&&+k>=0&&+k<12&&Number.isInteger(v)&&v>=0&&v<=3));s.completed=Array.isArray(a.completed)?a.completed.filter(i=>['recon','courier','capture','patrol','defend'].includes(i)):[];s.squad=Number.isInteger(a.squad)?M.clamp(a.squad,0,3):0;s.won=a.won===true;return s;}catch{return null;}};
if(typeof module!=='undefined')module.exports=M;
})(typeof window==='undefined'?globalThis:window);
