import {amenityIcon} from './amenity-icons.js';
import {createLiberty} from './street-style.js';
const usgsTiles='https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/{z}/{y}/{x}';
const streetTiles='https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer/tile/{z}/{y}/{x}';
const stops=[[33.417,-118.082],[33.939,-117.468]];
const reduced=()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// Raster layers supply the entire basemap. Shapes are optional, attributed jurisdiction or parcel overlays.
export function createRaster(container,D,callbacks){
  const map=L.map(container,{zoomControl:false,attributionControl:false,minZoom:7,maxZoom:19,zoomSnap:.25,zoomDelta:1,preferCanvas:true,zoomAnimation:!reduced(),keyboard:true,worldCopyJump:false});
  let selected=null,imports=[],amenities=[],basemap='streets';
  const settings={regions:true,labels:true};
  const offline=L.layerGroup();
  const streetsLocal=L.layerGroup().addTo(map);
  const boundaries=L.layerGroup().addTo(map);
  const markers=L.layerGroup().addTo(map);
  const nearby=L.layerGroup().addTo(map);
  const aerial=L.tileLayer(usgsTiles,{maxNativeZoom:17,maxZoom:19,updateWhenIdle:true,zIndex:12,keepBuffer:1});
  const street=L.tileLayer(streetTiles,{maxNativeZoom:19,maxZoom:19,zIndex:14,keepBuffer:1});
  function home(){
    map.stop();map.invalidateSize({pan:false});
    const areas=D.regions.filter(r=>r.geometry).map(r=>L.geoJSON(r.geometry).getBounds());
    const bounds=areas.length?areas.reduce((a,b)=>a.extend(b)).pad(.09):L.latLngBounds(stops);
    const inset=container.clientWidth<500?16:30;
    map.fitBounds(bounds,{padding:[inset,inset],animate:false});
  }
  home();
  const backdrops=[];
  for(const im of D.images){
    const [w,s,e,n]=im.bounds;
    const layer=L.imageOverlay('/imagery/'+im.file,[[s,w],[n,e]],{pane:'tilePane',zIndex:im.id==='county'?1:3,alt:im.id==='county'?'Orange County aerial imagery':'Regional aerial imagery',className:'local-photo',interactive:false}).addTo(offline);
    backdrops.push({layer,image:im});
    const topo=L.imageOverlay('/streets/'+im.file,[[s,w],[n,e]],{pane:'tilePane',zIndex:1,alt:'USGS topographic street map',interactive:false}).addTo(streetsLocal);
    backdrops.push({layer:topo,image:im});
  }
  function prioritiseLocal(){
    const z=map.getZoom();
    for(const {layer,image} of backdrops){
      const foreground=z<=image.zoom+.75;
      layer.setOpacity(image.id==='county'?1:Math.max(0,Math.min(1,(z-11.75)/.75)));
      layer.setZIndex(foreground?(image.id==='county'?24:26):(image.id==='county'?1:3));
    }
  }
  map.on('zoomend',prioritiseLocal);prioritiseLocal();
  street.addTo(map);
  container.classList.add('street-style');
  const liberty=createLiberty(map,()=>basemap==='streets');
  liberty.show();
  function setBasemap(next){
    if(next===basemap)return;
    basemap=next;container.classList.toggle('street-style',next==='streets');
    if(next==='streets'){map.removeLayer(aerial);map.removeLayer(offline);streetsLocal.addTo(map);street.addTo(map);prioritiseLocal();liberty.show();}
    else{liberty.hide();map.removeLayer(street);map.removeLayer(streetsLocal);offline.addTo(map);aerial.addTo(map);prioritiseLocal();}
  }
  function bindPick(layer,s){
    layer.on('click',e=>{if(e.originalEvent)L.DomEvent.stopPropagation(e.originalEvent);callbacks.hideTip();callbacks.pick(s);});
    layer.on('mousemove',e=>{if(e.originalEvent)callbacks.tip(e.originalEvent,s);});
    layer.on('mouseout',callbacks.hideTip);
  }
  function draw(){
    boundaries.clearLayers();markers.clearLayers();nearby.clearLayers();
    for(const s of [...D.regions,...imports,...(selected?.kind==='place'?[selected]:[])]){
      const active=selected?.id===s.id;
      if(s.geometry&&(s.kind==='parcel'||settings.regions)){
        L.geoJSON(s.geometry,{interactive:false,style:{color:'#55515b',weight:active?5:3.8,opacity:.8,fill:false,smoothFactor:.7}}).addTo(boundaries);
        const l=L.geoJSON(s.geometry,{style:{color:active?'#552d7e':'#785399',weight:active?2.8:1.8,dashArray:'5 4',opacity:1,fillColor:s.color,fillOpacity:active&&s.kind==='region'?0:.5,smoothFactor:.7}}).addTo(boundaries);
        bindPick(l,s);l.on('mouseover',()=>l.setStyle({weight:3,color:'#512d79'}));l.on('mouseout',()=>l.setStyle({weight:active?2.8:1.8,color:active?'#552d7e':'#785399'}));
      }
      if(settings.labels||active){
        const marker=L.marker([s.lat,s.lon],{title:s.name,alt:s.name,keyboard:true,zIndexOffset:active?500:1,icon:L.divIcon({className:'map-label'+(active?' is-current':''),html:'<span class="place-label">'+escape(s.name)+'</span>',iconSize:[1,1],iconAnchor:[0,-1]})}).addTo(markers);
        bindPick(marker,s);
      }
    }
    for(const a of amenities.filter(a=>Number.isFinite(a.lon))){
      const label=a.name+' · '+a.cat;
      const m=L.marker([a.lat,a.lon],{title:label,alt:label,zIndexOffset:650,icon:L.icon({iconUrl:amenityIcon(a.cat),iconSize:[28,28],iconAnchor:[14,14],className:'amenity-marker'})}).addTo(nearby);
      m.bindTooltip(escape(label),{direction:'top',offset:[0,-13]}).bindPopup(escape(label));
    }
    map.invalidateSize({pan:false});
  }
  function fly(s){
    if(s.kind==='region'&&s.geometry){
      map.stop();
      map.flyToBounds(L.geoJSON(s.geometry).getBounds(),{padding:[30,30],animate:!reduced(),duration:1.35});
      return;
    }
    const base=s.kind==='parcel'&&s.geometry?L.geoJSON(s.geometry).getBounds():null;
    const z=base?Math.min(18,map.getBoundsZoom(base,false,[66,70])):13.75;
    map.stop();map.flyTo([s.lat,s.lon],z,{animate:!reduced(),duration:1.05});
  }
  function scale(){
    const size=map.getSize();if(!size.x||!size.y)return;
    const a=map.containerPointToLatLng([0,size.y/2]),b=map.containerPointToLatLng([90,size.y/2]),max=map.distance(a,b)/1000;
    const km=[.005,.01,.02,.05,.1,.2,.5,1,2,5,10,20,50,100].filter(d=>d<=max).at(-1)||.005;
    callbacks.scale(km,Math.min(90,90*km/max));
  }
  map.on('moveend zoomend resize',scale);map.on('dragstart zoomstart',callbacks.hideTip);scale();
  const observer=new ResizeObserver(()=>{if(container.clientWidth&&container.clientHeight){map.invalidateSize({pan:false});scale();}});observer.observe(container);
  draw();return {map,home,fly,draw,settings,setBasemap,get basemap(){return basemap;},setSelection(s){selected=s;draw();},setImports(s){imports=s;draw();},setAmenities(a){amenities=a;draw();},zoomBy(n){map.setZoom(map.getZoom()+n);},resize(){map.invalidateSize({pan:false});},destroy(){observer.disconnect();map.remove();}};
}
