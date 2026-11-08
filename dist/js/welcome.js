const steps=[
  ['Choose a city','Click anywhere inside a coloured city on the county map. The map flies into the region and opens its zoning districts on the right.'],
  ['Read the zoning','Follow the pointer across Irvine’s residential, commercial and preservation zones. The popup shows each district’s name and code.'],
  ['Fly to a property','Click a green building pin. After the fly-in, explore the listing’s photos, district laws and estimated number of homes.'],
  ['Review the property’s laws and details','Scroll through the property’s district rules, housing pathways and conversion estimate. Open a source link to check the original wording.'],
  ['View it in Photorealistic 3D','Choose “Orbit property” to circle 520 W Santa Ana Blvd. The preview holds its last sharp view as the next angle loads.']
];
const byId=id=>document.getElementById(id);
const guide=byId('welcome-guide'),video=byId('guide-video'),play=byId('guide-play');
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
let index=0,orbit=null,orbitState='loading';
function clearOrbit(){orbit?.remove();orbit=null;}
function setOrbitState(state){
  orbitState=state;
  play.textContent=({loading:'Loading orbit…',still:'Still view · Retry orbit',paused:'Play preview',playing:'Pause preview',ended:'Replay preview'})[state];
  play.disabled=state==='loading';
}
window.addEventListener('message',e=>{
  if(!orbit||e.source!==orbit.contentWindow||e.origin!==location.origin)return;
  if(['still','paused','playing','ended'].includes(e.data?.tourOrbit))setOrbitState(e.data.tourOrbit);
});
const nav=steps.map(([title],i)=>{
  const button=document.createElement('button');
  button.type='button';button.setAttribute('aria-label','Step '+(i+1)+': '+title);
  button.onclick=()=>show(i);byId('guide-steps').append(button);return button;
});
function syncPlayback(){
  if(orbit)return;
  play.textContent=video.error?'Preview unavailable':video.ended?'Replay preview':video.paused?'Play preview':'Pause preview';
  play.disabled=Boolean(video.error);
}
function show(i){
  index=i;const [title,copy]=steps[i];
  byId('guide-count').textContent='STEP '+(i+1)+' OF 5';
  byId('guide-title').textContent=title;byId('guide-copy').textContent=copy;
  byId('guide-back').disabled=i===0;
  byId('guide-next').textContent=i===4?'Explore the map →':'Next →';
  nav.forEach((b,j)=>b.setAttribute('aria-current',i===j?'step':'false'));
  clearOrbit();video.pause();video.hidden=i===4;
  if(i===4){
    orbit=document.createElement('iframe');orbit.className='guide-orbit-frame';
    orbit.title='Photorealistic orbit of 520 W Santa Ana Blvd';
    orbit.src='/guide/orbit.html'+(reduced.matches?'?paused':'');
    video.after(orbit);setOrbitState('loading');return;
  }
  video.src='/guide/step-'+(i+1)+'.mp4?v=2';video.load();syncPlayback();
  if(!reduced.matches)video.play().catch(syncPlayback);
}
function openGuide(){if(!guide.open){guide.showModal();show(0);}}
byId('guide-open').onclick=openGuide;
byId('guide-skip').onclick=()=>guide.close();
byId('guide-back').onclick=()=>show(index-1);
byId('guide-next').onclick=()=>index===4?guide.close():show(index+1);
play.onclick=()=>{if(orbit){
  if(orbitState==='still'){show(4);return;}
  orbit.contentWindow.postMessage({orbitPlaying:orbitState!=='playing'},location.origin);return;
}if(video.ended)video.currentTime=0;if(video.paused)video.play().catch(syncPlayback);else video.pause();};
for(const event of ['play','pause','ended','error','loadeddata'])video.addEventListener(event,syncPlayback);
guide.addEventListener('close',()=>{video.pause();clearOrbit();byId('guide-open').focus();});
openGuide();
