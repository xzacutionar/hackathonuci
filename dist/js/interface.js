import {opportunities} from './opportunities.js';
import {amenityIcon} from './amenity-icons.js';
import {zoningInspector} from './zoning.js';
import {createPhotoView} from './photo-view.js';

export function mountLandscout(D,icons,atlasFactory,globeFactory){
  const $=s=>document.getElementById(s);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const icon=k=>'<svg class="icon" aria-hidden="true" viewBox="0 0 24 24">'+(icons[k]||'')+'</svg>';
  let satelliteFailed=false;
  const photo=createPhotoView($('photoView'),D,()=>modes('3D'));
  let selected=null,imports=[],near=[],nearState='idle',official=D.regions.every(s=>Boolean(s.geometry)),mode='2D',cameraSeq=0,searchSeq=0,nearSeq=0,searchTimer,toastTimer,searchResults=[],globe,atlas;
  const allRecords=()=>[...D.regions,...imports,...(selected?.kind==='place'?[selected]:[])];
  const info=(k,v)=>'<div><dt>'+esc(k)+'</dt><dd>'+esc(v)+'</dd></div>';
  const coords=s=>Math.abs(s.lat).toFixed(4)+'° '+(s.lat<0?'S':'N')+' · '+Math.abs(s.lon).toFixed(4)+'° '+(s.lon<0?'W':'E');
  const btn=(id,label,symbol,primary=false)=>'<button id="'+id+'" class="btn'+(primary?' primary':'')+'">'+(symbol?icon(symbol):'')+esc(label)+'</button>';
  function notice(msg,ms=6500){clearTimeout(toastTimer);$('toast').textContent=msg;$('toast').hidden=false;toastTimer=setTimeout(()=>$('toast').hidden=true,ms);}
  function hideTip(){$('tip').hidden=true;}
  function tip(e,s){if(!s||e.pointerType==='touch'||e.buttons)return;const tip=$('tip'),box=$('atlas').parentElement.getBoundingClientRect();tip.innerHTML='<b>'+esc(s.name)+'</b><small>'+esc(s.boundary)+'</small>';tip.hidden=false;tip.style.left=Math.max(5,Math.min(box.width-tip.offsetWidth-6,e.clientX-box.left+12))+'px';tip.style.top=Math.max(5,Math.min(box.height-tip.offsetHeight-6,e.clientY-box.top+12))+'px';}
  function scale(km,width){$('scale').style.width=width+'px';$('scale').textContent=km<1?Math.round(km*1000)+' m':km+' km';}
  function thumb(s){
    const shot=D.images.find(im=>im.id===s.id);
    return shot?'<span class="thumb"><img src="/imagery/'+esc(shot.file)+'" alt="" loading="lazy"></span>':'';
  }
  function listRow(s){return '<button class="city" data-rec="'+esc(s.id)+'">'+thumb(s)+'<span><strong><i class="region-swatch" style="--region-color:'+s.color+'" aria-hidden="true"></i>'+esc(s.name)+'</strong><small class="coords">'+coords(s)+'</small></span><span class="arrow">'+icon('chev')+'</span></button>';}
  let offers,zones,zoneOrigin=null,iconsVisible=true;
  function fileSection(){
    return '<section class="block"><div class="blockHead"><h2>Parcel boundaries</h2></div><p class="bodycopy">Inspect a local GeoJSON file alongside the study regions.</p><div class="btnrow">'+btn('import','Import GeoJSON','upload')+'</div>'+(imports.length?'<div>'+imports.slice(0,12).map(s=>'<button class="impRow" data-rec="'+esc(s.id)+'"><span><strong>'+esc(s.name)+'</strong><small>Imported geometry</small></span><span class="arrow">'+icon('chev')+'</span></button>').join('')+(imports.length>12?'<p class="empty">Search by name to inspect all '+imports.length+' imported sites.</p>':'')+'</div>':'')+'</section>';
  }
  function nearbySection(){
    let body='<p class="empty">Find mapped amenities within 3.5 km of the selected centre.</p>';
    if(nearState==='loading')body='<p class="empty" role="status">Looking up nearby places…</p>';
    if(nearState==='failed')body='<p class="empty" role="status">The local places directory could not load. Retry to check this area.</p>';
    if(nearState==='done')body='<p class="empty">Nearest result in each available dataset, within 3.5 km. Distances are straight-line from the selected city or district point.</p>'+near.map(x=>x.name?'<a class="nearRow" href="'+esc(x.url)+'" target="_blank" rel="noopener"><img class="poi-key" alt="" width="25" height="25" src="'+amenityIcon(x.cat)+'"><span><strong>'+esc(x.name)+'</strong><small>'+esc(x.source||x.cat)+' · '+esc(x.cat)+'</small></span><span class="quantity">'+x.km.toFixed(2)+' km</span></a>':'<div class="nearRow"><span><strong>'+esc(x.cat)+'</strong><small>'+(x.coverage?'No recorded result within 3.5 km':'Coverage unavailable')+'</small></span></div>').join('');
    return '<section class="block"><div class="blockHead"><h2>Nearby amenities</h2></div>'+body+'<div class="btnrow">'+(nearState==='loading'?'':btn('nearby',nearState==='failed'?'Retry lookup':nearState==='done'?'Refresh places':'Find nearby','near',true))+'</div></section>';
  }
  function panel(){
    const el=$('panel');
    if(!selected){
      el.innerHTML='<header class="sideHead"><div class="eyebrow">'+icon('layers')+'County overview</div><h1>Orange County</h1><p class="sub">California, United States</p></header><section class="block"><div class="blockHead"><h2>Study regions</h2><span class="count">6 regions</span></div><p class="empty">Select a city to explore its zoning districts.</p>'+D.regions.map(listRow).join('')+'</section>'+fileSection()+'<section class="block"><h2>Boundary source</h2><p class="boxNote">'+(official?'City limits are sourced from the California Department of Technology. Parcel boundaries can be imported separately.':'Study locations are shown as pins while city limits are unavailable.')+'</p></section>';
    }else{
      const s=selected,imported=s.kind==='parcel',landInfo=imported?[
        ['Parcel ID',s.parcelId||'Not supplied'],['Land size',s.area!=null?s.area.toLocaleString()+' ac · file value':'Unverified'],['Zoning','Unverified'],['Ownership','Unverified'],['Constraints','Unassessed']
      ]:[['Parcel ID','No parcel selected'],['Land size','Unverified'],['Zoning',s.kind==='region'?'Select a district above':'Unverified'],['Ownership','Unverified'],['Constraints','Unassessed']];
      el.innerHTML='<header class="sideHead"><button class="back" id="back">'+icon('left')+'County overview</button><div class="eyebrow">'+icon('pin')+(imported?'Imported site':s.kind==='place'?'Search result':'Study region')+'</div><h1>'+esc(s.name)+'</h1><p class="sub coords">'+coords(s)+'</p><span class="badge"><i></i>'+esc(s.boundary)+'</span></header><section class="block"><div class="blockHead"><h2>Land information</h2></div><dl class="info">'+landInfo.map(x=>info(...x)).join('')+'</dl>'+(imported?'<p class="empty">File attributes are unverified.'+(s.source?' Source supplied: '+esc(s.source):'')+'</p>':'')+'</section>'+nearbySection()+'<section class="block"><details><summary>Development visualisation</summary><p class="empty">Conceptual models, footprint and density estimates can be attached to a reviewed parcel in a future version. Approval status has not been assessed.</p></details></section><section class="block"><details><summary>Selection data</summary><div class="btnrow">'+btn('saveSelection','Save selection record','download')+btn('import','Import GeoJSON','upload')+'</div></details></section>';
    }
    el.querySelector('.sideHead').insertAdjacentHTML('afterend','<section id="opportunity-list" class="block listings"></section>');
    offers?.render(selected,mode);
    if(selected?.kind==='region'){const first=el.querySelector('.sideHead');first.insertAdjacentHTML('afterend','<section id="zone-panel" class="block zpanel"></section>');zones?.render();}
    const research='<section class="block zpanel"><h2>Research workbook</h2><div class="zlinks"><a target="_blank" rel="noopener" href="https://docs.google.com/spreadsheets/d/17NlGpn94b18pJvoRaVuTfZPA_nZlxd4IETw1rf1kFxY/edit#gid=1587836229">Legal pathways ↗</a><a target="_blank" rel="noopener" href="https://docs.google.com/spreadsheets/d/17NlGpn94b18pJvoRaVuTfZPA_nZlxd4IETw1rf1kFxY/edit#gid=1670023345">Parcel geometries ↗</a><a target="_blank" rel="noopener" href="https://docs.google.com/spreadsheets/d/17NlGpn94b18pJvoRaVuTfZPA_nZlxd4IETw1rf1kFxY/edit#gid=141901">Parcel checks ↗</a><a target="_blank" rel="noopener" href="https://docs.google.com/spreadsheets/d/17NlGpn94b18pJvoRaVuTfZPA_nZlxd4IETw1rf1kFxY/edit#gid=560422622">Conversion candidates ↗</a></div></section>';
    el.insertAdjacentHTML('beforeend',research);
    el.querySelectorAll('[data-rec]').forEach(b=>b.addEventListener('click',()=>choose(allRecords().find(s=>s.id===b.dataset.rec))));
    if($('back'))$('back').onclick=reset;if($('import'))$('import').onclick=()=>$('file').click();if($('nearby'))$('nearby').onclick=lookup;if($('saveSelection'))$('saveSelection').onclick=saveRecord;
    $('legendTitle').textContent=selected?selected.name:'Orange County';
    $('legendNote').textContent=selected?selected.boundary:(official?'Municipal boundaries · 6 study regions':'6 study locations');
    if(mode!=='2D')$('legendNote').textContent=photo.active?'Aerial perspective · flat terrain':globe.imageryStatus;
    $('sourceNote').innerHTML='Photography: USDA / USGS The National Map. Offshore context: NASA Blue Marble. Street map: OpenFreeMap Liberty with USGS Topo coverage. Place records: California public schools, CDPH, OCTA and <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap contributors (ODbL)</a>. City limits: <a href="'+D.cityInfo+'" target="_blank" rel="noopener">California Department of Technology</a>. City limits do not establish development eligibility.';
  }
  function updateCredit(){
    const street=mode==='2D'&&atlas.basemap==='streets';
    $('creditText').innerHTML=street?'<a target="_blank" rel="noopener" href="https://www.usgs.gov/programs/national-geospatial-program">USGS</a> · <a target="_blank" rel="noopener" href="https://openfreemap.org/">OpenFreeMap</a> · <a target="_blank" rel="noopener" href="https://openmaptiles.org/">OpenMapTiles</a> · <a target="_blank" rel="noopener" href="https://www.openstreetmap.org/copyright">© OpenStreetMap</a>':'<a target="_blank" rel="noopener" href="https://www.usgs.gov/programs/national-geospatial-program">USDA / USGS</a> · NASA'+(mode==='2D'||photo.active?'':' · CesiumJS');
    $('scale').hidden=mode!=='2D';
    for(const [k,active] of [['aerial',!street],['streets',street]])$(k).setAttribute('aria-pressed',String(active));
  }
  function modes(next){mode=next;offers?.mode(selected,mode);for(const [id,m] of [['two','2D'],['three','3D'],['orbit','Orbit']])$(id).setAttribute('aria-pressed',String(m===next));updateCredit();}
  function flat(){
    ++cameraSeq;photo.close();globe?.stop();$('globe').hidden=true;$('atlas').hidden=false;hideTip();modes('2D');atlas.resize();
    $('legendNote').textContent=selected?selected.boundary:'6 study regions';
  }
  function photoFallback(wanted='3D'){
    satelliteFailed=true;globe.stop();$('globe').hidden=true;$('atlas').hidden=true;hideTip();photo.show(selected,wanted==='Orbit');modes(wanted);
    $('legendNote').textContent='Aerial perspective · flat terrain';
    notice('The interactive globe could not start. Showing an aerial preview. Press 3D to retry.',7000);
  }
  async function perspective(wanted='3D'){
    if(wanted==='Orbit'&&!selected){notice('Choose a region or parcel to orbit.');return;}
    if(wanted==='Orbit'&&mode==='Orbit'){if(photo.active)photo.show(selected,false);else globe.stop();modes('3D');return;}
    const seq=++cameraSeq,was3=mode!=='2D';satelliteFailed=false;if(!was3){$('globe').hidden=false;$('globe').style.visibility='hidden';}
    let timed=setTimeout(()=>{if(seq===cameraSeq)notice('Opening the 3D aerial view…',2500);},400);
    try{
      await globe.init();if(seq!==cameraSeq)return;
      if(globe.imageryStatus.startsWith('Photorealistic tiles unavailable'))globe.applyTerrain(window.LANDSCOUT_CONFIG?.ionPublicToken);
      photo.close();$('globe').style.visibility='';$('globe').hidden=false;$('atlas').hidden=true;hideTip();$('toast').hidden=true;$('legendNote').textContent=globe.imageryStatus;
      globe.resize();globe.setRecords(allRecords(),selected,iconsVisible?near:[]);modes(wanted);
      if(wanted==='Orbit'&&was3)globe.orbit(selected);
      else {
        let target=selected;
        if(wanted==='3D'&&!was3&&atlas.map.getZoom()>=14){
          const centre=atlas.map.getCenter(),bounds=atlas.map.getBounds();
          const viewRange=atlas.map.distance(bounds.getNorthWest(),bounds.getSouthWest())*1.35;
          target={lon:centre.lng,lat:centre.lat,viewRange:Math.max(300,viewRange)};
        }
        globe.fly(target,wanted==='Orbit'?()=>{if(seq===cameraSeq)globe.orbit(selected);}:undefined);
      }
    }catch(e){if(seq!==cameraSeq)return;photoFallback(wanted);}
    finally{clearTimeout(timed);}
  }
  function choose(s){if(!s)return;zoneOrigin=null;selected=s;near=[];nearState='idle';nearSeq++;hideTip();closeSearch();photo.setAmenities([]);atlas.setAmenities([]);atlas.setSelection(s);if(mode!=='2D')flat();zones.selectCity(s);atlas.fly(s);panel();$('panel').scrollTop=0;if(s.kind==='region'){lookup();}else perspective();}
  function reset(){zoneOrigin=null;zones.selectCity(null);flat();selected=null;near=[];nearState='idle';nearSeq++;closeSearch();$('toast').hidden=true;atlas.setSelection(null);photo.setAmenities([]);atlas.setAmenities([]);atlas.home();panel();$('panel').scrollTop=0;}
  async function lookup(){const target=selected;if(!target)return;const seq=++nearSeq;nearState='loading';panel();
    try{const result=await D.nearby(zoneOrigin||target);if(seq!==nearSeq||selected!==target)return;near=result;nearState='done';const pins=iconsVisible?near:[];photo.setAmenities(pins);atlas.setAmenities(pins);globe.setRecords(allRecords(),selected,pins);}
    catch{if(seq!==nearSeq||selected!==target)return;nearState='failed';}
    panel();
  }
  function saveRecord(){if(!selected)return;const s=selected;const data={name:s.name,coordinates:[s.lon,s.lat],type:s.kind,boundary_status:s.boundary,parcel_id:s.parcelId||null,reported_acres_unverified:s.area??null,legal_status:'not_assessed',source:s.kind==='region'&&official?D.cityInfo:s.source||null};const a=document.createElement('a'),u=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));a.href=u;a.download='landscout-selection.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}
  function closeSearch(){searchSeq++;clearTimeout(searchTimer);$('results').hidden=true;$('query').setAttribute('aria-expanded','false');}
  function results(items,msg){
    searchResults=items;$('results').hidden=false;$('query').setAttribute('aria-expanded','true');
    $('results').innerHTML=items.map((s,i)=>'<button class="result" data-result="'+i+'">'+esc(s.name)+'<small>'+esc(s.subtitle||s.boundary)+'</small></button>').join('')+(msg?'<div class="searchmsg">'+esc(msg)+'</div>':'');
    $('results').querySelectorAll('[data-result]').forEach(b=>b.onclick=()=>{const s=searchResults[Number(b.dataset.result)];$('query').value=s.name;choose(s);});
  }
  function search(){
    clearTimeout(searchTimer);const seq=++searchSeq,q=$('query').value.trim().toLowerCase(),local=[...D.regions,...imports].filter(r=>r.name.toLowerCase().includes(q)||String(r.parcelId||'').toLowerCase().includes(q)&&q).slice(0,7);
    results(local,q.length<3?(local.length?'':'Enter at least three characters for address search.'):'Searching Photon…');
    if(q.length<3)return;
    searchTimer=setTimeout(async()=>{try{const remote=await D.photon(q);if(seq!==searchSeq)return;const rows=[...local,...remote.filter(x=>!local.some(r=>r.name.toLowerCase()===x.name.toLowerCase()))].slice(0,8);results(rows,rows.length?'':'No places found in the Orange County search area.');}catch{if(seq===searchSeq)results(local,'Address service unavailable. Local study regions remain searchable.');}},330);
  }
  const callbacks={imagery:label=>{if(mode!=='2D'&&!photo.active)$('legendNote').textContent=label;},pick:choose,tip,hideTip,notice,scale,manual:()=>{globe.stop();modes('3D');},failure:()=>photoFallback(mode==='Orbit'?'Orbit':'3D'),basemapChanged:()=>updateCredit()};
  atlas=atlasFactory($('raster-map'),D,callbacks);globe=globeFactory($('globe'),D,callbacks);globe.setRecords(allRecords(),null,[]);offers=opportunities(atlas.map,D.regions,()=>{if(mode!=='2D')flat();});zones=zoningInspector(atlas.map,point=>{zoneOrigin={lon:point.lng,lat:point.lat};lookup();});
  $('brand').onclick=reset;$('home').onclick=reset;$('two').onclick=flat;$('three').onclick=()=>perspective();$('orbit').onclick=()=>perspective('Orbit');
  $('north').onclick=()=>{if(mode==='2D')notice('North is up in the county atlas.',2000);else if(photo.active){photo.north();modes('3D');}else perspective();};
  $('zoomIn').onclick=()=>(mode==='2D')?atlas.zoomBy(1):(photo.active?photo.zoom(1):globe.zoomBy(1));$('zoomOut').onclick=()=>(mode==='2D')?atlas.zoomBy(-1):(photo.active?photo.zoom(-1):globe.zoomBy(-1));
  $('query').addEventListener('input',search);$('query').addEventListener('focus',search);
  $('query').addEventListener('keydown',e=>{if(e.key==='ArrowDown'){$('results').querySelector('button')?.focus();e.preventDefault();}if(e.key==='Enter'&&searchResults[0]&&!$('results').hidden){const s=searchResults[0];$('query').value=s.name;choose(s);}});
  document.addEventListener('pointerdown',e=>{if(!e.target.closest('.find'))closeSearch();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeSearch();if(e.key==='/'&&!['INPUT','TEXTAREA'].includes(document.activeElement.tagName)&&!$('dialog').open){e.preventDefault();$('query').focus();}});
  $('applyTerrain').onclick=()=>{
    const token=$('terrainToken').value.trim();const photoreal=$('usePhotoreal').checked;
    if(photoreal&&!token){notice('Enter a public Cesium ion token to enable photorealistic tiles.');$('terrainToken').focus();return;}
    window.LANDSCOUT_CONFIG={...(window.LANDSCOUT_CONFIG||{}),ionPublicToken:token,photoreal};
    $('terrainToken').value='';globe.applyTerrain(token);satelliteFailed=false;panel();$('dialog').close();if(token&&mode!=='2D'){flat();perspective();}notice(token?'3D configuration applied to this tab.':'Using the ellipsoid terrain surface.');
  };
  $('showPOI').onchange=()=>{iconsVisible=$('showPOI').checked;const pins=iconsVisible?near:[];photo.setAmenities(pins);atlas.setAmenities(pins);globe.setRecords(allRecords(),selected,pins);};
  $('settings').onclick=()=>{$('retry3d').hidden=!satelliteFailed;$('dialog').showModal();};$('retry3d').onclick=()=>{satelliteFailed=false;$('dialog').close();flat();perspective();};$('closeDialog').onclick=()=>$('dialog').close();
  for(const [id,key] of [['showLabels','labels'],['showRegions','regions']])$(id).onchange=()=>{atlas.settings[key]=$(id).checked;atlas.draw();if(key==='labels')globe.setLabels(atlas.settings.labels);};
  $('file').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{
    if(file.size>5*1024*1024)throw Error('Choose a GeoJSON file smaller than 5 MB.');
    const rows=D.importGeoJSON(JSON.parse(await file.text()));imports=rows;atlas.setImports(imports);choose(rows[0]);notice('Imported '+rows.length+' unverified '+(rows.length===1?'site.':'sites.'));
    }catch(err){notice(err instanceof SyntaxError?'This file is not valid JSON.':err.message||'Could not import this file.');}finally{e.target.value='';}};
  $('aerial').onclick=()=>{if(mode!=='2D')flat();atlas.setBasemap('aerial');updateCredit();};
  $('streets').onclick=()=>{if(mode!=='2D')flat();atlas.setBasemap('streets');updateCredit();};
  panel();updateCredit();
}
