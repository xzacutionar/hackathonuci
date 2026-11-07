import {amenityIcon} from './amenity-icons.js';
// Photographic perspective for browsers where a WebGL context cannot be created.
// The surface represents a flat plane. No elevations or building heights are inferred.
export function createPhotoView(root,model,manual){
  const images=model.images;let parcel=null;
  const plane=document.createElement('div'),pin=document.createElement('div');
  plane.className='photo-ground';pin.className='photo-target';root.append(plane,pin);
  const R=Math.PI/180,world=([lon,lat])=>[(lon+180)/360,(1-Math.log(Math.tan(Math.PI/4+lat*R/2))/Math.PI)/2];
  let nearby=[],target=null,z=13.3,yaw=0,pitch=36,active=false,rotating=false,frame=0,last=0,drag=null;
  function orient(){
    plane.style.transform='rotateX('+pitch+'deg) rotateZ('+(-yaw)+'deg)';
    document.querySelector('#north svg').style.transform='rotate('+(-yaw)+'deg)';
  }
  function layout(){
    const pivot=world([target.lon,target.lat]),span=256*2**z;
    plane.replaceChildren();
    function add(src,left,top,width,height,depth){
      const img=document.createElement('img');img.alt='';img.draggable=false;img.src=src;
      Object.assign(img.style,{left:left+'px',top:top+'px',width:width+'px',height:height+'px',zIndex:depth});
      img.onerror=()=>img.remove();plane.append(img);
    }
    let inside=false;
    for(const im of images){
      const [w,s,e,n]=im.bounds,a=world([w,n]),b=world([e,s]);
      if(im.id!=='county'&&w<target.lon&&target.lon<e&&s<target.lat&&target.lat<n)inside=true;
      add('/imagery/'+im.file,(a[0]-pivot[0])*span,(a[1]-pivot[1])*span,(b[0]-a[0])*span,(b[1]-a[1])*span,im.id==='county'?0:2);
    }
    if(target.id!=='county'||z>12.5){
      const level=Math.min(17,Math.round(z)),n=2**level,side=span/n;
      const tx=Math.floor(pivot[0]*n),ty=Math.floor(pivot[1]*n);
      const r=Math.min(5,Math.ceil(Math.max(root.clientWidth,root.clientHeight)/side));
      for(let x=tx-r;x<=tx+r;x++)for(let y=ty-r;y<=ty+r;y++){
        if(x<0||x>=n||y<0||y>=n)continue;
        add('https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/'+level+'/'+y+'/'+x,(x/n-pivot[0])*span,(y/n-pivot[1])*span,side+.5,side+.5,inside&&z<=15.2?1:3);
      }
    }
    drawParcel();drawPlaces();orient();
  }
  function drawParcel(){
    for(const el of plane.querySelectorAll('.photo-shape'))el.remove();
    if(!active||!target||!parcel?.geometry)return;
    const scale=256*2**z,pivot=world([target.lon,target.lat]);
    const b=model.bbox(parcel.geometry),tl=world([b[0],b[3]]),br=world([b[2],b[1]]),width=(br[0]-tl[0])*scale,height=(br[1]-tl[1])*scale;
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg'),p=document.createElementNS(svg.namespaceURI,'path');
    svg.setAttribute('class','photo-shape');svg.setAttribute('viewBox','0 0 '+width+' '+height);
    Object.assign(svg.style,{left:(tl[0]-pivot[0])*scale+'px',top:(tl[1]-pivot[1])*scale+'px',width:width+'px',height:height+'px'});
    const d=model.polygons(parcel.geometry).map(poly=>poly.map(ring=>ring.map((v,i)=>{
      const pt=world(v);return (i?'L':'M')+((pt[0]-tl[0])*scale).toFixed(2)+','+((pt[1]-tl[1])*scale).toFixed(2);
    }).join('')+'Z').join('')).join('');
    p.setAttribute('d',d);p.setAttribute('fill-rule','evenodd');p.setAttribute('fill',parcel.color);p.setAttribute('fill-opacity','.5');p.setAttribute('stroke','#795691');p.setAttribute('stroke-width','2');svg.append(p);plane.append(svg);
  }
  function drawPlaces(){
    for(const el of plane.querySelectorAll('.photo-poi'))el.remove();
    if(!target)return;
    const pivot=world([target.lon,target.lat]),span=256*2**z;
    for(const item of nearby){
      if(!Number.isFinite(item.lon))continue;
      const point=world([item.lon,item.lat]),el=document.createElement('img');
      el.className='photo-poi';el.src=amenityIcon(item.cat);el.alt=el.title=item.name+' · '+item.cat;el.draggable=false;
      el.style.left=(point[0]-pivot[0])*span+'px';el.style.top=(point[1]-pivot[1])*span+'px';plane.append(el);
    }
  }
  function stop(){rotating=false;cancelAnimationFrame(frame);last=0;}
  function rotate(){
    stop();rotating=true;
    function tick(t){if(!active||!rotating)return;if(last)yaw+=Math.min(70,t-last)*.009;last=t;orient();frame=requestAnimationFrame(tick);}
    frame=requestAnimationFrame(tick);
  }
  function show(s,orbit){
    parcel=s?.kind==='parcel'?s:null;
    const at=s||{id:'county',lon:-117.8,lat:33.7,name:'Orange County'};
    if(!active||target!==at){target=at;z=s?(s.kind==='parcel'?15.2:14.7):10.8;yaw=0;pitch=s?36:29;}
    active=true;root.hidden=false;pin.textContent=at.name;layout();if(orbit)rotate();else stop();
  }
  function close(){stop();active=false;root.hidden=true;document.querySelector('#north svg').style.transform='';}
  function zoom(by){if(!active)return;z=Math.min(16,Math.max(9,z+by*.5));layout();}
  root.addEventListener('pointerdown',e=>{if(!active)return;stop();manual();drag={x:e.clientX,y:e.clientY,yaw,pitch};root.setPointerCapture(e.pointerId);});
  root.addEventListener('pointermove',e=>{if(!drag)return;yaw=drag.yaw+(e.clientX-drag.x)*.22;pitch=Math.min(53,Math.max(12,drag.pitch+(e.clientY-drag.y)*.12));orient();});
  for(const ev of ['pointerup','pointercancel'])root.addEventListener(ev,()=>{drag=null;});
  root.addEventListener('wheel',e=>{if(active){e.preventDefault();zoom(-Math.sign(e.deltaY)*.5);}},{passive:false});
  return {show,close,zoom,setAmenities(values){nearby=values;drawPlaces();},north(){stop();yaw=0;orient();},get active(){return active;}};
}
