(function(M){
'use strict';
const KEY='marlon.rebuild.save.v3',BACKUP=KEY+'.backup',OLD='marlon.rebuild.save.v2';
const number=(v,min,max,fallback)=>Number.isFinite(v)?M.clamp(v,min,max):fallback;
M.checksum=text=>{let hash=2166136261;for(let i=0;i<text.length;i++){hash^=text.charCodeAt(i);hash=Math.imul(hash,16777619);}return(hash>>>0).toString(16).padStart(8,'0');};
M.validateState=function(s){
 if(!s||s.version!==3||!s.base)return null;const base=M.parseSave(JSON.stringify({...s.base,version:2}));if(!base)return null;
 const pos=a=>({x:number(a.x,-309,309,0),z:number(a.z,-309,309,0),yaw:number(a.yaw,-1e6,1e6,0)});
 const result={version:3,base,time:number(s.time,0,1e9,0),income:number(s.income,0,120,0),raidTimer:number(s.raidTimer,0,300,160),victory:number(s.victory,0,90,0),capture:Array.from({length:12},(_,i)=>number(s.capture?.[i],0,.9999,0)),vehicle:null,cars:[],enemies:[],allies:[],operation:null,raid:null};
 if(!Array.isArray(s.cars)||s.cars.length!==34||!Array.isArray(s.enemies)||s.enemies.length>128||!Array.isArray(s.allies)||s.allies.length>3)return null;
 for(const c of s.cars){if(!c||!Number.isFinite(c.x)||!Number.isFinite(c.z))return null;result.cars.push({...pos(c),health:number(c.health,0,100,100),speed:0,traffic:c.traffic===true,next:Math.round(number(c.next,0,3,0))});}
 for(const e of s.enemies){if(!e||!Number.isInteger(e.home)||e.home<0||e.home>11)return null;result.enemies.push({...pos(e),health:number(e.health,0,80,80),dead:number(e.dead,0,8,0),home:e.home,raid:e.raid===true,cooldown:number(e.cooldown,0,4,1)});}
 for(const a of s.allies){if(!a)return null;result.allies.push({...pos(a),health:number(a.health,0,100,100),downTime:number(a.downTime,0,60,0)});}
 if(Number.isInteger(s.vehicle)&&s.vehicle>=0&&s.vehicle<34&&result.cars[s.vehicle].health>0)result.vehicle=s.vehicle;
 if(s.operation){const o=s.operation;if(!['recon','courier','capture','patrol','defend'].includes(o.type)||!Array.isArray(o.ids)||o.ids.some(i=>!Number.isInteger(i)||i<0||i>11))return null;const index=Math.floor(number(o.index,0,11,0));if(o.type!=='defend'&&(!o.ids.length||index>=o.ids.length))return null;result.operation={type:o.type,ids:o.ids.slice(0,12),index,remaining:number(o.remaining,.01,420,420)};}
 if(s.raid){const r=s.raid;if(!Number.isInteger(r.id)||!base.owned.includes(r.id)||r.id===8)return null;result.raid={id:r.id,warning:number(r.warning,-100,45,45),remaining:number(r.remaining,.01,70,70),spawned:r.spawned===true};}
 return result;
};
class StateStore{
 constructor(storage){this.storage=storage;this.source='none';this.error=null;}
 decode(raw){try{if(typeof raw!=='string'||raw.length>500000)return null;const envelope=JSON.parse(raw);if(envelope.format!=='MARLON-CAMPAIGN'||envelope.checksum!==M.checksum(JSON.stringify(envelope.data)))return null;return M.validateState(envelope.data);}catch{return null;}}
 encode(data){const checked=M.validateState(data);if(!checked)throw new Error('État de campagne invalide.');return JSON.stringify({format:'MARLON-CAMPAIGN',checksum:M.checksum(JSON.stringify(checked)),data:checked},null,2);}
 read(){this.error=null;try{const primary=this.decode(this.storage.getItem(KEY));if(primary){this.source='primary';return primary;}const backup=this.decode(this.storage.getItem(BACKUP));if(backup){this.source='backup';return backup;}const old=M.parseSave(this.storage.getItem(OLD));if(old){this.source='migration';return{version:2,base:old};}}catch(e){this.error=e.message;}this.source='none';return null;}
 write(data){try{const next=this.encode(data),old=this.storage.getItem(KEY);if(this.decode(old))this.storage.setItem(BACKUP,old);this.storage.setItem(KEY,next);this.source='primary';this.error=null;return true;}catch(e){this.error=e.message;return false;}}
 clear(){for(const k of [KEY,BACKUP,OLD])this.storage.removeItem(k);}
}
M.StateStore=StateStore;
})(Marlon);
