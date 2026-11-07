// Use the starter's OpenFreeMap street cartography when its map tiles and WebGL are available.
export function createLiberty(map,isStreet){
  const pane=map.createPane('liberty');
  pane.style.zIndex='250';pane.style.opacity='0';pane.style.pointerEvents='none';
  let layer=null,ready=false,unavailable=false;
  function show(){
    if(unavailable||!isStreet())return;
    pane.style.display='';
    if(layer){pane.style.opacity=ready?'1':'0';return;}
    if(!window.maplibregl||typeof L.maplibreGL!=='function')return;
    try{
      const probe=document.createElement('canvas').getContext('webgl2');
      if(!probe){unavailable=true;return;}
      probe.getExtension('WEBGL_lose_context')?.loseContext();
      layer=L.maplibreGL({pane:'liberty',style:'https://tiles.openfreemap.org/styles/liberty',interactive:false,padding:.08,attributionControl:false});
      layer.addTo(map);const gl=layer.getMaplibreMap();
      gl.on('idle',()=>{
        if(!gl.getCanvas()||!gl.areTilesLoaded())return;
        const content=gl.queryRenderedFeatures().some(f=>f.source&&f.geometry);
        ready=content;pane.style.opacity=ready&&isStreet()?'1':'0';
      });
      gl.on('error',()=>{ready=false;pane.style.opacity='0';});
      gl.getCanvas().addEventListener('webglcontextlost',()=>{ready=false;pane.style.opacity='0';});
    }catch{
      unavailable=true;pane.style.opacity='0';
      if(layer&&map.hasLayer(layer)){map.off(layer.getEvents(),layer);try{map.removeLayer(layer);}catch{}}
      layer=null;pane.replaceChildren();
    }
  }
  function hide(){pane.style.display='none';}
  return {show,hide};
}
