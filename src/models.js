(function(M){
'use strict';const T=THREE;
function ellipsoid(g,mat,x,y,z,sx,sy,sz){const m=M.mesh(g,new T.SphereGeometry(1,16,12),mat,x,y,z);m.scale.set(sx,sy,sz);return m;}
function limb(g,mat,x,y,z,len,r1,r2){const joint=new T.Group;joint.position.set(x,y,z);g.add(joint);M.mesh(joint,new T.CylinderGeometry(r1,r2,len,12),mat,0,-len/2,0);ellipsoid(joint,mat,0,0,0,r1,r1,r1);return joint;}
M.character=function(color='#263138',enemy=false){const root=new T.Group,body=new T.Group;root.add(body);const skin=M.mat(enemy?'#b48b73':'#9d735a',.9),coat=M.mat(color,.73),pants=M.mat('#24292e',.86),sole=M.mat('#101619',.65),stitch=M.mat('#697072',.7),hair=M.mat('#211e1c');
 const shirt=new T.LatheGeometry([new T.Vector2(.18,.96),new T.Vector2(.19,1.02),new T.Vector2(.17,1.15),new T.Vector2(.225,1.34),new T.Vector2(.235,1.4),new T.Vector2(.11,1.46),new T.Vector2(.075,1.48)],20);shirt.scale(1,1,.66);M.mesh(body,shirt,coat);
 for(const side of [-1,1]){const collar=M.box(body,.083,.105,.035,side*.063,1.455,.064,coat);collar.rotation.z=-side*.38;M.box(body,.10,.055,.014,side*.115,1.29,.141,coat);M.box(body,.018,.018,.012,side*.115,1.29,.152,stitch);}
 M.box(body,.4,.08,.25,0,.96,0,sole);M.box(body,.034,.46,.015,0,1.25,.153,stitch);
 const head=new T.Group;head.position.y=1.64;body.add(head);M.mesh(head,new T.CylinderGeometry(.071,.075,.14,12),skin,0,-.13,0);ellipsoid(head,skin,0,0,0,.116,.15,.115);ellipsoid(head,hair,0,.064,-.025,.12,.105,.10);ellipsoid(head,skin,0,-.002,.11,.034,.033,.028);for(const x of [-.05,.05])ellipsoid(head,sole,x,.016,.104,.013,.008,.006);
 const l=limb(body,pants,-.115,.97,0,.46,.105,.075),r=limb(body,pants,.115,.97,0,.46,.105,.075);const lk=limb(l,pants,0,-.46,0,.44,.075,.06),rk=limb(r,pants,0,-.46,0,.44,.075,.06);const feet=[];for(const k of [lk,rk]){const foot=new T.Group;foot.position.y=-.44;k.add(foot);ellipsoid(foot,sole,0,.02,.055,.089,.06,.16);M.box(foot,.175,.025,.285,0,-.027,.05,sole);for(let i=0;i<3;i++)M.box(foot,.075,.008,.01,0,.07,.07+i*.027,stitch);feet.push(foot);}const [lf,rf]=feet;
 const la=limb(body,coat,.235,1.40,0,.30,.079,.064),ra=limb(body,coat,-.235,1.40,0,.30,.079,.064);const le=limb(la,coat,0,-.3,0,.27,.069,.055),re=limb(ra,coat,0,-.3,0,.27,.069,.055);for(const a of [le,re]){ellipsoid(a,skin,0,-.30,.025,.05,.075,.045);M.mesh(a,new T.CylinderGeometry(.058,.056,.055,12),sole,0,-.248,0);}
 const gun=new T.Group;re.add(gun);gun.position.set(0,-.30,.055);gun.rotation.x=Math.PI/2;M.box(gun,.07,.09,.28,0,.018,.09,sole);M.box(gun,.063,.15,.07,0,-.06,0,sole);M.mesh(gun,new T.CylinderGeometry(.023,.023,.13,12),stitch,0,.036,.23).rotation.x=Math.PI/2;gun.visible=false;
 const magazine=M.box(le,.045,.095,.04,0,-.3,.025,sole);magazine.visible=false;
 const flash=new T.Mesh(new T.SphereGeometry(.085,8,6),new T.MeshBasicMaterial({color:'#fff1a1'}));flash.position.set(0,.036,.32);flash.scale.z=2;flash.visible=false;gun.add(flash);
 return{root,body,head,l,r,lk,rk,lf,rf,la,ra,le,re,gun,flash,magazine,phase:0};};
M.animateCharacter=function(a,speed,dt,time,armed=false,aim=false,melee=0,hit=0){a.phase+=speed*dt*2.5;const k=Math.min(1,speed/3.5),s=Math.sin(a.phase),c=Math.cos(a.phase);a.l.rotation.x=s*.65*k;a.r.rotation.x=-s*.65*k;a.lk.rotation.x=Math.max(0,-s)*.8*k;a.rk.rotation.x=Math.max(0,s)*.8*k;a.body.position.y=Math.abs(c)*.035*k+Math.sin(time*2)*.004;a.body.rotation.z=hit*.12;
 a.la.rotation.set(-s*.45*k,0,.07);a.ra.rotation.set(s*.45*k,0,-.07);a.le.rotation.x=-.16;a.re.rotation.x=-.16;
 if(armed){a.ra.rotation.x=aim?-1.42:-.25;a.re.rotation.x=aim?-.12:-.75;if(aim){a.la.rotation.set(-1.12,-.35,-.3);a.le.rotation.x=-.6;}}
 if(melee>0){const punch=Math.sin(melee*Math.PI);a.ra.rotation.x=-punch*1.7;a.re.rotation.x=-.1;a.body.rotation.y=punch*.3;}else a.body.rotation.y=0;
 a.gun.visible=armed;};
function loft(stations,shape){const vertices=[],uv=[],indices=[];for(let j=0;j<stations.length;j++){const st=stations[j];for(let i=0;i<shape.length;i++){vertices.push(shape[i][0]*st.w,st.y+shape[i][1]*st.h,st.z);uv.push(i/(shape.length-1),j/(stations.length-1));}}
 for(let j=0;j<stations.length-1;j++)for(let i=0;i<shape.length-1;i++){const a=j*shape.length+i,b=a+shape.length;indices.push(a,b,a+1,a+1,b,b+1);}for(const j of [0,stations.length-1]){const st=stations[j],center=vertices.length/3;vertices.push(0,st.y,st.z);uv.push(.5,.5);for(let i=0;i<shape.length-1;i++){const a=j*shape.length+i;indices.push(center,j===0?a+1:a,j===0?a:a+1);}}const geo=new T.BufferGeometry;geo.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex(indices);geo.computeVertexNormals();return geo;}
M.carModel=function(kind='coupe',color='#284a55'){const root=new T.Group,body=new T.Group;root.add(body);const paint=new T.MeshPhysicalMaterial({color:new T.Color(color).convertSRGBToLinear(),roughness:.24,metalness:.7,clearcoat:1,clearcoatRoughness:.13,side:T.DoubleSide}),glass=new T.MeshPhysicalMaterial({color:'#344953',roughness:.15,metalness:.18,clearcoat:1,side:T.DoubleSide,transparent:true,opacity:.5,depthWrite:false}),rubber=M.mat('#15191b',.96),chrome=M.mat('#919b9f',.22,.92),black=M.mat('#1b2227',.54,.4),light=new T.MeshStandardMaterial({color:'#f1f5eb',emissive:'#d9ecff',emissiveIntensity:2}),tail=new T.MeshStandardMaterial({color:'#892c2a',emissive:'#ff3128',emissiveIntensity:1});
 const suv=kind==='suv',van=kind==='van',scale=van?1.15:suv?1.06:1;const h=suv?.64:.5;const stations=[{z:-2.32,w:.72,y:.72,h:.19},{z:-2.13,w:.91,y:.76,h:.29},{z:-1.45,w:.96,y:.78,h:h},{z:0,w:.94,y:.78,h:h},{z:1.3,w:.94,y:.76,h:.36},{z:2.02,w:.87,y:.72,h:.21},{z:2.27,w:.72,y:.68,h:.14}];
 const shape=[[-.82,-.7],[-1,-.25],[-1,.35],[-.91,.8],[-.72,1],[.72,1],[.91,.8],[1,.35],[1,-.25],[.82,-.7],[-.82,-.7]];
 M.mesh(body,loft(stations,shape),paint);M.box(body,1.76,.18,4.18,0,.44,0,black);
 const roofH=van?1.65:suv?1.5:1.34;const cabin=[{z:-1.52,w:.81,y:1.04,h:.03},{z:-.95,w:.72,y:1.04,h:roofH-1.04},{z:.38,w:.70,y:1.04,h:roofH-1.04},{z:1.2,w:.80,y:1.04,h:.03}];M.mesh(body,loft(cabin,[[-1,0],[-.95,.65],[-.83,1],[.83,1],[.95,.65],[1,0]]),glass);
 M.box(body,1.18,.05,1.23,0,roofH+.015,-.28,paint);
 for(const side of [-1,1]){
 M.box(body,.04,roofH-1.04,.055,side*.70,(roofH+1.04)/2,-.35,paint);
 function pillar(a,b){const d=new T.Vector3().subVectors(b,a),m=M.mesh(body,new T.CylinderGeometry(.028,.03,d.length(),8),paint);m.position.copy(a).add(b).multiplyScalar(.5);m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize());}
 pillar(new T.Vector3(side*.79,1.045,1.2),new T.Vector3(side*.58,roofH,.38));
 pillar(new T.Vector3(side*.8,1.045,-1.52),new T.Vector3(side*.6,roofH,-.95));
 M.box(body,.055,.04,2.7,side*.9,1.01,-.13,chrome);M.box(body,.22,.12,.23,side*1.00,1.13,.65,paint);M.box(body,.06,.04,.2,side*.951,.91,-.1,chrome);
 M.box(body,.028,.32,.015,side*.949,.82,-.39,black);M.box(body,.026,.035,2.7,side*.947,.56,0,chrome);
 M.box(body,.53,.075,.09,side*.49,.84,2.17,light);M.box(body,.53,.07,.08,side*.49,.87,-2.16,tail);
 M.box(body,.42,.055,.10,side*.55,.77,2.18,light);
 const exhaust=M.mesh(body,new T.CylinderGeometry(.07,.07,.18,16),chrome,side*.55,.47,-2.12);exhaust.rotation.x=Math.PI/2;
 }
 M.box(body,.68,.13,.08,0,.6,2.24,black);for(let i=-3;i<=3;i++)M.box(body,.025,.12,.09,i*.085,.6,2.25,chrome);
 M.box(body,.42,.12,.015,0,.65,-2.24,chrome);M.box(body,.3,.035,.019,0,.67,-2.25,black);
 const doors=[];for(const side of [-1,1]){const hinge=new T.Group;hinge.position.set(side*.935,0,1.12);body.add(hinge);M.box(hinge,.065,.46,2.15,0,.77,-1.07,paint);M.box(hinge,.055,.035,2.16,side*.016,1.015,-1.07,chrome);M.box(hinge,.04,.055,.20,side*.05,.93,-1.53,chrome);M.box(hinge,.04,.3,1.15,-side*.08,1.17,-1.06,glass);doors.push({hinge,side,open:0});}
 for(const side of [-1,1]){M.box(body,.47,.17,.52,side*.36,.57,-.21,black);const back=M.box(body,.45,.51,.13,side*.36,.82,-.45,black);back.rotation.x=-.1;ellipsoid(body,black,side*.36,1.12,-.47,.13,.11,.055);}
 const wheel=M.mesh(body,new T.TorusGeometry(.15,.022,8,24),black,.35,.92,.48);wheel.rotation.x=.7;
 const wheels=[];for(const x of [-.91,.91])for(const z of [-1.4,1.4]){const pivot=new T.Group;pivot.position.set(x,.4,z);root.add(pivot);const spin=new T.Group;pivot.add(spin);const tire=M.mesh(spin,new T.CylinderGeometry(.38,.38,.22,28),rubber);tire.rotation.z=Math.PI/2;for(const side of [-1,1]){const disk=M.mesh(spin,new T.CylinderGeometry(.26,.26,.018,24),black,side*.12,0,0);disk.rotation.z=Math.PI/2;const hub=M.mesh(spin,new T.CylinderGeometry(.07,.07,.03,16),chrome,side*.137,0,0);hub.rotation.z=Math.PI/2;for(let j=0;j<5;j++){const spoke=M.box(spin,.023,.44,.047,side*.14,0,0,chrome);spoke.rotation.x=j*Math.PI/5;}const ring=M.mesh(spin,new T.TorusGeometry(.26,.021,6,28),chrome,side*.14,0,0);ring.rotation.y=Math.PI/2;}
 wheels.push({pivot,spin,front:z>0});}
 if(kind==='coupe'){M.box(body,1.75,.045,.27,0,1.07,-1.98,paint);for(const x of [-.6,.6])M.box(body,.055,.21,.08,x,.97,-1.98,black);}if(suv||van){for(const x of [-.57,.57])M.box(body,.05,.06,1.5,x,roofH+.08,-.25,chrome);}
 if(van){M.box(body,1.62,.67,2.6,0,1.35,-.65,paint);M.box(body,1.63,.045,2.67,0,1.7,-.65,paint);for(const side of [-1,1]){M.box(body,.025,.56,.019,side*.824,1.35,-1.45,black);M.box(body,.03,.02,2.1,side*.826,1.25,-.72,black);M.box(body,.04,.04,.2,side*.84,1.21,-.25,chrome);M.box(body,.09,.42,.06,side*.72,1.13,-1.98,tail);}M.box(body,.025,.65,.025,0,1.35,-1.97,black);}
 root.scale.set(scale,scale,scale);return{root,body,wheels,tail,kind,doors,steeringWheel:wheel};};
})(Marlon);
