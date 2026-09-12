(function(M){
'use strict';
const T=THREE;
const V=(x,y,z)=>new T.Vector3(x,y,z);
M.mat=(c,r=.7,m=0)=>new T.MeshStandardMaterial({color:new T.Color(c).convertSRGBToLinear(),roughness:r,metalness:m});
M.box=(parent,w,h,d,x,y,z,mat)=>{const m=new T.Mesh(new T.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;};
M.mesh=(parent,geo,mat,x=0,y=0,z=0)=>{const m=new T.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;};
function texCanvas(w,h,draw){const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);const t=new T.CanvasTexture(c);t.encoding=T.sRGBEncoding;t.anisotropy=4;return t;}
function facade(type,seed){const rng=M.rng(seed);const bright=['#908376','#ab9d8a','#5f646b','#514c48'][type];return texCanvas(512,1024,(c,w,h)=>{c.fillStyle=bright;c.fillRect(0,0,w,h);for(let i=0;i<25000;i++){c.fillStyle=rng()>.5?'rgba(255,255,255,.045)':'rgba(0,0,0,.05)';c.fillRect(rng()*w,rng()*h,1+rng()*3,1+rng()*2);}const cols=type===2?8:5,rows=type===2?16:10,sw=w/cols,sh=h/rows;
 for(let row=0;row<rows;row++){c.fillStyle='rgba(0,0,0,.24)';c.fillRect(0,row*sh,w,3);for(let col=0;col<cols;col++){const x=col*sw+sw*.16,y=row*sh+sh*.15,ww=sw*.68,hh=sh*.7;const lit=rng()>.62;c.fillStyle='#222a30';c.fillRect(x-3,y-3,ww+6,hh+7);const g=c.createLinearGradient(x,y,x+ww,y+hh);g.addColorStop(0,lit?'#bfa879':'#647880');g.addColorStop(.3,lit?'#e6ce94':'#3f535e');g.addColorStop(1,lit?'#8c7355':'#172c3b');c.fillStyle=g;c.fillRect(x,y,ww,hh);if(lit){c.fillStyle='rgba(38,28,26,.25)';for(let a=0;a<4;a++)c.fillRect(x+a*ww/4,y,ww/10,hh);}c.fillStyle='#40464a';c.fillRect(x+ww/2-1,y,2,hh);c.fillRect(x,y+hh*.65,ww,2);c.fillStyle='#b1a591';c.fillRect(x-4,y+hh+2,ww+8,4);c.fillStyle='rgba(0,0,0,.18)';c.fillRect(x-3,y+hh+6,ww+8,5);}}
 });}
function sign(text,color='#e8c990',bg='#14222a',w=512,h=128){return texCanvas(w,h,(c)=>{c.fillStyle=bg;c.fillRect(0,0,w,h);c.strokeStyle=color;c.lineWidth=3;c.strokeRect(8,8,w-16,h-16);c.fillStyle=color;c.textAlign='center';c.textBaseline='middle';c.font=`600 ${Math.min(62,480/text.length*1.6)}px sans-serif`;c.fillText(text,w/2,h/2);});}
class World{
 constructor(scene){this.scene=scene;this.grid=new M.Grid;this.rng=M.rng(187);this.batches=new Map;this.geo={box:new T.BoxGeometry(1,1,1),sphere:new T.SphereGeometry(1,10,8),cylinder:new T.CylinderGeometry(1,1,1,8)};this.mats={stone:M.mat('#8a8883'),concrete:M.mat('#777a79'),edge:M.mat('#b0aba0'),dark:M.mat('#202b31',.55,.5),glass:M.mat('#335364',.22,.65),bark:M.mat('#524a3e'),leaf:M.mat('#35453a'),leaf2:M.mat('#475341'),white:M.mat('#d6d1b8'),yellow:M.mat('#c4a05c'),roof:M.mat('#343d40'),water:M.mat('#344c59',.13,.65),brick:M.mat('#5d4940')};this.build();}
 stamp(kind,mat,x,y,z,w,h,d,ry=0){const key=kind+':'+mat.uuid;if(!this.batches.has(key))this.batches.set(key,{geo:this.geo[kind],mat,items:[]});this.batches.get(key).items.push({x,y,z,w,h,d,ry});}
 b(mat,x,y,z,w,h,d,ry=0){this.stamp('box',mat,x,y,z,w,h,d,ry);}
 groundHeight(x,z){const a=((x+300)%50+50)%50,b=((z+300)%50+50)%50;return a>8.6&&a<41.4&&b>8.6&&b<41.4?.22:0;}
 obstacle(x,z,w,d,h){return this.grid.add({minx:x-w/2,maxx:x+w/2,miny:0,maxy:h,minz:z-d/2,maxz:z+d/2});}
 label(text,x,y,z,width=8,ry=0,color){const m=new T.Mesh(new T.PlaneGeometry(width,width/4),new T.MeshStandardMaterial({map:sign(text,color),roughness:.5,emissive:color||'#d3a971',emissiveIntensity:.15}));m.position.set(x,y,z);m.rotation.y=ry;this.scene.add(m);}
 tree(x,z){const a=3+this.rng()*1.2;this.stamp('cylinder',this.mats.bark,x,a/2,z,.13,a,.13);for(let i=0;i<4;i++)this.stamp('foliage',this.foliageMat,x,a+.75,z,4.4,4.4,1,i*Math.PI/4);this.b(this.mats.dark,x,.16,z,2,.25,2);this.obstacle(x,z,.3,.3,a);}
 lamp(x,z,ry=0){const m=this.mats;this.stamp('cylinder',m.dark,x,3.5,z,.07,7,.07);this.b(m.dark,x+Math.sin(ry)*.7,7,z+Math.cos(ry)*.7,.1,.1,1.6,ry);this.b(this.lampMat,x+Math.sin(ry)*1.3,6.96,z+Math.cos(ry)*1.3,.38,.08,.68,ry);}
 building(x,z,w,d,h,type,idx){const mat=this.facades[type];this.b(mat,x,h/2+.2,z,w,h,d);this.obstacle(x,z,w,d,h+.2);const m=this.mats;this.b(m.roof,x,h+.28,z,w+.25,.35,d+.25);this.b(m.edge,x,h+.52,z,w+.6,.12,d+.6);this.b(m.stone,x,1.8,z,w+.3,3.6,d+.3);
 const floors=Math.floor(h/3.5);if(type!==2)for(let i=1;i<floors;i++){this.b(m.edge,x,3.5*i+.3,z,w+.22,.13,d+.22);}
 for(const s of [-1,1]){this.b(m.dark,x+s*w/2,1.5,z,.15,2.8,d*.65);this.b(m.glass,x,1.5,z+s*(d/2+.17),w*.78,2.65,.08);for(let k=-1;k<=1;k++){this.b(m.dark,x+k*w/3,1.55,z+s*(d/2+.23),.08,2.8,.08);}this.b(m.dark,x,.24,z+s*(d/2+.4),w+1,.35,.7);}
 for(let i=0;i<2;i++){this.b(m.concrete,x+(i-.5)*w*.5,h+.8,z-1,2.5,1.1,2);this.b(m.dark,x+(i-.5)*w*.5,h+1.39,z-1,2,.08,1.5);}
 if(idx%4===0){this.b(m.dark,x+w/2+.3,h*.5,z,.6,h-1,.16);for(let j=4;j<h;j+=3.5){this.b(m.dark,x+w/2+.8,j,z,1.6,.1,3);this.b(m.dark,x+w/2+1.6,j+.6,z,.06,1.2,3);}}
 if(idx%9===0)this.label(['ATELIER 09','LE COMPTOIR','RÉPUBLIQUE','HÔTEL MARLON','PHARMACIE'][idx%5],x,3,z+d/2+.23,Math.min(w-1,10),0,idx%2?'#a7c9c5':'#dabb85');
 }
 build(){const s=this.scene,m=this.mats;this.lampMat=new T.MeshStandardMaterial({color:'#ffe4b1',emissive:'#ffd391',emissiveIntensity:2.5});
 this.geo.foliage=new T.PlaneGeometry(1,1);const foliage=texCanvas(512,512,(c,w,h)=>{const r=M.rng(891);c.strokeStyle='#645449';c.lineWidth=6;for(let i=0;i<30;i++){c.beginPath();c.moveTo(256,460);c.quadraticCurveTo(256+(r()-.5)*100,300,70+r()*372,70+r()*260);c.stroke();}for(let i=0;i<4200;i++){const a=r()*Math.PI*2,rad=Math.sqrt(r()),x=256+Math.cos(a)*rad*210,y=240+Math.sin(a)*rad*220;if(r()<.07)continue;c.fillStyle=['#415d3d','#586e49','#6c8056','#324b36','#7a8760'][Math.floor(r()*5)];c.save();c.translate(x,y);c.rotate(r()*6.28);c.beginPath();c.ellipse(0,0,3+r()*4,1.5+r()*3,0,0,Math.PI*2);c.fill();c.restore();}});this.foliageMat=new T.MeshStandardMaterial({map:foliage,alphaTest:.5,side:T.DoubleSide,roughness:1});
 this.facades=[0,1,2,3].map((i)=>new T.MeshStandardMaterial({map:facade(i,50+i),roughness:i===2?.32:.82,metalness:i===2?.48:.05}));
 const asphalt=texCanvas(256,256,(c,w,h)=>{c.fillStyle='#42484c';c.fillRect(0,0,w,h);const rng=M.rng(922);for(let i=0;i<26000;i++){c.fillStyle=rng()>.5?'rgba(170,174,171,.11)':'rgba(0,0,0,.12)';c.fillRect(rng()*w,rng()*h,1,1);}c.strokeStyle='#31383a';c.beginPath();c.moveTo(12,20);c.lineTo(60,75);c.lineTo(66,122);c.lineTo(92,169);c.stroke();});asphalt.wrapS=asphalt.wrapT=T.RepeatWrapping;asphalt.repeat.set(85,85);
 const floor=new T.Mesh(new T.PlaneGeometry(660,660),new T.MeshStandardMaterial({map:asphalt,roughness:.48,metalness:.15}));floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;s.add(floor);
 this.b(m.water,0,-.8,-369,1000,.3,100);this.b(m.concrete,0,.1,-317,638,.5,10);
 let idx=0;
 for(let x=-300;x<300;x+=50)for(let z=-300;z<300;z+=50){const cx=x+25,cz=z+25;this.b(m.stone,cx,.04,cz,33,.12,33);this.b(m.edge,cx,.14,cz,32.7,.15,32.7);
 const plaza=(Math.abs(cx)%150===75&&Math.abs(cz)%200===25)||((x===-250||x===-200)&&z===250);
 if(plaza){this.b(m.concrete,cx,.25,cz,20,.12,20);for(const dx of [-10,10])for(const dz of [-10,10])this.tree(cx+dx,cz+dz);this.b(m.dark,cx,.55,cz,7,.8,4);this.b(m.water,cx,.98,cz,6.6,.1,3.6);this.obstacle(cx,cz,7,4,1);for(let i=-1;i<=1;i++){this.b(m.dark,cx+i*5,.65,cz+10,3,.7,.6);this.obstacle(cx+i*5,cz+10,3,.6,1);}continue;}
 const downtown=x>=0&&x<150&&z>=-100&&z<100;
 for(let p=0;p<2;p++){const bx=cx+(p===0?-8.2:8.2),bz=cz+(this.rng()-.5)*2;const w=12+this.rng()*2,d=22+this.rng()*5,h=downtown?32+this.rng()*40:9+Math.floor(this.rng()*8)*3.5;this.building(bx,bz,w,d,h,downtown?2:idx%4,idx++);}
 if(idx%4===0)this.tree(cx,cz+14);
 }
 for(let k=-300;k<=300;k+=50){for(let q=-303;q<310;q+=10){this.b(m.yellow,k-.12,.017,q,.12,.014,4.5);this.b(m.yellow,k+.12,.017,q,.12,.014,4.5);this.b(m.yellow,q,.017,k-.12,4.5,.014,.12);this.b(m.yellow,q,.017,k+.12,4.5,.014,.12);}
 for(let q=-300;q<=300;q+=50){for(let j=-5;j<=5;j+=2){this.b(m.white,k+j,.023,q+8,1.1,.012,3);this.b(m.white,k+8,.023,q+j,3,.012,1.1);}if((q+k)%100===0)this.lamp(k+9,q+9,Math.PI);}}
 // Railway and an industrial waterfront with cranes and original container markings.
 for(let x=-290;x<280;x+=30){this.b(m.dark,x,.34,-310,28,.1,.1);this.b(m.dark,x,.34,-313,28,.1,.1);for(let j=0;j<15;j++)this.b(m.bark,x-14+j*2,.23,-311.5,.28,.15,4);}
 for(let i=0;i<16;i++){const x=-290+i*12;this.b(i%2?m.brick:m.glass,x,1.8,-329,10,3.6,5);for(let j=0;j<12;j++)this.b(m.dark,x-4.5+j*.8,1.8,-326.47,.06,3.4,.04);}
 for(const x of [-240,-110,180]){this.b(m.yellow,x,16,-337,1,32,1);this.b(m.yellow,x,30,-337,38,1,1);for(let k=0;k<6;k++)this.b(m.yellow,x-15+k*5,28,-337,.2,5,.2,.4);this.b(m.dark,x+12,20,-337,.08,20,.08);}
 this.label('MARLON  /  PORT AUTHORITY',-220,5,-320,16,0);
 // Safehouse is a bespoke garage placed at the starting plaza.
 this.b(m.brick,-225,3.2,279,22,6.4,13);this.obstacle(-225,279,22,13,6.4);this.b(m.roof,-225,6.6,279,23,.35,14);
 for(const x of [-231,-219]){this.b(m.dark,x,2,272.42,8,3.9,.2);for(let i=0;i<14;i++)this.b(m.concrete,x,.25+i*.25,272.28,7.8,.025,.1);}
 this.label('LES FORGES  /  GARAGE',-225,5.2,272.35,18,Math.PI,'#c9a774');
 // Map objectives sit on the drivable road, never within buildings.
 this.markers=M.territories().map(t=>{const g=new T.Group;g.position.set(t.x,0,t.z);const material=new T.MeshBasicMaterial({color:t.owner==='player'?'#84c6ae':'#d39c63',transparent:true,opacity:.75,depthWrite:false,side:T.DoubleSide});const ring=new T.Mesh(new T.RingGeometry(4.5,4.62,64),material);ring.rotation.x=-Math.PI/2;ring.position.y=.04;g.add(ring);const core=new T.Mesh(new T.OctahedronGeometry(.5),material);core.position.y=3;g.add(core);s.add(g);return{group:g,core,material};});
 for(const {geo,mat,items}of this.batches.values()){const mesh=new T.InstancedMesh(geo,mat,items.length);const obj=new T.Object3D;items.forEach((a,i)=>{obj.position.set(a.x,a.y,a.z);obj.rotation.set(0,a.ry,0);obj.scale.set(a.w,a.h,a.d);obj.updateMatrix();mesh.setMatrixAt(i,obj.matrix);});mesh.castShadow=true;mesh.receiveShadow=true;mesh.frustumCulled=false;s.add(mesh);}this.buildingCount=idx+1;
 }
}
M.World=World;
M.makeSky=function(scene){const sky=new T.Mesh(new T.SphereGeometry(1500,32,16),new T.ShaderMaterial({side:T.BackSide,depthWrite:false,uniforms:{top:{value:new T.Color('#1d344c')},horizon:{value:new T.Color('#ba967f')},sunDir:{value:V(-.75,.23,-.6).normalize()}},vertexShader:'varying vec3 v;void main(){v=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec3 v;uniform vec3 top;uniform vec3 horizon;uniform vec3 sunDir;void main(){vec3 d=normalize(v);float h=max(d.y,0.);vec3 col=mix(horizon,top,pow(h,.48));float su=max(dot(d,sunDir),0.);col+=vec3(1.,.55,.25)*pow(su,32.)*.25;col+=vec3(1.,.88,.64)*smoothstep(.99997,.99999,su)*2.;gl_FragColor=vec4(col,1.);}'}));scene.add(sky);return sky;};
})(Marlon);
