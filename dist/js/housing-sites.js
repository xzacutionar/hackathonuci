const sites = [
  {
    id: 'trinity', name: 'Trinity United Presbyterian', city: 'North Tustin',
    address: '13922 Prospect Avenue', point: [33.76091, -117.82050],
    status: 'County inventory', quantity: '30 homes · county planning estimate',
    notes: 'Orange County identifies one acre of the north-west parking area. The highlight marks its approximate location. The precise development boundary and owner interest remain unverified.',
    source: 'https://ocds.ocpublicworks.com/sites/ocpwocds/files/2025-02/OC%20Housing%20Element%20AdoptedFeb2025.pdf'
  },
  {
    id: 'main', name: '1901 Main Street', city: 'Irvine',
    address: '1901 Main Street', point: [33.685993, -117.854390],
    status: 'Documented project', quantity: '9 townhomes on surface parking',
    notes: 'The city filing describes 75 homes in total. Nine are proposed on the car park and 66 within the office tower. Current construction status and affordability are unverified.',
    source: 'https://ceqanet.lci.ca.gov/2025060286'
  },
  {
    id: 'grace', name: 'Grace Church', city: 'Laguna Niguel',
    address: '24600 La Plata Drive', point: [33.532819, -117.700552],
    status: 'Approved senior-care project', quantity: '108 assisted-living and memory-care units',
    notes: 'The city approved a senior-care community on a predominantly vacant part of the church campus. These units are excluded from affordable-home estimates.',
    source: 'https://www.cityoflagunaniguel.org/DocumentCenter/View/24676/20230606_11_Grace-Church-Ordinance'
  }
];

export function housingSites(map, enterMap) {
  const pins = L.layerGroup().addTo(map);
  let visible = true, active = null, highlight = null, region = null;
  function clearHighlight() {
    if (highlight) highlight.remove();
    highlight = null;
  }
  function render(selected) {
    const box = document.getElementById('housing-sites');
    if (!box) return;
    const city = selected?.kind === 'region' ? selected.name : null;
    if (city !== region) { active = null; clearHighlight(); }
    region = city;
    const local = sites.filter(s => !city || city === s.city);
    pins.clearLayers();
    box.hidden = !local.length;
    if (!local.length) return;
    box.innerHTML = '<h2>Potential housing sites</h2><label><input type="checkbox"> Show on 2D map</label><div class="housing-list"></div><div class="housing-detail"></div>';
    const toggle = box.querySelector('input');
    toggle.checked = visible;
    toggle.onchange = () => { visible = toggle.checked; if (!visible) { clearHighlight(); active = null; } render(selected); };
    function open(site) {
      enterMap();
      active = site; visible = true;
      render(selected);
      map.closePopup();
      map.flyTo(site.point, 17, { duration: 1, animate: !matchMedia('(prefers-reduced-motion: reduce)').matches });
      document.querySelector('#housing-sites .housing-detail')?.scrollIntoView({block:'nearest'});
    }
    for (const site of local) {
      if (visible) {
        const marker = L.marker(site.point, {
          title: site.name, alt: site.name, zIndexOffset: 650,
          icon: L.divIcon({className:'housing-map-pin',html:'⌂',iconSize:[24,24],iconAnchor:[12,12]})
        }).addTo(pins);
        marker.bindTooltip(site.name); marker.on('click', () => open(site));
      }
      const b = document.createElement('button');
      b.className = 'listing-row'; b.setAttribute('aria-pressed', String(active === site));
      b.innerHTML = '<img class="site-thumb" alt="" loading="lazy" src="/imagery/housing/'+site.id+'.jpg"><span><b>'+site.name+'</b><small>'+site.city+' · '+site.status+'</small></span>';
      b.onclick = () => open(site); box.querySelector('.housing-list').append(b);
    }
    clearHighlight();
    if (!active || !local.includes(active)) return;
    if (active.id === 'trinity') {
      highlight = L.circle(active.point,{radius:15,weight:2,dashArray:'4 4',color:'#90602d',fillOpacity:.18,interactive:false}).addTo(map);
    }
    box.querySelector('.housing-detail').innerHTML = '<h3>'+active.name+'</h3><p>'+active.address+' · '+active.city+'</p><figure><img src="/imagery/housing/'+active.id+'.jpg" alt="Aerial view around '+active.address+'"><figcaption>Site aerial · USDA / USGS The National Map</figcaption></figure><b>'+active.quantity+'</b><p>'+active.notes+'</p><a target="_blank" rel="noopener" href="'+active.source+'">Read the public planning record ↗</a>';
  }
  return {render};
}
