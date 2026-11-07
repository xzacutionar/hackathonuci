import {amenityIcon} from './amenity-icons.js';
export function createGlobe(container,D,callbacks){
  const cdn='/vendor/cesium/';let viewer=null,engine=null,loading=null,tiling=null,table=[],picked=null,places=[],rotating=false,raf=0,angle=0,orbitCenter,range=5000;
  let terrainSeq=0,photorealTiles=null;
  let labelVisible=true,lastTileError=0;
  function library(){
    if(window.Cesium)return Promise.resolve(window.Cesium);
    return new Promise((resolve,reject)=>{
      window.CESIUM_BASE_URL=cdn;
      if(!document.querySelector('link[data-cesium]')){const link=document.createElement('link');link.rel='stylesheet';link.href=cdn+'Widgets/widgets.css';link.dataset.cesium='1';document.head.append(link);}
      const script=document.createElement('script'),timer=setTimeout(()=>fail(),12500);
      function fail(){clearTimeout(timer);script.remove();reject(Error('Cesium could not load. The 2D atlas is available.'));}
      script.async=true;script.src=cdn+'Cesium.js';script.onload=()=>{clearTimeout(timer);window.Cesium?resolve(window.Cesium):fail();};script.onerror=fail;document.head.append(script);
    });
  }
  async function init(){
    if(loading)return loading;if(viewer)return viewer;
    loading=(async()=>{
      const C=engine=await library();
      const publicToken=window.LANDSCOUT_CONFIG?.ionPublicToken;
      C.Ion.defaultAccessToken=publicToken||'';
      viewer=new C.Viewer(container,{baseLayer:false,baseLayerPicker:false,terrainProvider:new C.EllipsoidTerrainProvider(),timeline:false,animation:false,homeButton:false,geocoder:false,sceneModePicker:false,selectionIndicator:false,infoBox:false,navigationHelpButton:false,fullscreenButton:false,requestRenderMode:true,shouldAnimate:false,showRenderLoopErrors:false});
      viewer.scene.globe.baseColor=C.Color.fromCssColorString('#b7c5c6');viewer.scene.globe.depthTestAgainstTerrain=false;
      tiling=new C.UrlTemplateImageryProvider({url:'https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/{z}/{y}/{x}',maximumLevel:17,credit:new C.Credit('USDA · USGS The National Map, Orthoimagery',true)});
      tiling.errorEvent.addEventListener(()=>{if(!lastTileError){lastTileError=Date.now();viewer.scene.requestRender();}});
      const world=await C.TileMapServiceImageryProvider.fromUrl(cdn+'Assets/Textures/NaturalEarthII');
      viewer.imageryLayers.addImageryProvider(world);
      viewer.imageryLayers.addImageryProvider(tiling);
      // Prefer local, georeferenced imagery inside the study area, including without network access.
      for(const shot of D.images){
        const rect=C.Rectangle.fromDegrees(...shot.bounds);
        const local=await C.SingleTileImageryProvider.fromUrl('/imagery/'+shot.geographicFile,{rectangle:rect,credit:new C.Credit('USDA · USGS The National Map',true)});
        viewer.imageryLayers.addImageryProvider(local);
      }
      if(publicToken)applyTerrain(publicToken);
      const handler=new C.ScreenSpaceEventHandler(viewer.scene.canvas);
      handler.setInputAction(m=>{const id=viewer.scene.pick(m.position)?.id?.properties?.sid?.getValue();if(id)callbacks.pick(table.find(x=>x.id===id));},C.ScreenSpaceEventType.LEFT_CLICK);
      handler.setInputAction(m=>{const id=viewer.scene.pick(m.endPosition)?.id?.properties?.sid?.getValue(),rec=table.find(x=>x.id===id);if(rec){const b=container.getBoundingClientRect();callbacks.tip({clientX:b.left+m.endPosition.x,clientY:b.top+m.endPosition.y},rec);}else callbacks.hideTip();},C.ScreenSpaceEventType.MOUSE_MOVE);
      viewer.scene.renderError.addEventListener(()=>callbacks.failure('3D rendering stopped. The 2D atlas is available.'));
      viewer.screenSpaceEventHandler.removeInputAction(C.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
      viewer.scene.canvas.addEventListener('pointerdown',()=>{if(rotating)callbacks.manual();});refresh();return viewer;
    })().catch(err=>{loading=null;if(viewer){viewer.destroy();viewer=null;}throw err;});return loading;
  }
  async function applyTerrain(token){
    const seq=++terrainSeq;if(!viewer||!engine)return;
    engine.Ion.defaultAccessToken=token||'';
    if(photorealTiles){viewer.scene.primitives.remove(photorealTiles);photorealTiles=null;}
    viewer.scene.globe.show=true;
    try{
      const wantTiles=Boolean(token&&window.LANDSCOUT_CONFIG?.photoreal);
      if(wantTiles){
        const resource=await engine.IonResource.fromAssetId(2275207,{accessToken:token});
        const tiles=await engine.Cesium3DTileset.fromUrl(resource,{showCreditsOnScreen:true});
        if(seq!==terrainSeq||!viewer){tiles.destroy();return;}
        photorealTiles=viewer.scene.primitives.add(tiles);
        viewer.terrainProvider=new engine.EllipsoidTerrainProvider();
        viewer.scene.requestRender();callbacks.notice('Google Photorealistic 3D Tiles enabled.');
        tiles.tileFailed.addEventListener(()=>{if(seq===terrainSeq)callbacks.notice('Some Google 3D tiles are unavailable for this view.');});
      }else{
        const terrain=token?await engine.createWorldTerrainAsync():new engine.EllipsoidTerrainProvider();
        if(seq===terrainSeq&&viewer){viewer.terrainProvider=terrain;viewer.scene.requestRender();}
      }
    }catch{
      if(seq===terrainSeq)callbacks.notice('Ion content is unavailable. Check the token’s asset access and allowed Site URL. Aerial imagery is still available.',8000);
    }
  }
  function refresh(){
    if(!viewer)return;const C=engine;viewer.entities.removeAll();
    for(const s of table){
      const chosen=s.id===picked?.id;
      if(s.geometry&&s.kind==='parcel'){
        for(const rings of D.polygons(s.geometry)){
          const toPos=r=>C.Cartesian3.fromDegreesArray(r.flatMap(a=>a.slice(0,2)));
          const hierarchy=new C.PolygonHierarchy(toPos(rings[0]),rings.slice(1).map(r=>new C.PolygonHierarchy(toPos(r))));
          viewer.entities.add({polygon:{hierarchy,material:C.Color.fromCssColorString(s.color).withAlpha(.5)},polyline:{positions:toPos(rings[0]),width:chosen?3:1.5,clampToGround:true,material:C.Color.fromCssColorString(chosen?'#592879':'#795691')},properties:{sid:s.id}});
        }
      }
      if(labelVisible||s.id===picked?.id)viewer.entities.add({position:C.Cartesian3.fromDegrees(s.lon,s.lat),point:{pixelSize:chosen?9:5,color:C.Color.fromCssColorString('#5f849f'),outlineColor:C.Color.WHITE,outlineWidth:2,disableDepthTestDistance:Number.POSITIVE_INFINITY},label:labelVisible?{text:s.name,font:'13px sans-serif',fillColor:C.Color.WHITE,style:C.LabelStyle.FILL_AND_OUTLINE,outlineWidth:3,outlineColor:C.Color.fromCssColorString('#263643'),pixelOffset:new C.Cartesian2(0,-17),disableDepthTestDistance:Number.POSITIVE_INFINITY}:undefined,properties:{sid:s.id}});
    }
    for(const a of places.filter(x=>Number.isFinite(x.lon)))viewer.entities.add({position:C.Cartesian3.fromDegrees(a.lon,a.lat),name:a.name+' · '+a.cat,billboard:{image:amenityIcon(a.cat),width:28,height:28,disableDepthTestDistance:Number.POSITIVE_INFINITY}});
    viewer.scene.requestRender();
  }
  function stop(){rotating=false;cancelAnimationFrame(raf);if(viewer){viewer.camera.lookAtTransform(engine.Matrix4.IDENTITY);viewer.camera.cancelFlight();viewer.scene.requestRender();}}
  function orbit(s){
    if(!viewer||!s)return;stop();const C=engine;rotating=true;angle=viewer.camera.heading;orbitCenter=C.Cartesian3.fromDegrees(s.lon,s.lat);let last;
    function step(ts){if(!rotating)return;if(last)angle+=Math.min(65,ts-last)*.000065;last=ts;viewer.camera.lookAt(orbitCenter,new C.HeadingPitchRange(angle,-.63,range));viewer.scene.requestRender();raf=requestAnimationFrame(step);}raf=requestAnimationFrame(step);
  }
  function fly(s,after){
    stop();const C=engine;range=s?.kind==='parcel'?1300:s?4800:72000;
    if(s?.kind==='parcel'&&s.geometry){const b=D.bbox(s.geometry);range=Math.max(520,Math.min(150000,D.distance(b[1],b[0],b[3],b[2])*1600));}
    const at=s||{lon:-117.80,lat:33.70};const sphere=new C.BoundingSphere(C.Cartesian3.fromDegrees(at.lon,at.lat),1);
    viewer.camera.flyToBoundingSphere(sphere,{duration:matchMedia('(prefers-reduced-motion: reduce)').matches?0:1.45,offset:new C.HeadingPitchRange(0,s?-.64:-1.29,range),complete:after});viewer.scene.requestRender();
  }
  return {init,fly,stop,orbit,applyTerrain,setLabels(visible){labelVisible=visible;refresh();},setRecords(rows,s,near){table=rows;picked=s;places=near;refresh();},zoomBy(delta){if(!viewer)return;if(rotating){range=Math.max(180,Math.min(120000,range*(delta>0?.65:1.5)));return;}const magnitude=viewer.camera.positionCartographic.height*.38;delta>0?viewer.camera.zoomIn(magnitude):viewer.camera.zoomOut(magnitude);viewer.scene.requestRender();},resize(){viewer?.resize();viewer?.scene.requestRender();},get active(){return !!viewer;}};
}
