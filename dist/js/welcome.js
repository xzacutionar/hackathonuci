const steps=[
  ['Choose a city','Click anywhere inside a coloured city on the county map. The map flies into the region and opens its zoning districts on the right.'],
  ['Read the zoning','Hover over a district to see its category. Click it to see the district code, housing considerations and links to the local rules.'],
  ['Fly to a property','Click a green building pin. After the fly-in, explore the listing’s photos, district laws and estimated number of homes.'],
  ['Orbit the building','Choose “Orbit property” in the listing to circle its labelled pin. Use “Stop orbit” when you want to explore on your own.'],
  ['Explore in 3D','Move around the 3D map. Hover to outline a zone, then click it to open its district rules in the sidebar.']
];
const byId=id=>document.getElementById(id);
const guide=byId('welcome-guide'),video=byId('guide-video'),play=byId('guide-play');
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
let index=0;
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
  video.pause();video.src='/guide/step-'+(i+1)+'.mp4';video.load();syncPlayback();
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
