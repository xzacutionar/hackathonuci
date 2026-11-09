import {showPropertyLaws} from './property-laws.js';
import {inspectListing,yieldLabel,guide,compareListings,photoRecords,thumbnailUrl} from './site-review.js';
import {colors} from './zoning.js';
import {amenityIcon} from './amenity-icons.js';
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pin='<img class="sale-pin" src="/imagery/commercial-building.svg" alt="">';
export function opportunities(map,regions,showMap,view3D){
  map.createPane('saleParcel').style.zIndex='460';
  const layer=L.layerGroup().addTo(map);
  const leaders=L.layerGroup().addTo(layer),pins=[];
  function separatePins(){
    leaders.clearLayers();const placed=[];
    for(const {marker,location} of pins){
      const origin=map.project(location);let display=origin;
      if(placed.some(p=>Math.abs(p.x-origin.x)<28&&Math.abs(p.y-origin.y)<28)){
        outer:for(let radius=30;radius<=150;radius+=15){
          for(let i=0;i<12;i++){
            const angle=i*Math.PI/6;
            const q=L.point(origin.x+radius*Math.cos(angle),origin.y+radius*Math.sin(angle));
            if(placed.every(p=>Math.abs(p.x-q.x)>=28||Math.abs(p.y-q.y)>=28)){display=q;break outer;}
          }
        }
      }
      placed.push(display);const ll=map.unproject(display);marker.setLatLng(ll);
      if(display!==origin)L.polyline([location,ll],{color:'#185b41',weight:1.4,interactive:false,pane:'saleParcel'}).addTo(leaders);
    }
  }
  map.on('zoomend',separatePins);
  let rows=[],selectedCity=null,mode='2D',visible=true,outline=null,failed=false;
  const key=document.createElement('details');
  key.className='map-legend';key.open=innerWidth>660;
  key.innerHTML='<summary>Map legend</summary><div class="key-body"></div>';
  document.querySelector('.chart').append(key);
  function clear(){if(outline){outline.remove();outline=null;}}
  map.on('popupclose',clear);
  function paintKey(){
    const isFlat = mode === '2D';
    const districts = selectedCity?.kind === 'region';
    const entries = districts ? Object.entries(colors) : regions.map(s => [s.name, s.color]);
    const swatches = isFlat ? '<strong>'+(districts?'Zoning categories':'Study cities')+'</strong><div class="key-swatches">'+entries.map(([label,color])=>'<span><i style="background:'+color+'"></i>'+escape(label)+'</span>').join('')+'</div>' : '';
    const amenities = '<div class="key-icons">'+['Schools','Health','Transport','Shopping','Employment'].map(cat=>'<span><img src="'+amenityIcon(cat)+'" alt="">'+cat+'</span>').join('')+'</div>';
    const listings = isFlat ? '<label><input type="checkbox" '+(visible?'checked':'')+'> '+pin+' Commercial listings</label>' : '';
    key.querySelector('.key-body').innerHTML = swatches + amenities + listings;
    if (isFlat) key.querySelector('input').onchange=e=>{visible=e.target.checked;if(visible)layer.addTo(map);else{map.closePopup();layer.remove();}};
  }
  function details(r){
    const notes=[['Asking price',r.asking_price==='Not listed'?'Price undisclosed':r.asking_price],['Building',r.property_type],['Floor area',Number(r.building_sf)>0?Number(r.building_sf).toLocaleString()+' sq ft':null],['Listing status',r.listing_status],['Parcel acres',r.parcel_acres],['Zoning',[r.zoning_code,r.zoning_description].filter(Boolean).join(' · ')],['Housing use · unverified',r.listing_id==='CC-20'?'Conflicting PR descriptions; verify the use table.':r.residential_allowed_by_zoning]];
    return '<div class="property-pop"><small>Commercial conversion candidate</small><h3>'+escape(r.property_name)+'</h3><div data-preview-photo></div><p>'+escape(r.address)+'</p><section class="property-laws compact" data-property-laws></section><dl>'+notes.filter(x=>x[1]).map(([k,v])=>'<dt>'+escape(k)+'</dt><dd>'+escape(v)+'</dd>').join('')+'</dl>'+(r.listing_id==='CC-03'?'<p>Workbook figures cover one building. The supplied photo gallery is a separate two-building portfolio.</p>':'')+'<div class="yield-preview"><b>'+escape(yieldLabel(r))+'</b><small>Floor-area scenario</small><button class="btn" data-property-review>Photos, zoning &amp; unit estimate</button></div><details><summary>Screening notes</summary><p>'+escape(r.screen_notes||'No notes supplied.')+'</p><p>'+escape(r.potential_pathways||'Pathway review pending.')+'</p></details><p class="property-date">Source checked '+escape(String(r.listing_checked_utc).slice(0,10))+'. Confirm availability with the broker and conversion eligibility with the city.</p><p>'+(/^https?:\/\//.test(r.listing_url)?'<a target="_blank" rel="noopener" href="'+escape(r.listing_url)+'">View listing ↗</a>':'')+'</p></div>';
  }
  function open(r){
    showMap(r);map.closePopup();clear();visible=true;layer.addTo(map);paintKey();
    const at=[Number(r.latitude),Number(r.longitude)];
    map.stop();
    outline=L.geoJSON(r.geometry,{pane:"saleParcel",interactive:false,style:{color:'#106344',weight:3,fillColor:'#46a87b',fillOpacity:.32}}).addTo(map);
    const zoom=Math.max(16,map.getZoom());
    function arrived(){
      if(map.getZoom()!==zoom||map.distance(map.getCenter(),at)>8)return;
      showDetails(r,at);
    }
    if(map.getZoom()===zoom&&map.distance(map.getCenter(),at)<=8){arrived();return;}
    map.once('moveend',arrived);
    map.flyTo(at,zoom,{animate:!matchMedia('(prefers-reduced-motion: reduce)').matches,duration:1.35});
  }
  function showDetails(r,at){
    const popup=L.popup({maxWidth:360,maxHeight:335,offset:[0,-12]}).setLatLng(at).setContent(details(r)).openOn(map);
    const root=popup.getElement();
    showPropertyLaws(root.querySelector('[data-property-laws]'),r,true);
    const review=(section='laws')=>inspectListing(r,section,view3D);
    review();
    root.querySelector('[data-property-review]').onclick=()=>review();
    photoRecords(r.listing_id).then(records=>{if(!root.isConnected||!records[0])return;const p=records[0],target=root.querySelector('[data-preview-photo]');target.innerHTML='<button class="preview-photo" aria-label="Open property photos"><img src="'+escape(thumbnailUrl(p))+'" alt="'+escape(p.caption)+'"></button>';target.querySelector('button').onclick=()=>review('photos');}).catch(()=>{});
  }
  function renderList(){
    const box=document.getElementById('opportunity-list');if(!box)return;
    const local=selectedCity?.kind==='region'?rows.filter(r=>r.city===selectedCity.name):rows;
    box.innerHTML='<details><summary>Commercial listings ('+local.length+')</summary><p class="empty">'+(failed?'The listing snapshot could not load.':local.length?'Properties for acquisition and conversion screening.':'No candidates for this city in this listing snapshot.')+'</p>'+local.map(r=>'<button class="listing-row" data-listing="'+escape(r.listing_id)+'">'+pin+'<span><b>'+escape(r.property_name)+'</b><small>'+escape(r.city)+' · '+(r.listing_status?escape(r.listing_status)+' · ':'')+escape(r.asking_price==='Not listed'?'Price undisclosed':r.asking_price)+'</small></span></button>').join('')+'</details>';
    const guideButton=document.createElement('button');guideButton.className='btn';guideButton.textContent='Fast-track site criteria';guideButton.onclick=guide;box.prepend(guideButton);const compare=document.createElement("button");compare.className="btn";compare.textContent="Compare acreage & zoning";compare.disabled=!local.length;compare.onclick=()=>compareListings(local,open);box.prepend(compare);
    box.querySelectorAll('[data-listing]').forEach(b=>{
      const id=b.dataset.listing;
      b.onclick=()=>open(rows.find(r=>r.listing_id===id));
      photoRecords(id).then(records=>{
        if(!b.isConnected||!records.length)return;
        const thumb=b.querySelector('img');thumb.className='site-thumb';thumb.loading='lazy';thumb.src=thumbnailUrl(records[0]);
      }).catch(()=>{});
    });
  }
  fetch('/data/commercial-listings.json').then(r=>{if(!r.ok)throw Error();return r.json();}).then(records=>{
    rows=records;
    for(const r of rows){
      const at=[Number(r.latitude),Number(r.longitude)];if(!at.every(Number.isFinite))continue;
      const m=L.marker(at,{zIndexOffset:800,title:r.property_name,alt:r.property_name,icon:L.divIcon({className:'listing-marker',html:pin,iconSize:[25,25],iconAnchor:[12,12]})});
      m.on('click',()=>open(r));m.addTo(layer);pins.push({marker:m,location:at});
    }
    separatePins();renderList();
  }).catch(()=>{failed=true;renderList();});
  paintKey();
  return {render(s,m){selectedCity=s;mode=m;paintKey();renderList();},mode(s,m){selectedCity=s;mode=m;paintKey();}};
}
