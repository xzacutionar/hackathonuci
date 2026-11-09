const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const link=(url,label)=>/^https:\/\//.test(url||'')?'<a href="'+esc(url)+'" target="_blank" rel="noopener">'+esc(label)+' ↗</a>':'';
const cityCodes={'Laguna Niguel':'LN','Irvine':'IRV','Santa Ana':'SA','Anaheim':'ANA','Garden Grove':'GG','Tustin':'TUSTIN','Orange':'ORANGE','Westminster':'WESTMINSTER'};
const normal=s=>String(s).toUpperCase().replace(/[^A-Z0-9]/g,'');
let loaded;
function readData(){
 if(!loaded)loaded=Promise.all(['listing-districts','listing-law-sources','zoning-law','research-index','supplemental-listing-zones'].map(async name=>{
   const r=await fetch('/data/'+name+'.json');if(!r.ok)throw Error('Source unavailable');return r.json();
 })).catch(e=>{loaded=undefined;throw e;});
 return loaded;
}
function prepare(r,[districts,sources,catalogue,research,supplement]){
 const mapped=districts[r.listing_id]||supplement[r.listing_id],zones=mapped?.zones||[],key=cityCodes[r.city],city=catalogue.cities[key];
 // Very small overlaps in simplified geometry require a boundary check before using their rules.
 const primary=zones.filter(z=>z.share>=.01),minor=zones.filter(z=>z.share<.01);
 const localCodes=primary.length?primary.map(z=>z.code):String(r.zoning_code||'').split(/\s*\/\s*/);
 const local=localCodes.map(code=>{
   const item=sources[key+'_'+normal(code)];
   if(item)return item;
   const rule=city?.rules.find(x=>x.codes.some(c=>normal(c)===normal(code)));
   if(rule)return {title:r.city+' · '+code,check:rule.benefit+' '+rule.caution,url:rule.url};
   return {title:r.city+' · '+code,check:'Check this district’s permitted and conditional uses, overlay provisions and development standards in the city code. A property-specific use determination is pending.',url:mapped?.ordinance||city?.url||sources[key+'_CODE']?.url};
 });
 if(r.listing_id==='CC-01'&&sources.CC01_CEQA)local.push(sources.CC01_CEQA);
 if(String(r.zoning_code).includes('OZ1')&&!localCodes.includes('OZ1')&&sources.SA_OZ1)local.push({...sources.SA_OZ1,title:'Workbook overlay to verify · Metro East (OZ1)'});
 const screen=String(r.potential_pathways||'');
 const routes=[];
 function add(item,why){if(item)routes.push({...item,why});}
 if(/AB\s*507/i.test(screen)&&!/AB\s*507\s*N\/A/i.test(screen))add(sources.AB507,'The workbook identifies this existing building for adaptive-reuse screening.');
 const districtText=primary.length?primary.map(z=>z.name).join(' / '):String(r.zoning_description||'');
 const commercialUse=/commercial|office|professional|retail/i.test(districtText);
 if(commercialUse||/AB\s*2011/i.test(screen)){
   const ab=catalogue.pathways.find(p=>p.title.startsWith('AB 2011'));
   if(ab)add({title:ab.title,check:ab.benefit+' '+ab.caution,url:ab.url},'The '+districtText+' designation warrants a use-table check. Confirm that the site permits a qualifying commercial use and meets the route-specific exclusions.');
 }
 if(commercialUse||/SB\s*6/i.test(screen))add(sources.SB6,'Screen the local permitted uses for an eligible commercial-site housing route.');
 if(/Santa Ana Adaptive Reuse Ordinance/i.test(screen))add(sources.SA_REUSE,'Confirm that the property is within an eligible city reuse area.');
 if(/AB\s*1490/i.test(screen))add(sources.AB1490,'Unresolved prerequisite: verify that the existing building allows temporary dwelling or occupancy.');
 if(/Homekey/i.test(screen))add(sources.HOMEKEY,'Workbook funding lead. Confirm programme availability and acquisition criteria separately from zoning permission.');
 const bonus=catalogue.pathways.find(p=>p.title.startsWith('State Density'));
 if(bonus)add({title:bonus.title,check:bonus.benefit+' '+bonus.caution,url:bonus.url},'Project-level check: document an eligible housing proposal and its affordable units.');
 const sb4=catalogue.pathways.find(p=>p.title.startsWith('SB 4'));
 if(sb4)add({title:sb4.title,check:sb4.benefit+' '+sb4.caution,url:sb4.url},'Ownership-dependent only. This listing does not establish qualifying ownership.');
 const pending=research.rows.filter(p=>routes.some(t=>p.id==='LAW-AB2011'&&t.title.startsWith('AB 2011')||p.id==='LAW-SB4'&&t.title.startsWith('SB 4')));
 return {mapped,primary,minor,local,routes,pending,key,screen};
}
function card(item,i){return '<details class="law-card"'+(i===0?' open':'')+'><summary>'+esc(item.title)+'</summary><p>'+esc(item.why||'')+'</p><p>'+esc(item.check)+' '+link(item.url,'Official source')+'</p></details>';}
export async function showPropertyLaws(el,r,compact=false){
 el.innerHTML='<h3>District laws for this property</h3><p>Checking the listing’s zoning sources…</p>';
 try{
  const {mapped,primary,minor,local,routes,pending,key,screen}=prepare(r,await readData());
  const label=primary.length?primary.map(z=>z.code+' · '+z.name).join(' / '):r.zoning_code+' · '+r.zoning_description;
  let html='<h3>District laws for this property</h3><p class="district-label">'+esc(r.city)+' · '+esc(label)+'</p>';
  html+='<p>'+ (primary.length?'Parcel footprint matched to mapped zoning. '+link(mapped.source,'GIS source'):'Workbook designation; municipal parcel match unconfirmed.')+'</p>';
  if(primary.length&&(normal(primary.map(z=>z.code).join('/'))!==normal(r.zoning_code)||!primary.some(z=>normal(z.name)===normal(r.zoning_description))))html+='<p class="scope-note">Workbook designation: '+esc(r.zoning_code)+' · '+esc(r.zoning_description)+'. Confirm the district and overlays with the city.</p>';
  if(mapped?.caution)html+='<p class="scope-note">'+esc(mapped.caution)+'</p>';
  if(compact){
    html+=local.slice(0,1).map(i=>'<b>'+esc(i.title)+'</b><p>'+esc(i.check)+' '+link(i.url,'District rule')+'</p>').join('');
    html+='<p><strong>Pathways to check</strong><br>'+esc(routes.map(i=>i.title.startsWith('Santa Ana ·')?'Santa Ana Adaptive Reuse Ordinance':i.title.split(' · ')[0]).join(' • '))+'</p>';
  }else{
    html+=local.map(i=>'<div class="district-rule"><b>'+esc(i.title)+'</b><p>'+esc(i.check)+' '+link(i.url,'Read the district rule')+'</p></div>').join('');
    if(minor.length)html+='<p>Minor map intersections below 1% of the footprint: '+esc(minor.map(z=>z.code).join(', '))+'. Confirm the legal boundary before relying on these designations.</p>';
    html+='<h4>Housing pathways to check</h4><p>These are screening leads. Open a law for its conditions and official source.</p>'+routes.map(card).join('');
    if(/AB\s*507\s*N\/A/i.test(screen))html+='<p><b>Workbook exclusion flagged:</b> '+esc(screen.split('|').find(t=>/AB\s*507/i.test(t)))+'. Verify the operating history with the city.</p>';
    if(pending.length)html+='<p>'+pending.map(p=>esc(p.name+' · '+p.status)).join('<br>')+'</p>';
  }
  el.innerHTML=html;
 }catch{el.innerHTML='<h3>District laws for this property</h3><p>Law sources could not load. Reopen the property to retry.</p>';}
}
