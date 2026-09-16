/* Original procedural soundtrack and spatial city sound. No downloads or autoplay. */
(function(M){
'use strict';
const G=M.Game.prototype,KEY='marlon.rebuild.settings',clamp=M.clamp;
const settings=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'{}');}catch{return{};}};
class Soundscape{
 constructor(game){const s=settings();this.game=game;this._enabled=s.sound!==false;this.volume=clamp(Number.isFinite(s.masterVolume)?s.masterVolume:.65,0,1);this.music=s.music!==false;this.musicVolume=clamp(Number.isFinite(s.musicVolume)?s.musicVolume:.24,0,1);this.ctx=null;this.voices=new Set;this.cooldowns=new Map;this.counts={};this.stepDistance=0;this.stepSide=1;this.previous=null;this.musicStep=0;this.nextBeat=0;this.paused=true;this.unlocked=false;
  this.unlock=e=>{if(!e.isTrusted)return;this.unlocked=true;if(this.game.mode==='play')this.start();};document.addEventListener('pointerdown',this.unlock,{passive:true});document.addEventListener('keydown',this.unlock,{passive:true});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)this.pause();else if(this.game.mode==='play')this.start();});
 }
 get enabled(){return this._enabled;}
 set enabled(value){this._enabled=!!value;if(!this._enabled)this.pause();else if(this.game.mode==='play')this.start();this.syncButton();}
 available(){return this.ctx&&this.ctx.state==='running'&&this.enabled&&!this.paused&&!document.hidden&&this.game.mode==='play';}
 start(){if(!this.enabled||document.hidden||this.game.mode!=='play')return;if(!this.unlocked&&!navigator.userActivation?.hasBeenActive)return;
  try{if(!this.ctx)this.build();this.paused=false;this.nextBeat=this.ctx.currentTime+.08;this.ctx.resume().catch(()=>{});this.master.gain.setTargetAtTime(this.volume,this.ctx.currentTime,.08);}catch{this.ctx=null;}this.syncButton();
 }
 build(){const Context=window.AudioContext||window.webkitAudioContext;if(!Context)throw new Error('Web Audio unavailable');const c=this.ctx=new Context;this.master=c.createGain();this.master.gain.value=0;const limiter=c.createDynamicsCompressor();limiter.threshold.value=-12;limiter.knee.value=14;limiter.ratio.value=7;this.master.connect(limiter).connect(c.destination);this.effects=c.createGain();this.effects.gain.value=.48;this.effects.connect(this.master);this.musicBus=c.createGain();this.musicBus.gain.value=this.music?this.musicVolume:0;this.musicBus.connect(this.master);
  const noise=c.createBuffer(1,c.sampleRate*2,c.sampleRate),a=noise.getChannelData(0);let brown=0;for(let i=0;i<a.length;i++){brown=(brown+(Math.random()*2-1)*.04)/1.015;a[i]=brown*3;}this.noiseBuffer=noise;
  const white=c.createBuffer(1,c.sampleRate,c.sampleRate),w=white.getChannelData(0);for(let i=0;i<w.length;i++)w[i]=Math.random()*2-1;this.whiteBuffer=white;
  this.engineLayers=[this.loopOsc('sawtooth',42,340),this.loopOsc('triangle',84,900),this.loopOsc('sine',21,180)];this.rain=this.loopNoise(2400,'highpass',this.whiteBuffer);this.tires=this.loopNoise(1050,'bandpass',this.whiteBuffer);this.wind=this.loopNoise(600,'lowpass',this.noiseBuffer);this.rotor=this.loopOsc('triangle',24,250);
 }
 loopOsc(type,freq,cutoff){const c=this.ctx,o=c.createOscillator(),filter=c.createBiquadFilter(),gain=c.createGain();o.type=type;o.frequency.value=freq;filter.type='lowpass';filter.frequency.value=cutoff;gain.gain.value=0;o.connect(filter).connect(gain).connect(this.effects);o.start();return{source:o,gain,filter};}
 loopNoise(freq,type,buffer){const c=this.ctx,o=c.createBufferSource(),filter=c.createBiquadFilter(),gain=c.createGain();o.buffer=buffer;o.loop=true;filter.type=type;filter.frequency.value=freq;filter.Q.value=.7;gain.gain.value=0;o.connect(filter).connect(gain).connect(this.effects);o.start();return{source:o,gain,filter};}
 pause(){this.paused=true;this.previous=null;this.stepDistance=0;if(!this.ctx)return;for(const voice of this.voices){try{voice.stop();}catch{}}this.voices.clear();this.ctx.suspend().catch(()=>{});}

 note(frequency,duration,volume,type='sine',bus=this.effects,at){if(!this.available()||this.voices.size>=48)return;const c=this.ctx,t=at??c.currentTime,o=c.createOscillator(),gain=c.createGain();o.type=type;o.frequency.setValueAtTime(Math.max(20,frequency),t);gain.gain.setValueAtTime(.0001,t);gain.gain.linearRampToValueAtTime(Math.max(.0002,volume),t+.008);gain.gain.exponentialRampToValueAtTime(.0001,t+duration);o.connect(gain).connect(bus);this.voices.add(o);o.onended=()=>{this.voices.delete(o);o.disconnect();gain.disconnect();};o.start(t);o.stop(t+duration+.015);}
 burst(duration,volume,freq=900,type='lowpass',pan=0,at){if(!this.available()||this.voices.size>=48)return;const c=this.ctx,t=at??c.currentTime,o=c.createBufferSource(),filter=c.createBiquadFilter(),gain=c.createGain();o.buffer=this.whiteBuffer;filter.type=type;filter.frequency.value=freq;filter.Q.value=.8;gain.gain.setValueAtTime(.0001,t);gain.gain.linearRampToValueAtTime(Math.max(.0002,volume),t+.005);gain.gain.exponentialRampToValueAtTime(.0001,t+duration);const nodes=[filter,gain];o.connect(filter).connect(gain);if(c.createStereoPanner){const p=c.createStereoPanner();p.pan.value=clamp(pan,-1,1);gain.connect(p).connect(this.effects);nodes.push(p);}else gain.connect(this.effects);this.voices.add(o);o.onended=()=>{this.voices.delete(o);o.disconnect();for(const n of nodes)n.disconnect();};o.start(t);o.stop(t+duration+.015);}
 tone(f=300,d=.1,v=.3,type='sine'){// Legacy foot taps are superseded by alternating surface footsteps.
  if(f>=75&&f<=95&&d===.055&&v===.045)return;this.note(f,d,Math.min(.25,v),type);
 }
 noise(d=.12,v=.35){if(!this.available())return;const now=this.ctx.currentTime;if(now-(this.cooldowns.get('impact')??-1)<.085)return;this.cooldowns.set('impact',now);this.burst(d,v,1000);}
 tick(){/* Engine is mixed once per rendered frame, independently of fixed simulation steps. */}
 event(kind,amount=1,car){const names={crash:'impact',jack:'carjack'},name=names[kind]||kind;if(!this.available())return;let power=clamp(amount,0,1);if(car&&car!==this.game.vehicle){const d=Math.hypot(car.x-this.game.player.x,car.z-this.game.player.z);power*=Math.max(0,1-d/65);}if(power<.015)return;const now=this.ctx.currentTime,key=name==='impact'?'impact':name,limit=name==='brake'?.45:name==='explosion'?.15:.09;if(now-(this.cooldowns.get(key)??-1)<limit)return;this.cooldowns.set(key,now);this.counts[name]=(this.counts[name]||0)+1;
  if(name==='explosion'){this.note(48,.85,.7*power,'sine');this.note(79,.45,.25*power,'triangle');this.burst(1.3,.8*power,950);this.burst(.3,.4*power,4000,'highpass');}
  else if(name==='impact'){this.note(72,.18,.28*power,'triangle');this.burst(.22,.46*power,1800);this.burst(.18,.1*power,5500,'highpass');}
  else if(name==='brake')this.burst(.25,.1*power,1750,'bandpass');
  else if(name==='door'||name==='carjack'){this.note(116,.09,.12*power,'triangle');this.burst(.1,.15*power,700);}
  else if(name==='land'){this.note(62,.13,.14*power,'triangle');this.burst(.16,.16*power,600);}
  else if(name==='bark'){this.note(210,.12,.1*power,'sawtooth');this.burst(.12,.09*power,750);}
  else if(name==='interaction'){this.note(440,.12,.12*power);this.note(660,.16,.08*power,'sine',this.effects,now+.1);}
 }
 step(surface,speed){if(!this.available())return;this.stepSide*=-1;this.counts.footsteps=(this.counts.footsteps||0)+1;const soft=surface==='grass',power=speed>4?.10:.065;this.burst(soft?.12:.08,power,soft?1300:800,soft?'highpass':'lowpass',this.stepSide*.22);this.note(soft?95:this.stepSide>0?115:128,.045,power*.26,'triangle');}
 sequence(){if(!this.music||!this.available())return;const c=this.ctx,beat=60/96/2;let scheduled=0;while(this.nextBeat<c.currentTime+.12&&scheduled++<3){if(this.nextBeat<c.currentTime-.15)this.nextBeat=c.currentTime+.02;const t=this.nextBeat,n=this.musicStep++%64,chord=[[48,55,60,64],[45,52,57,60],[41,48,53,57],[43,50,55,59]][Math.floor(n/16)],hz=m=>440*Math.pow(2,(m-69)/12);
   if(n%4===0){this.note(hz(chord[0]-12),.26,.11,'triangle',this.musicBus,t);this.note(62,.09,.045,'sine',this.musicBus,t);}
   if(n%8===0)for(const m of chord.slice(1))this.note(hz(m),1.1,.025,'triangle',this.musicBus,t);
   if(n%2===1)this.note(hz(chord[1+(Math.floor(n/2)%3)]+12),.18,.035,'sine',this.musicBus,t);
   this.nextBeat+=beat;
  }
 }
 update(dt){if(!this.available())return;const g=this.game,c=this.ctx,t=c.currentTime,car=g.vehicle,speed=Math.abs(car?.speed||0),gear=Math.min(5,Math.floor(speed/10)),rpm=42+(speed-gear*10)*5+(g.lastInput?.gas||0)*13,drive=car&&car.health>0&&!['bike'].includes(car.spec?.id),throttle=g.lastInput?.gas||0;
  this.master.gain.setTargetAtTime(this.volume,t,.08);this.musicBus.gain.setTargetAtTime(this.music?this.musicVolume:0,t,.08);
  this.engineLayers.forEach((a,i)=>{a.source.frequency.setTargetAtTime(rpm*[1,2,.5][i],t,.07);a.gain.gain.setTargetAtTime(drive?[.065,.035,.055][i]*(.65+throttle*.35):0,t,.09);a.filter.frequency.setTargetAtTime(250+rpm*3,t,.1);});
  this.rotor.gain.gain.setTargetAtTime(g.heliFlying?.065:0,t,.1);this.rotor.source.frequency.setTargetAtTime(22+Math.abs(g.heliSpeed||0)*.3,t,.1);
  const indoors=(g.world.buildings||[]).some(b=>b.floors>0&&Math.abs(g.player.x-b.x)<13.6&&Math.abs(g.player.z-b.z)<13.6&&g.player.y<b.height-.5);this.rain.gain.gain.setTargetAtTime(g.city?.weather==='rain'?(indoors?.025:.13):0,t,.6);this.wind.gain.gain.setTargetAtTime(drive?Math.min(.055,speed*.0012):g.heliFlying?.055:0,t,.2);this.tires.gain.gain.setTargetAtTime(drive&&speed>5?Math.min(.13,(car.braking||0)*.15):0,t,.09);
  const p=g.player,previous=this.previous;this.previous={x:p.x,z:p.z,y:p.y};if(previous&&!car&&!g.heliFlying&&!g.action&&!g.cityTask){const distance=Math.hypot(p.x-previous.x,p.z-previous.z),ground=g.world.groundHeight(p.x,p.z,p.y);if(distance<2&&p.y<=ground+.08&&Math.abs(p.vy)<.3){this.stepDistance+=distance;const pace=Math.hypot(p.vx,p.vz),stride=pace>4?1.22:.84;if(this.stepDistance>stride){this.stepDistance%=stride;const grass=(g.world.services||[]).some(b=>['park','villa','adopt'].includes(b.id)&&Math.hypot(b.x-p.x,b.z-p.z)<16);this.step(grass?'grass':'pavement',pace);}}else this.stepDistance=0;}
  this.sequence();
 }
 syncButton(){const b=document.getElementById('soundToggle');if(b){b.textContent=this.enabled?'SON ACTIVÉ':'SON COUPÉ';b.setAttribute('aria-pressed',String(!this.enabled));b.title=this.enabled?'Couper tous les sons':'Activer les sons';}}
 save(){try{localStorage.setItem(KEY,JSON.stringify({...settings(),sound:this.enabled,masterVolume:this.volume,music:this.music,musicVolume:this.musicVolume}));}catch{}}
}
M.Soundscape=Soundscape;
const init=G.initCity;G.initCity=function(){init.apply(this,arguments);const legacy=this.audio;if(legacy?.ctx)legacy.ctx.close().catch(()=>{});this.audio=this.soundscape=new Soundscape(this);if(!document.getElementById('soundToggle')){const b=document.createElement('button');b.id='soundToggle';b.type='button';b.style.cssText='position:absolute;right:22px;bottom:20px;z-index:24;border:2px solid #ffffff70;border-radius:18px;background:#102852;color:white;padding:9px 13px;font:700 11px system-ui;letter-spacing:.07em;pointer-events:auto';b.onclick=()=>{this.soundscape.unlocked=true;this.soundscape.enabled=!this.soundscape.enabled;this.soundscape.save();};document.getElementById('hud')?.appendChild(b);}this.soundscape.syncButton();};
const mode=G.setMode;G.setMode=function(value){mode.apply(this,arguments);if(this.soundscape){if(value==='play')this.soundscape.start();else this.soundscape.pause();}};
const frame=G.frame;G.frame=function(dt){frame.apply(this,arguments);this.soundscape?.update(Math.min(.1,Math.max(0,dt)));};
if(M.UI){const P=M.UI.prototype,render=P.renderSettings,save=P.saveSettings;P.renderSettings=function(){render.apply(this,arguments);const s=this.g.soundscape;if(!s)return;const grid=document.querySelector('#panelBody .settings-grid');if(!grid)return;const node=document.createElement('div');node.className='setting';node.innerHTML='<label for="masterVolume">Volume général</label><input id="masterVolume" type="range" min="0" max="1" step="0.05">';grid.appendChild(node);const music=document.createElement('div');music.className='setting';music.innerHTML='<label for="cityMusic">Musique originale de la ville</label><input id="cityMusic" type="checkbox"><label for="musicVolume">Volume musique</label><input id="musicVolume" type="range" min="0" max="1" step="0.05">';grid.appendChild(music);document.getElementById('masterVolume').value=s.volume;document.getElementById('masterVolume').oninput=e=>{s.volume=+e.target.value;this.saveSettings();};document.getElementById('cityMusic').checked=s.music;document.getElementById('cityMusic').onchange=e=>{s.music=e.target.checked;this.saveSettings();};document.getElementById('musicVolume').value=s.musicVolume;document.getElementById('musicVolume').oninput=e=>{s.musicVolume=+e.target.value;this.saveSettings();};};P.saveSettings=function(){save.apply(this,arguments);this.g.soundscape?.save();};}
})(Marlon);
