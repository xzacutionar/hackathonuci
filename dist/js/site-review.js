import {showPropertyLaws} from './property-laws.js';
const e=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sheet='https://docs.google.com/spreadsheets/d/17NlGpn94b18pJvoRaVuTfZPA_nZlxd4IETw1rf1kFxY/edit#gid=560422622';
const link=(href,label)=>/^https?:\/\//.test(href||'')?'<a target="_blank" rel="noopener" href="'+e(href)+'">'+e(label)+' ↗</a>':'';
const num=v=>{const n=Number(String(v??'').replaceAll(',',''));return Number.isFinite(n)&&n>0?n:null;};
function count(sf,share,area){return Math.floor(sf*share/area);}
export function yieldLabel(r){
 const sf=num(r.building_sf);return sf?count(sf,.70,900)+'–'+count(sf,.80,700)+' illustrative homes':'Floor area unavailable';
}
let photos;
export async function photoRecords(id){
 if(!photos)photos=get('listing-photos.json').catch(err=>{photos=null;throw err;});
 return (await photos)[id]||[];
}
export function thumbnailUrl(photo){return photo.file.startsWith('/')?photo.file:'/'+photo.file;}
let dialog,version=0;
function start(title){
 version++;if(!dialog){dialog=document.createElement('dialog');dialog.className='review-dialog';document.body.append(dialog);}
 dialog.innerHTML='<header><h2>'+e(title)+'</h2><button type="button" aria-label="Close">×</button></header><article></article>';
 dialog.querySelector('button').onclick=()=>dialog.close();if(!dialog.open)dialog.showModal();return dialog.querySelector('article');
}
async function get(file){const r=await fetch('/data/'+file);if(!r.ok)throw Error('Data unavailable');return r.json();}
export async function guide(){
 const body=start('Fast-track site screening'),seq=version;body.textContent='Loading sources…';
 try{const data=await get('fast-track.json');if(seq!==version)return;
 body.innerHTML='<p class="lead">Screen each legal pathway separately. A parcel can satisfy a mapped criterion while ownership, tenant history or project design still requires evidence.</p><h3>Site criteria</h3><div class="guide-table"><table><thead><tr><th>Criterion</th><th>What to look for</th><th>Why it matters</th></tr></thead><tbody>'+data.criteria.map(c=>'<tr><td>'+e(c.title)+'</td><td>'+e(c.ideal)+'</td><td>'+e(c.reason)+' '+link(c.url,'Source')+'</td></tr>').join('')+'</tbody></table></div><h3>Approval pathways</h3>'+data.pathways.map(p=>'<details class="law-card"><summary>'+e(p.title)+'</summary><p>'+e(p.body)+' '+link(p.url,'Official source')+'</p></details>').join('')+'<h3>How to prioritise a site</h3><p>'+e(data.priority)+'</p><p>For this prototype, hazard, historic, tenant and ownership screens remain unassessed unless a checked, parcel-specific record supplies evidence. A missing map layer cannot clear a site.</p><h3>Parcel inventory</h3><p>On 7 November 2026, the Parcel Geometries sheet contained 31,002 distinct parcel IDs in rows 2–31,003. This check covered identifiers only. The Site’s workbook matching index remains a sample; geometry accuracy and source completeness require separate checks. '+link('https://docs.google.com/spreadsheets/d/17NlGpn94b18pJvoRaVuTfZPA_nZlxd4IETw1rf1kFxY/edit#gid=1670023345','Parcel Geometries')+'</p>';
 }catch{body.textContent='The screening guide could not load. Reopen it to retry.';}
}
export function compareListings(rows){
 const body=start('Commercial acreage and zoning');
 body.innerHTML='<p>Workbook snapshot · 7 November 2026. Choose a property to inspect the source, photographs and conversion assumptions.</p><div class="guide-table"><table><thead><tr><th>Property</th><th>Parcel acres</th><th>Zoning code</th><th>Zoning description</th><th>Illustrative homes</th></tr></thead><tbody>'+rows.map((r,i)=>'<tr><td><button class="listing-link" data-row="'+i+'">'+e(r.property_name)+'</button></td>'+[r.parcel_acres,r.zoning_code,r.zoning_description,yieldLabel(r)].map(v=>'<td>'+e(v??'Not supplied')+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';
 body.querySelectorAll('[data-row]').forEach(b=>b.onclick=()=>inspectListing(rows[Number(b.dataset.row)]));
}
export function inspectListing(r,startAt='laws'){
 const body=start(r.property_name),seq=version,sf=num(r.building_sf);
 body.innerHTML='<p>'+e(r.address)+'</p><nav class="listing-sections"><button class="btn" data-jump="property-laws">District laws</button><button class="btn" data-jump="listing-gallery">Photos &amp; unit estimate</button></nav><section class="property-laws" data-property-laws></section><div class="listing-gallery"></div><div class="unit-est"><small>Existing-building conversion scenario</small><h3>'+e(yieldLabel(r))+'</h3><p>'+ (sf?'Using '+sf.toLocaleString()+' gross sq ft from the workbook. The low scenario assigns 70% to homes averaging 900 sq ft. The high scenario uses 80% and 700 sq ft. Both round down to whole homes.':'No usable gross floor area was supplied.')+'</p><p>These are floor-area scenarios. Windows, cores, access, infrastructure, local density limits and approvals can reduce yield or prevent conversion.</p></div>'+
 (r.listing_id==='CC-01'?'<p><b>Listing-reported proposal:</b> approximately 184 homes. This is the proposal recorded by the workbook, separate from the floor-area scenarios.</p>':'')+
 (r.listing_id==='CC-03'?'<p class="scope-note"><strong>Two different offering scopes.</strong> The workbook row records $4.95 million and 28,800 sq ft. The supplied LoopNet screenshot shows a $7.5 million, 47,800 sq ft portfolio with one flex and one office building. The estimate above uses only the workbook floor area.</p>':'')+
 '<h3>Workbook zoning</h3><table><thead><tr><th>Parcel acres</th><th>Zoning code</th><th>Zoning description</th></tr></thead><tbody><tr>'+[r.parcel_acres,r.zoning_code,r.zoning_description].map(v=>'<td>'+e(v||'Not supplied')+'</td>').join('')+'</tr></tbody></table><p>Workbook check: '+e(String(r.listing_checked_utc||'').slice(0,10))+'. Verify the current designation and listing availability with the city and broker.</p><p>'+link(sheet+'&range=L'+r.sheet_row+':N'+r.sheet_row,'Open these three cells')+' · '+link(r.listing_url,'Broker listing')+'</p><h3>Workbook research notes · pending review</h3><p>'+e(r.screen_notes||'No notes supplied.')+'</p><p>'+e(r.potential_pathways||'No pathway identified in the workbook.')+'</p><button class="btn" id="show-guide">Fast-track screening guide</button>';
 if(startAt==='photos')requestAnimationFrame(()=>body.querySelector('.listing-gallery')?.scrollIntoView({block:'start'}));
 body.querySelectorAll('[data-jump]').forEach(b=>b.onclick=()=>body.querySelector('.'+b.dataset.jump)?.scrollIntoView({block:'start'}));
 showPropertyLaws(body.querySelector('[data-property-laws]'),r);
 body.querySelector('#show-guide').onclick=guide;
 body.insertAdjacentHTML('beforeend','<h3>Open evidence checks</h3><p class="scope-note">Unresolved: actual tenant and withdrawal history, site control, hazard and historic exclusions, and project affordability and labour commitments. Review these against a specific pathway before treating the site as a fast-track prospect.</p>');
 photoRecords(r.listing_id).then(records=>{if(seq!==version)return;const gallery=body.querySelector('.listing-gallery');gallery.innerHTML=records.map(p=>'<figure><img src="'+e(thumbnailUrl(p))+'" alt="'+e(p.caption)+'"><figcaption>'+e(p.caption)+' '+link(p.url,'Source')+'</figcaption></figure>').join('');}).catch(()=>{});
}
