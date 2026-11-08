// Keep the last complete frame on screen while Cesium streams the next angle.
const host=document.querySelector('#render'),frame=document.querySelector('#frame');
const ctx=frame.getContext('2d'),status=document.querySelector('#status'),credits=document.querySelector('#credits');
const signal=state=>parent.postMessage({tourOrbit:state},location.origin);
const abort=new AbortController();
let viewer,started=false,closed=false,paused=new URLSearchParams(location.search).has('paused');
let ended=false,angle=0,previous=0,stable=0,lastGood=0,failed=false;
function unavailable(){
  if(closed||failed)return;failed=true;status.textContent='520 W Santa Ana Blvd · Still view';signal('still');
  if(viewer&&!viewer.isDestroyed()){viewer.useDefaultRenderLoop=false;}
}
function close(){closed=true;abort.abort();if(viewer&&!viewer.isDestroyed())viewer.destroy();}
window.addEventListener('pagehide',close,{once:true});
window.addEventListener('message',e=>{
  if(e.origin!==location.origin||e.source!==parent||typeof e.data?.orbitPlaying!=='boolean')return;
  paused=!e.data.orbitPlaying;
  if(ended&&!paused){angle=0;ended=false;stable=0;}
  previous=0;lastGood=performance.now();viewer?.scene.requestRender();signal(paused?'paused':'playing');
});
async function start(){
  window.CESIUM_BASE_URL='/vendor/cesium/';
  const tag=document.createElement('script');tag.src='/vendor/cesium/Cesium.js';
  await new Promise((resolve,reject)=>{tag.onload=resolve;tag.onerror=reject;document.head.append(tag);});
  if(closed)return;
  const C=window.Cesium;
  const [rows,response]=await Promise.all([
    fetch('/data/commercial-listings.json',{signal:abort.signal}).then(r=>r.json()),
    fetch('https://landscout-3d-imagery.xzacutionar.chatgpt.site/photoreal',{signal:AbortSignal.any([abort.signal,AbortSignal.timeout(20000)])})
  ]);
  if(!response.ok)throw Error('Tiles unavailable');
  const asset=await response.json(),row=rows.find(r=>r.listing_id==='CC-03');
  if(closed)return;
  viewer=new C.CesiumWidget(host,{baseLayer:false,showRenderLoopErrors:false,globe:false,skyBox:false,skyAtmosphere:false,requestRenderMode:false,creditContainer:credits});
  viewer.targetFrameRate=30;viewer.resolutionScale=Math.min(devicePixelRatio,1.5);
  const {scene,camera}=viewer;scene.screenSpaceCameraController.enableInputs=false;
  const resource=new C.Resource({url:asset.url,credits:asset.attributions.map(a=>new C.Credit(a.html,true))});
  const tiles=await C.Cesium3DTileset.fromUrl(resource,{maximumScreenSpaceError:3,showCreditsOnScreen:true});
  if(closed){tiles.destroy();return;}
  scene.primitives.add(tiles);scene.renderError.addEventListener(unavailable);
  const lon=Number(row.longitude),lat=Number(row.latitude);
  let centre=C.Cartesian3.fromDegrees(lon,lat,30);
  function pose(){camera.lookAt(centre,new C.HeadingPitchRange(.6+angle,-.60,580));}
  pose();lastGood=performance.now();
  // Only the photorealistic tileset is pickable; Cesium may return a tile feature or its internal model.
  const surfaceAt=(x,y)=>Boolean(scene.pick(new C.Cartesian2(x*host.clientWidth,y*host.clientHeight)));
  scene.postRender.addEventListener(()=>{
    if(failed||closed||ended||(paused&&started))return;
    const now=performance.now();
    if(now-lastGood>25000){unavailable();return;}
    if(!tiles.tilesLoaded){stable=0;previous=0;return;}
    if(++stable<3)return;
    if(!surfaceAt(.5,.5)||!surfaceAt(.3,.6)||!surfaceAt(.7,.6)){previous=0;return;}
    if(!started&&scene.sampleHeightSupported){
      const z=scene.sampleHeight(C.Cartographic.fromDegrees(lon,lat));
      if(Number.isFinite(z))centre=C.Cartesian3.fromDegrees(lon,lat,z);
    }
    const w=scene.canvas.width,h=scene.canvas.height;
    if(frame.width!==w||frame.height!==h){frame.width=w;frame.height=h;}
    ctx.drawImage(scene.canvas,0,0,w,h);
    // Pin to the same geographic coordinate from every orbital viewpoint.
    const anchor=scene.cartesianToCanvasCoordinates(centre);
    if(anchor){
      ctx.save();ctx.scale(w/host.clientWidth,h/host.clientHeight);
      ctx.fillStyle='#095536';ctx.strokeStyle='white';ctx.lineWidth=2;ctx.beginPath();ctx.arc(anchor.x,anchor.y,5,0,2*Math.PI);ctx.fill();ctx.stroke();ctx.restore();
    }
    document.querySelector('#poster').hidden=true;lastGood=now;
    if(!started){started=true;signal(paused?'paused':'playing');}
    if(paused)return;
    angle+=Math.min(.05,previous?(now-previous)/1000:1/30)*.15;previous=now;
    if(angle>=1.25){ended=true;signal('ended');return;}
    pose();
  });
}
start().catch(unavailable);
