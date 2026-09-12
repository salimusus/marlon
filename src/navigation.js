(function(M){
'use strict';
class Heap{constructor(){this.a=[];}push(n){let i=this.a.push(n)-1;while(i>0){const p=(i-1)>>1;if(this.a[p].f<=n.f)break;this.a[i]=this.a[p];i=p;}this.a[i]=n;}pop(){const root=this.a[0],end=this.a.pop();if(this.a.length){let i=0;while(i*2+1<this.a.length){let c=i*2+1;if(c+1<this.a.length&&this.a[c+1].f<this.a[c].f)c++;if(this.a[c].f>=end.f)break;this.a[i]=this.a[c];i=c;}this.a[i]=end;}return root;}}
class Navigation{
 constructor(grid,step=2){this.grid=grid;this.step=step;this.cache=new Map;this.budget=2;}
 clearLine(a,b,r=.45){const dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz);return len<.01||this.grid.ray({x:a.x,y:1,z:a.z},{x:dx/len,y:0,z:dz/len},len,r)>=len-.01;}
 free(x,z){const k=x+','+z;if(!this.cache.has(k))this.cache.set(k,Math.abs(x*this.step)<308&&Math.abs(z*this.step)<308&&this.grid.free(x*this.step,z*this.step,.5));return this.cache.get(k);}
 nearest(p){const x=Math.round(p.x/this.step),z=Math.round(p.z/this.step);for(let r=0;r<=3;r++)for(let dx=-r;dx<=r;dx++)for(let dz=-r;dz<=r;dz++)if(this.free(x+dx,z+dz)&&this.clearLine(p,{x:(x+dx)*this.step,z:(z+dz)*this.step}))return{x:x+dx,z:z+dz};return null;}
 find(from,to,max=6500){if(this.clearLine(from,to))return[{x:to.x,z:to.z}];const start=this.nearest(from),end=this.nearest(to);if(!start||!end)return[];const key=(x,z)=>x+','+z,goal=key(end.x,end.z),open=new Heap,seen=new Map;let count=0;const h=(x,z)=>Math.hypot(end.x-x,end.z-z);const first={...start,g:0,f:h(start.x,start.z),parent:null};open.push(first);seen.set(key(start.x,start.z),first);
 while(open.a.length&&count++<max){const n=open.pop();if(n.closed)continue;n.closed=true;if(key(n.x,n.z)===goal){const result=[{x:to.x,z:to.z}];for(let q=n;q.parent;q=q.parent)result.push({x:q.x*this.step,z:q.z*this.step});return result.reverse();}
 for(const [dx,dz]of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){const x=n.x+dx,z=n.z+dz;if(!this.free(x,z)||dx&&dz&&(!this.free(n.x+dx,n.z)||!this.free(n.x,n.z+dz)))continue;const k=key(x,z),g=n.g+Math.hypot(dx,dz),old=seen.get(k);if(old&&old.g<=g)continue;const q={x,z,g,f:g+h(x,z),parent:n};seen.set(k,q);open.push(q);}}
 return[];}
 direction(actor,target,time){if(this.clearLine(actor,target))return{x:target.x-actor.x,z:target.z-actor.z};if((!actor.path||time>(actor.pathAt||0))&&this.budget>0){this.budget--;actor.path=this.find(actor,target);actor.pathAt=time+1.5;actor.pathIndex=0;}
 const path=actor.path||[];while(actor.pathIndex<path.length&&Math.hypot(path[actor.pathIndex].x-actor.x,path[actor.pathIndex].z-actor.z)<.65)actor.pathIndex++;const point=path[actor.pathIndex];if(!point)return{x:0,z:0};return{x:point.x-actor.x,z:point.z-actor.z};}
}
M.Navigation=Navigation;
})(Marlon);
