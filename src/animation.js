/* Animation layers: locomotion, ground contact, upper-body actions and reactions. */
(function(M){
'use strict';const T=THREE,TAU=Math.PI*2;
const smooth=x=>{x=M.clamp(x,0,1);return x*x*(3-2*x);};
const pulse=(x,a,b)=>smooth((x-a)/Math.max(.001,b-a));
// Analytic two-bone IK. The pole defines the knee bend direction; segment lengths are invariant.
M.solveLimb=function(target,l1,l2,pole=new T.Vector3(0,0,1)){
 const d=M.clamp(target.length(),Math.abs(l1-l2)+.001,l1+l2-.001),axis=target.clone().normalize();
 if(axis.lengthSq()<.5)axis.set(0,-1,0);
 let bend=pole.clone().addScaledVector(axis,-pole.dot(axis));if(bend.lengthSq()<1e-5)bend.set(1,0,0).addScaledVector(axis,-axis.x);bend.normalize();
 const along=(l1*l1-l2*l2+d*d)/(2*d),height=Math.sqrt(Math.max(0,l1*l1-along*along));
 const knee=axis.clone().multiplyScalar(along).addScaledVector(bend,height),foot=axis.clone().multiplyScalar(d);
 const upper=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,-1,0),knee.clone().normalize());
 const local=foot.clone().sub(knee).applyQuaternion(upper.clone().invert()).normalize();
 const lower=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,-1,0),local);
 return{upper,lower,knee,foot};
};
class Animator{
 constructor(rig){this.rig=rig;this.phase=0;this.speed=0;this.aim=0;this.armed=0;this.land=0;this.wasAir=false;this.state='idle';this.events=[];this.lastStep=-1;this.elapsed=0;this.death=0;this.lastPose={};}
 update(info,dt,time){dt=M.clamp(dt,0,.1);this.events=[];const a=this.rig,air=!!info.air,dead=!!info.dead,down=!!info.down;
 this.speed=M.damp(this.speed,Math.max(0,info.speed||0),info.speed>this.speed?9:14,dt);this.aim=M.damp(this.aim,info.aim?1:0,12,dt);this.armed=M.damp(this.armed,info.armed?1:0,12,dt);
 if(this.wasAir&&!air){this.land=Math.min(1,.25+Math.abs(info.landingSpeed||0)*.08);this.events.push('land');}this.wasAir=air;this.land=M.damp(this.land,0,10,dt);
 const run=M.clamp((this.speed-2.5)/3.5,0,1),move=M.clamp(this.speed/.6,0,1),stride=1.65+run*.85;
 if(!air&&!dead&&!info.seated&&!info.enter&&!info.revive)this.phase+=this.speed*dt/stride*TAU;
 const step=Math.floor(this.phase/Math.PI);if(step!==this.lastStep&&move>.5&&!air){this.events.push(step%2?'stepR':'stepL');this.lastStep=step;}
 const reload=info.reload>0,melee=info.melee>0,hit=Math.min(1,(info.hit||0)*3),recoil=M.clamp(info.recoil||0,0,1);
 this.state=dead?'death':down?'down':info.revive?'revive':info.enter?'vehicle-transition':info.seated?'driving':air?(info.vy>0?'jump':'fall'):this.land>.15?'landing':reload?'reload':melee?'melee':this.aim>.5?(move>.2?'aim-move':'aim'):move<.1?'idle':run>.45?'run':'walk';
 this.elapsed+=dt;this.death=dead?M.clamp(this.death+dt/1.0,0,1):0;
 const pitch=M.clamp(info.pitch||0,-.7,.8),s=Math.sin(this.phase),bounce=Math.abs(Math.cos(this.phase));
 let pelvis=-.02-move*(.045+run*.03)-this.land*.12,lean=run*.10,roll=-M.clamp(info.strafe||0,-1,1)*move*.05,twist=-s*.045*move;
 let lx=-s*(.38+run*.3)*move,rx=-lx,lz=.07,rz=-.07,le=-.22,re=-.22,ly=0,ry=0;
 a.head.rotation.y=M.damp(a.head.rotation.y,this.aim*.06+Math.sin(time*.42)*.06*(1-move),8,dt);
 a.head.rotation.x=M.damp(a.head.rotation.x,-pitch*this.aim*.5,10,dt);
 if(this.armed>.01){rx=rx*(1-this.armed)+(-.45-(.96+pitch)*this.aim)*this.armed;re=-.65*(1-this.aim)-.08*this.aim;
 lx=lx*(1-this.aim)+(-1.05-pitch)*this.aim;le=-.2-.5*this.aim;lz-=this.aim*.36;ly=-.32*this.aim;rz-=this.aim*.03;}
 if(reload){const q=M.clamp(info.reloadProgress||0,0,1);rx=-.6;re=-1.1;rz=-.15;lx=-.30-.82*(pulse(q,.05,.25)-pulse(q,.72,.95));le=-.5-.8*Math.sin(q*Math.PI);lz=-.5*Math.sin(q*Math.PI);ly=-.35;twist=.13*Math.sin(q*Math.PI);}
 if(melee){const q=M.clamp(info.meleeProgress||0,0,1),strike=pulse(q,.08,.35)*(1-pulse(q,.5,1)),wind=Math.sin(q*Math.PI);const left=info.combo%2===0;
 if(left){lx=-1.8*strike+.3*(1-strike);le=-.25*(1-strike);ly=.3;rx=-.55;re=-1.1;}else{rx=-1.8*strike+.3*(1-strike);re=-.25*(1-strike);ry=-.3;lx=-.55;le=-1.1;}twist=(left?-1:1)*wind*.32;lean+=strike*.09;}
 rx-=recoil*.18;re-=recoil*.24;lean-=recoil*.025;roll+=hit*Math.sin(time*37)*.04;
 if(info.seated||info.enter){const seated=info.seated?1:smooth(info.enterProgress||0);pelvis-=.4*seated;lean=-.05*seated;lx=rx=-1.1*seated;le=re=-.65*seated;ly=-.16*seated;ry=.16*seated;lz=.05;rz=-.05;twist=(info.steer||0)*.1;}
 if(info.revive||down){pelvis=-.42;lean=.24;lx=-.6;rx=-.85;le=-.6;re=-.65;}
 if(dead){const q=smooth(this.death);pelvis=.1*q;roll=1.45*q;lean=.15*q;twist=0;lx=-.6*q;rx=.4*q;le=-.6;re=-.4;}
 a.body.position.y=M.damp(a.body.position.y,pelvis+move*bounce*.018+Math.sin(time*2.2)*.004*(1-move),18,dt);
 a.body.rotation.set(lean,twist,roll);
 // Foot targets follow the direction of travel even while the upper body faces the aim direction.
 const localForward=info.forward===undefined?1:M.clamp(info.forward,-1,1),localSide=M.clamp(info.strafe||0,-1,1);
 for(let i=0;i<2;i++){
  const hip=i?a.r:a.l,knee=i?a.rk:a.lk,ankle=i?a.rf:a.lf,phase=this.phase+i*Math.PI,wave=Math.sin(phase),lift=Math.max(0,Math.cos(phase))*(.105+run*.085)*move;
  let z=.035+wave*(.25+run*.16)*move*localForward,x=wave*.2*move*localSide;
  let y=.048-a.body.position.y+lift-hip.position.y;
  if(air){z=i?.16:-.18;y=-.6+Math.max(0,-(info.vy||0))*.005;}
  if(info.seated||info.enter){const w=info.seated?1:smooth(info.enterProgress||0);z=z*(1-w)+.50*w;y=y*(1-w)-.38*w;x*=1-w;}
  if(info.revive||down){z=i?-.36:.3;y=i?-.34:-.43;x=0;}
  if(dead){z=i?.15:-.1;y=-.82;x=i?.05:-.05;}
  const groundOffset=info.footGround?.[i]||0;y+=groundOffset;
  const solution=M.solveLimb(new T.Vector3(x,y,z),.46,.44);
  hip.quaternion.slerp(solution.upper,1-Math.exp(-24*dt));knee.quaternion.slerp(solution.lower,1-Math.exp(-24*dt));
  if(ankle){const upright=hip.quaternion.clone().multiply(knee.quaternion).invert();ankle.quaternion.slerp(upright,1-Math.exp(-24*dt));}
 }
 a.la.rotation.set(lx,ly,lz);a.ra.rotation.set(rx,ry,rz);a.le.rotation.x=le;a.re.rotation.x=re;
 a.gun.visible=!!info.armed&&!dead&&!down&&!info.seated&&!info.enter&&!info.revive;
 if(a.magazine)a.magazine.visible=reload&&(info.reloadProgress||0)>.22&&(info.reloadProgress||0)<.67;
 return this.state;
 }
}
M.Animator=Animator;
M.animateCharacter=function(a,speed,dt,time,armed=false,aim=false,melee=0,hit=0,context={}){
 if(!a.animator)a.animator=new Animator(a);return a.animator.update({speed,armed,aim,melee,hit,...context},dt,time);
};
})(Marlon);
