export function dataLayer(regs, images){
  const regionColors={ANA:'#a4df8b',SA:'#eda885',CM:'#f1e388',GG:'#a6a8ee',IRV:'#d399e8',LF:'#85cce7'};
  const regions=regs.map(r=>({...r,geometry:null,color:regionColors[r.id],kind:'region',boundary:'Study location'}));
  const cityInfo='https://data.ca.gov/@california-department-of-technology/california-city-boundaries-and-identifiers';
  function distance(a,b,c,d){
    const earth=6371,rad=Math.PI/180,x=Math.sin((c-a)*rad/2)**2+Math.cos(a*rad)*Math.cos(c*rad)*Math.sin((d-b)*rad/2)**2;
    return 2*earth*Math.asin(Math.sqrt(Math.min(1,x)));
  }
  function polygons(g){return g.type==='MultiPolygon'?g.coordinates:[g.coordinates];}
  function validated(g){
    if(!g||!['MultiPolygon','Polygon'].includes(g.type))return false;
    let n=0;const polys=polygons(g);
    return Array.isArray(polys)&&polys.length>0&&polys.every(p=>Array.isArray(p)&&p.length>0&&p.every(r=>Array.isArray(r)&&r.length>=4&&r.every(c=>++n<=100000&&Array.isArray(c)&&c.length>=2&&c.slice(0,2).every(Number.isFinite)&&Math.abs(c[0])<=180&&Math.abs(c[1])<=85)&&r[0][0]===r[r.length-1][0]&&r[0][1]===r[r.length-1][1]));
  }
  function bbox(g){
    const box=[Infinity,Infinity,-Infinity,-Infinity];
    for(const p of polygons(g)) for(const ring of p) for(const [x,y] of ring){box[0]=Math.min(box[0],x);box[1]=Math.min(box[1],y);box[2]=Math.max(box[2],x);box[3]=Math.max(box[3],y);}
    return box;
  }
  function importGeoJSON(raw){
    if(raw?.crs && !/4326|CRS84/i.test(String(raw.crs?.properties?.name||'')))throw Error('Reproject this file to WGS84 longitude and latitude before importing.');
    const fs=raw?.type==='FeatureCollection'?raw.features:raw?.type==='Feature'?[raw]:[{type:'Feature',properties:{},geometry:raw}];
    if(!Array.isArray(fs)||!fs.length||fs.length>1000)throw Error('Choose a file with 1 to 1,000 polygon features.');
    return fs.map((f,i)=>{
      if(f?.type!=='Feature'||!validated(f.geometry))throw Error('Feature '+(i+1)+' needs a closed WGS84 Polygon or MultiPolygon.');
      const b=bbox(f.geometry),p=f.properties||{},apn=p.parcel_id??p.APN??p.apn,area=p.area_acres;
      return {id:'file-'+i,name:String(p.site_name??p.name??(apn?'Parcel '+apn:'Imported site '+(i+1))).slice(0,150),kind:'parcel',boundary:'Imported, unverified',color:'#648baa',geometry:f.geometry,lon:(b[0]+b[2])/2,lat:(b[1]+b[3])/2,parcelId:apn==null?null:String(apn),area:area!=null&&area!==''&&Number.isFinite(Number(area))&&Number(area)>0?Number(area):null,source:typeof p.source==='string'?p.source:null};
    });
  }
  async function json(url,opts={},ms=10000){
    const ctl=new AbortController(),t=setTimeout(()=>ctl.abort(),ms);
    try{const r=await fetch(url,{...opts,signal:ctl.signal});if(!r.ok)throw Error('Request failed');return await r.json();}finally{clearTimeout(t);}
  }
  async function municipal(){
    const res=await json('/data/municipalities.geojson');
    const found=regions.map(r=>res.features?.find(f=>String(f.properties?.CDTFA_CITY||'').toLowerCase()===r.name.toLowerCase()&&validated(f.geometry)));
    if(!found.every(Boolean))return false;
    regions.forEach((r,i)=>{r.geometry=found[i].geometry;r.boundary='Municipal boundary';});
    return true;
  }
  const categories=['Schools','Health','Transport','Shopping','Employment'];
  let directory;
  async function nearby(s){
    if(!directory)directory=await json('/data/nearby.json');
    return categories.map(cat=>{
      const source=directory.categories[cat];
      if(!source)return {cat,coverage:false};
      let nearest=null;
      for(const [name,lon,lat,url,attribution] of source.points){
        const km=distance(s.lat,s.lon,lat,lon);
        if(km>3.5||(nearest&&km>=nearest.km))continue;
        nearest={cat,name,lon,lat,km,url:url||source.url,source:attribution||source.label};
      }
      return nearest||{cat,coverage:true};
    });
  }
  async function photon(q){
    const params=new URLSearchParams({q,limit:'7',lang:'en',lat:'33.71',lon:'-117.83',bbox:'-118.17,33.32,-117.40,33.97'});
    const j=await json('https://photon.komoot.io/api/?'+params,{},7000);
    return (j.features||[]).filter(x=>x.geometry?.type==='Point'&&x.properties?.name).map((x,i)=>({id:'photon-'+i,kind:'place',name:x.properties.name,lon:x.geometry.coordinates[0],lat:x.geometry.coordinates[1],subtitle:[x.properties.city,x.properties.district,x.properties.state].filter(Boolean).join(', '),boundary:'Photon · OpenStreetMap'}));
  }
  return {regions,images,polygons,validated,importGeoJSON,bbox,cityInfo,municipal,nearby,photon,distance};
}
