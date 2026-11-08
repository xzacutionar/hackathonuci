const steps=[
  ['Choose a city','Click anywhere inside a coloured city on the county map. The map flies into the region and opens its zoning districts on the right.'],
  ['Read the zoning','Follow the pointer across Irvine’s residential, commercial and preservation zones. The popup shows each district’s name and code.'],
  ['Fly to a property','Click a green building pin. After the fly-in, explore the listing’s photos, district laws and estimated number of homes.'],
  ['Review the property’s laws and details','Scroll through the property’s district rules, housing pathways and conversion estimate. Open a source link to check the original wording.'],
  ['View it in Photorealistic 3D','Choose “Orbit property” to circle 520 W Santa Ana Blvd. This recorded orbit shows the building from several angles.']
];
const byId=id=>document.getElementById(id);
const guide=byId('welcome-guide'),video=byId('guide-video'),play=byId('guide-play');
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
let index=0,warmed=false;
const orbitClip='/guide/step-5.mp4?v=3',orbitPoster='/guide/orbit-ready.jpg?v=3';
function warmOrbit(){
  if(warmed)return;
  warmed=true;
  for(const [href,as] of [[orbitClip,'video'],[orbitPoster,'image']]){
    const link=document.createElement('link');
    link.rel='prefetch';link.href=href;link.as=as;document.head.append(link);
  }
}
const nav=steps.map(([title],i)=>{
  const button=document.createElement('button');
  button.type='button';button.setAttribute('aria-label','Step '+(i+1)+': '+title);
  button.onclick=()=>show(i);byId('guide-steps').append(button);return button;
});
function syncPlayback(){
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
  video.pause();
  if(i===0&&!navigator.connection?.saveData)warmOrbit();
  if(i===4)video.poster=orbitPoster;else video.removeAttribute('poster');
  video.src=i===4?orbitClip:'/guide/step-'+(i+1)+'.mp4?v=2';
  video.load();syncPlayback();
  if(!reduced.matches)video.play().catch(syncPlayback);
}
function openGuide(){if(!guide.open){guide.showModal();show(0);}}
byId('guide-open').onclick=openGuide;
byId('guide-skip').onclick=()=>guide.close();
byId('guide-back').onclick=()=>show(index-1);
byId('guide-next').onclick=()=>index===4?guide.close():show(index+1);
play.onclick=()=>{if(video.ended)video.currentTime=0;if(video.paused)video.play().catch(syncPlayback);else video.pause();};
for(const event of ['play','pause','ended','error','loadeddata'])video.addEventListener(event,syncPlayback);
guide.addEventListener('close',()=>{video.pause();byId('guide-open').focus();});
openGuide();
