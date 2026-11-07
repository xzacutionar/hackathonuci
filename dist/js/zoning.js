const escape=v=>String(v??'').replace(/[&<>"']/g,k=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[k]));
const sheet='https://docs.google.com/spreadsheets/d/17NlGpn94b18pJvoRaVuTfZPA_nZlxd4IETw1rf1kFxY/edit';
const url=(tab,row)=>sheet+'#gid='+tab+(row?'&range=A'+row:'');
const link=(href,label)=>/^https:\/\//.test(href||'')?'<a target="_blank" rel="noopener" href="'+escape(href)+'">'+escape(label)+' ↗</a>':'';
const fetchJson=async p=>{const r=await fetch('/data/'+p);if(!r.ok)throw Error('Unavailable');return r.json();};
const catalogue=Promise.all([fetchJson('research-index.json'),fetchJson('research-rows.json'),fetchJson('zoning-law.json').catch(()=>({})),fetchJson('research-points.json').catch(()=>({pts:{},checks:[]}))]);
const cache=new Map();
function family(n){
 const t=String(n).toLowerCase();
 if(/mixed|multi.use|transit.oriented/.test(t))return 'Mixed use';
 if(/residen|dwelling|housing|family|family residential/.test(t))return 'Residential';
 if(/industr|manufactur/.test(t))return 'Industrial';
 if(/commerc|retail|office|business/.test(t))return 'Commercial';
 if(/park|open space|recreat|conserv|agricultur/.test(t))return 'Open land';
 return 'Other';
}
export const colors={'Residential':'#a3ce92','Mixed use':'#d0a3e2','Industrial':'#9faacb','Commercial':'#ecb386','Open land':'#b2cfbd','Other':'#d9ce9a'};
const questions={
 Residential:['A residential designation makes the allowed housing type and density the first checks.','Verify the unit cap, minimum lot area, parking and setbacks before estimating affordable units.'],
 'Mixed use':['Housing near shops or transport may support a mixed-use proposal.','Check whether housing is allowed on the selected frontage and whether ground-floor commercial space is required.'],
 Commercial:['A commercial site can be screened for residential conversion or an affordable-housing pathway.','Commercial zoning alone does not establish residential permission. Check eligible uses, corridor conditions and existing tenancies.'],
 Industrial:['A reused industrial site may offer a larger footprint for a housing feasibility study.','Investigate contamination, neighbouring industrial uses and residential-use restrictions before estimating capacity.'],
 'Open land':['The designation helps identify land that may warrant early conservation or public-use review.','Check preservation restrictions, easements and public ownership before considering housing.'],
 Other:['The district code gives planners a starting point for checking the applicable use table.','Specific plans, overlays and parcel-level constraints may control the proposal. Confirm the exact provision.']
};
function contains(g,point){
  if(!point)return false;
  const [x,y]=point;
  function ring(coords){let inside=false;for(let i=0,j=coords.length-1;i<coords.length;j=i++){
    const [a,b]=coords[i],[c,d]=coords[j];
    if((b>y)!==(d>y)&&x<(c-a)*(y-b)/(d-b)+a)inside=!inside;
  }return inside;}
  return (g.type==='MultiPolygon'?g.coordinates:[g.coordinates]).some(p=>ring(p[0])&&!p.slice(1).some(ring));
}
export function zoningInspector(map,onPoint){
 const pane=map.createPane('zoning');pane.style.zIndex='435';
 const renderer=L.canvas({pane:'zoning',padding:.3}),layer=L.layerGroup().addTo(map);
 let overlaps=[],city=null,data=null,focus=null,highlight=null,sequence=0,failed=false,refs=null;
 catalogue.then(v=>{refs=v;render();}).catch(()=>{});
 function selectFeature(feature,path,latlng){
   overlaps=latlng?data.features.filter(f=>f!==feature&&contains(f.geometry,[latlng.lng,latlng.lat])):[];
   if(highlight)highlight.setStyle({weight:1,color:'#63576a'});
   focus=feature;highlight=path;path.setStyle({weight:3,color:'#362048'});path.bringToFront();render();onPoint(latlng||path.getBounds().getCenter());
 }
 // Select the smallest mapped section at the clicked position, even where a municipal outline overlaps it.
 map.getContainer().addEventListener('click',event=>{
   if(!city||!data||event.target.closest('.leaflet-marker-icon,.leaflet-popup,.leaflet-control')||map.dragging?.moved())return;
   const ll=map.mouseEventToLatLng(event),point=[ll.lng,ll.lat];let picked=null,size=Infinity;
   for(const group of layer.getLayers())group.eachLayer(path=>{
     const bounds=path.getBounds();if(!bounds.contains(ll)||!contains(path.feature.geometry,point))return;
     const area=(bounds.getEast()-bounds.getWest())*(bounds.getNorth()-bounds.getSouth());
     if(area<size){size=area;picked=path;}
   });
   if(picked){event.stopPropagation();selectFeature(picked.feature,picked,ll);}
 },true);
 function selectCity(s){
   const id=++sequence;city=s?.kind==='region'?s:null;focus=null;highlight=null;data=null;failed=false;layer.clearLayers();render();
   if(!city)return;
   const key=city.id;
   if(!cache.has(key))cache.set(key,fetchJson('zones-'+key+'.json'));
   cache.get(key).then(fc=>{
     if(id!==sequence)return;data=fc;
     L.geoJSON(fc,{renderer,pane:'zoning',style:f=>({color:'#63576a',weight:1,fillOpacity:.5,fillColor:colors[family(f.properties.name)]}),onEachFeature:(f,path)=>{
       const p=f.properties;path.bindTooltip(escape(p.code)+' · '+escape(p.name),{sticky:true});
       path.on('click',e=>{L.DomEvent.stopPropagation(e.originalEvent);selectFeature(f,path,e.latlng);});
     }}).addTo(layer);render();
   }).catch(()=>{cache.delete(key);if(id===sequence){failed=true;render();}});
 }
 function render(){
   const box=document.querySelector('#zone-panel');if(!box||!city)return;
   const laws=refs?.[2]?.cities?.[city.id]||{};
   const tabs=refs?.[0]?.tabs||{};
   const base='<h2>Zoning districts</h2>';
   const sources='<div class="zlinks">'+link(data?.source,'Zoning map source')+link(data?.ordinance||laws.url,'City zoning ordinance')+link(url(tabs['Legal Pathways']||1587836229),'Legal Pathways sheet')+'</div>';
   const vintage=city.id==='CM'?'Historical zoning: SCAG’s map book uses Costa Mesa local zoning dated 27 September 2017. Confirm the current classification with the city before relying on it.':(data?.vintage||'');
   let body=failed?'<p>District geometry is unavailable for this city.</p>':!data?'<p>Loading city zoning…</p>':'<p>Click a coloured section on the 2D map to inspect its zoning and housing considerations.</p>';
   if(data){
     const entries=new Map();for(const f of data.features)entries.set(f.properties.code,f.properties.name);
     body+='<label>Inspect a district<select id="zone-picker"><option value="">Select zoning code</option>'+[...entries].sort((a,b)=>String(a[0]).localeCompare(String(b[0]),undefined,{numeric:true})).map(([c,n])=>'<option value="'+escape(c)+'" '+(focus&&String(focus.properties.code)===String(c)?'selected':'')+'>'+escape(c)+' · '+escape(n)+'</option>').join('')+'</select></label>';
   }
   if(focus){
     const {code,name}=focus.properties,kind=family(name),rule=laws.rules?.find(r=>r.codes.some(c=>String(c).toLowerCase()===String(code).toLowerCase()));
     const assessment=rule?[rule.benefit,rule.caution]:questions[kind];
     body+='<h3>'+escape(code)+' · '+escape(name)+'</h3><p class="boxNote">'+(rule?'District-specific ordinance screening':'General screening for this land-use type. The local use table still needs review.')+'</p><strong>Potential advantage</strong><p>'+escape(assessment[0])+'</p><strong>Constraint to check</strong><p>'+escape(assessment[1])+'</p>'+link(rule?.url||laws.url,'Check the district rules');
     if(overlaps.length)body+='<p>Other designations mapped at this point: '+escape([...new Set(overlaps.map(f=>f.properties.code+' · '+f.properties.name))].join(', '))+'. Check both provisions.</p>';
     const spatial=(refs?.[1]||[]).filter(r=>r.tab==='Parcel Geometries'&&contains(focus.geometry,refs?.[3]?.pts?.[r.id]));
     body+='<details><summary>Parcel research points inside this section ('+spatial.length+')</summary><p>Sample of workbook rows 2–1000, located by their recorded points. Open the sheet for the complete inventory.</p>'+spatial.slice(0,8).map(r=>{
       const checks=(refs?.[3]?.checks||[]).filter(c=>String(c.id)===String(r.id)).slice(0,3);
       return link(url(tabs[r.tab],r.row),r.name||r.id)+' '+checks.map(c=>link(url(tabs['Parcel Checks'],c.row),c.law+' · '+c.status)).join(' ');
     }).join('<br>')+'</details>';
     const candidates=(refs?.[1]||[]).filter(r=>String(r.city).toLowerCase()===city.name.toLowerCase()&&String(r.code).trim().toLowerCase()===String(code).trim().toLowerCase());
     body+='<details><summary>Other workbook matches by city and code ('+candidates.length+')</summary><p>Indexed sample from 7 November 2026. A matching code does not establish that a record lies inside this specific polygon.</p>'+candidates.slice(0,8).map(r=>link(url(tabs[r.tab],r.row),r.name||r.id)).join('<br>')+'</details>';
     body+='<details><summary>Affordable-housing laws to screen</summary>';
     for(const pathway of (refs?.[2]?.pathways||[]).filter(p=>!p.title.startsWith('AB 2011')||['Commercial','Mixed use','Other'].includes(kind)))body+='<p><strong>'+escape(pathway.title)+'</strong><br>'+escape(pathway.benefit)+' '+escape(pathway.caution)+' '+link(pathway.url,'Official text')+'</p>';
     body+='<p>Workbook leads below are pending review. Eligibility depends on the parcel, project and statutory conditions.</p>'+((refs?.[0]?.rows)||[]).filter(r=>['LAW-SB9','LAW-SB4','LAW-AB2011','LAW-SB684','LAW-SLA'].includes(r.id)).map(r=>link(url(tabs['Legal Pathways'],r.row),r.name+' · '+r.status)).join('<br>')+'</details>';
   }
   box.innerHTML=base+(vintage?'<p class="boxNote">'+escape(vintage)+'</p>':'')+body+sources;
   const picker=box.querySelector('select');if(picker)picker.onchange=()=>{let first;for(const group of layer.getLayers())group.eachLayer(p=>{if(String(p.feature.properties.code)!==picker.value)return;if(!first||map.distance(map.getCenter(),p.getBounds().getCenter())<map.distance(map.getCenter(),first.getBounds().getCenter()))first=p;});if(first){selectFeature(first.feature,first);map.stop();map.fitBounds(first.getBounds(),{maxZoom:14.5,padding:[32,32],animate:false});}};
 }
 return {selectCity,render};
}
