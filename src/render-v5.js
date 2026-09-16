/* Colour, contact shadows and display quality. All assets stay local. */
(function(M){'use strict';const T=THREE,G=M.Game.prototype,P=M.UI.prototype;
const material=M.mat;M.mat=function(...args){const m=material(...args);m.envMapIntensity=.32;return m;};
const init=G.initCity;G.initCity=function(){init.call(this);
 const maxAnisotropy=Math.min(8,this.renderer.capabilities.getMaxAnisotropy());
 const seen=new Set;this.scene.traverse(o=>{for(const m of(Array.isArray(o.material)?o.material:o.material?[o.material]:[])){if(seen.has(m))continue;seen.add(m);if(m.isMeshStandardMaterial)m.envMapIntensity=.32;if(m.map)m.map.anisotropy=maxAnisotropy;}});
 const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const ctx=canvas.getContext('2d'),gr=ctx.createRadialGradient(64,64,4,64,64,63);gr.addColorStop(0,'rgba(9,18,36,.44)');gr.addColorStop(.45,'rgba(9,18,36,.26)');gr.addColorStop(1,'rgba(9,18,36,0)');ctx.fillStyle=gr;ctx.fillRect(0,0,128,128);
 const shadowMap=new T.CanvasTexture(canvas),mat=new T.MeshBasicMaterial({map:shadowMap,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,side:T.DoubleSide});
 this.contactShadows=new T.InstancedMesh(new T.PlaneGeometry(1,1),mat,220);this.contactShadows.instanceMatrix.setUsage(T.DynamicDrawUsage);this.contactShadows.frustumCulled=false;this.contactShadows.renderOrder=1;this.scene.add(this.contactShadows);this.shadowDummy=new T.Object3D;this.renderFrustum=new T.Frustum;this.renderMatrix=new T.Matrix4;this.renderSphere=new T.Sphere;this.renderHidden=[];
 const render=this.renderer.render.bind(this.renderer);this.renderer.render=(scene,camera)=>{if(scene!==this.scene)return render(scene,camera);this.prepareCityRender(camera);try{return render(scene,camera);}finally{for(const object of this.renderHidden)object.visible=true;this.renderHidden.length=0;}};
};
G.prepareCityRender=function(camera){if(!this.contactShadows)return;let index=0;const o=this.shadowDummy;
 camera.updateMatrixWorld();this.renderMatrix.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);this.renderFrustum.setFromProjectionMatrix(this.renderMatrix);
 const inView=(x,y,z,r)=>{this.renderSphere.center.set(x,y,z);this.renderSphere.radius=r;return this.renderFrustum.intersectsSphere(this.renderSphere);};
 const cull=(root,x,y,z,r)=>{if(root.visible&&!inView(x,y,z,r)){this.renderHidden.push(root);root.visible=false;}};
 for(const n of [...this.npcs,...this.enemies,...this.allies,...(this.lifePeople||[]),...(this.displacedDrivers||[])])if(n.actor)cull(n.actor.root,n.x,(n.y||0)+1,n.z,3.5);
 for(const c of this.cars)if(c!==this.vehicle&&this.action?.car!==c)cull(c.model.root,c.x,1.5,c.z,(c.model.len||4.4)*.65+2);
 for(const prop of this.world.props)cull(prop.root,prop.x,2,prop.z,7);
 for(const sig of this.world.signals)cull(sig.root,sig.x,3,sig.z,8);

 const put=(x,y,z,w,d,yaw=0)=>{if(index>=220||Math.hypot(x-camera.position.x,z-camera.position.z)>80)return;o.position.set(x,y+.028,z);o.rotation.set(-Math.PI/2,0,yaw);o.scale.set(w,d,1);o.updateMatrix();this.contactShadows.setMatrixAt(index++,o.matrix);};
 const person=(a)=>{if(!a||a.health<=0||a.actor&&!a.actor.root.visible||a.recruited)return;const y=this.world.groundHeight(a.x,a.z,Math.max(0,(a.y||0)-.05));if((a.y||0)-y<2)put(a.x,y,a.z,1.1,1.05);};
 if(!this.vehicle&&!this.heliFlying)person(this.player);
 for(const a of this.npcs)person(a);for(const a of this.enemies)person(a);for(const a of this.allies)person(a);for(const a of this.lifePeople||[])person(a);
 for(const c of this.cars)if(c.model.root.visible)put(c.x,0,c.z,(c.model.bounds?.width||2)*1.4,(c.model.len||4.4)*1.2,c.yaw);
 for(const a of this.pets)put(a.x,a.y||0,a.z,.9,1.25);for(const a of this.strays||[])if(a.model?.root.visible)put(a.x,a.y||0,a.z,.9,1.25);
 this.contactShadows.count=index;this.contactShadows.instanceMatrix.needsUpdate=true;
 if(this.world.renderChunks)for(const chunk of this.world.renderChunks){const dx=chunk.x-camera.position.x,dz=chunk.z-camera.position.z,range=(this.quality==='performance'?280:650)+chunk.radius;chunk.mesh.visible=dx*dx+dz*dz<range*range&&inView(chunk.x,8,chunk.z,chunk.radius+25);}
};
const settings=P.renderSettings;P.renderSettings=function(){settings.call(this);const quality=document.getElementById('quality'),info=document.createElement('small');info.className='resolution-info';const update=()=>{const r=this.g.renderResolution;info.textContent=r?`${r.width} × ${r.height} pixels · couleurs vives · anticrénelage`:'Couleurs vives · anticrénelage';};quality?.closest('.setting')?.appendChild(info);quality?.addEventListener('change',update);update();};
})(Marlon);
