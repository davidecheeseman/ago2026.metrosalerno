import { ST, DU, FU, CUM, POI } from "./data.js";
import { metroDeps, duomoDeps, activeTrains, findLatestConnection, hav, metroServiceStatus } from "./timetable.js";
import { getRealtimeDepartures } from "./realtime.js";
import { registerServiceWorker } from "./pwa.js";
import { initInstallPrompt } from "./install-prompt.js";

// Application UI state
// ─── STATE ──────────────────────────────────────
let selIdx=0, viewMode='line', userPos=null, userDist=null, panelCollapsed=false;
let realtimeByStation=new Map();
const escapeHTML=value=>String(value).replace(/[&<>"']/g,char=>({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
})[char]);

async function refreshRealtime(){
  const station=selIdx===-1?DU:ST[Math.max(0,selIdx)];
  const selectedId=station.id;
  const realtime=await getRealtimeDepartures(selectedId);
  if(realtime)realtimeByStation.set(selectedId,realtime);
  else realtimeByStation.delete(selectedId);
  const current=selIdx===-1?DU:ST[Math.max(0,selIdx)];
  if(current.id===selectedId)renderDepartures();
}

// ─── SCHEMATIC SVG (inline rebuild) ─────────────
function buildSchematic(){
  const now=new Date(),cm=now.getHours()*60+now.getMinutes()+now.getSeconds()/60,hol=now.getDay()===0;
  const trains=activeTrains(cm,hol);
  const W=720,P=50,Y=78,U=290,sp=U/5;
  const gx=i=>P+i*sp;
  const fgx=i=>gx(5)+sp*(i+1);
  const DX=P-32,DY=Y-28;
  const fracX=f=>gx(0)+f*(gx(5)-gx(0));
  const duomoPos=f=>({x:gx(0)+(DX-gx(0))*f,y:Y+(DY-Y)*f});

  // ViewBox zoom on selected
  const cx=selIdx===-1?DX:gx(Math.max(0,selIdx));
  const zW=195;
  const vbX=Math.max(0,Math.min(cx-zW/2,W-zW));

  let svg=`<svg viewBox="${vbX} 0 ${zW} 175" style="width:100%;height:185px;display:block;transition:viewBox 0.6s" preserveAspectRatio="xMidYMid meet">
  <defs>
    <filter id="gl"><feGaussianBlur stdDeviation="3.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <filter id="sg"><feGaussianBlur stdDeviation="7" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <filter id="tg"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <linearGradient id="lg" x1="0%" x2="100%"><stop offset="0%" stop-color="#E63946"/><stop offset="50%" stop-color="#d62839"/><stop offset="100%" stop-color="#a4161a"/></linearGradient>
  </defs>`;

  // Future extension
  svg+=`<line x1="${gx(5)}" y1="${Y}" x2="${fgx(4)+8}" y2="${Y}" stroke="rgba(255,255,255,0.04)" stroke-width="7" stroke-linecap="round"/>`;
  svg+=`<line x1="${gx(5)}" y1="${Y}" x2="${fgx(4)+8}" y2="${Y}" stroke="#E63946" stroke-width="4.5" stroke-linecap="round" opacity="0.1" stroke-dasharray="8 6"/>`;
  svg+=`<text x="${(fgx(0)+fgx(4))/2}" y="${Y+40}" text-anchor="middle" fill="#E63946" font-size="4" font-weight="700" opacity="0.2" font-family="'DM Sans',sans-serif" letter-spacing="1.5">IN COSTRUZIONE</text>`;
  FU.forEach((fs,i)=>{
    const x=fgx(i),last=i===4;
    svg+=`<g opacity="0.25"><circle cx="${x}" cy="${Y}" r="${last?7.5:6}" fill="var(--bg)" stroke="#E63946" stroke-width="2.5"/>`;
    if(last)svg+=`<circle cx="${x}" cy="${Y}" r="3" fill="#E63946"/>`;
    svg+=`<text x="${x}" y="${Y+25}" text-anchor="middle" fill="rgba(240,236,228,0.45)" font-size="7" font-weight="500" font-family="'DM Sans',sans-serif">${fs.name}</text></g>`;
  });

  // Duomo branch
  svg+=`<line x1="${gx(0)}" y1="${Y}" x2="${DX}" y2="${DY}" stroke="rgba(52,211,153,0.12)" stroke-width="5" stroke-linecap="round"/>`;
  svg+=`<line x1="${gx(0)}" y1="${Y}" x2="${DX}" y2="${DY}" stroke="#34d399" stroke-width="2.5" stroke-linecap="round" opacity="0.5" stroke-dasharray="4 3"/>`;

  // Main line
  svg+=`<line x1="${gx(0)}" y1="${Y}" x2="${gx(5)}" y2="${Y}" stroke="rgba(255,255,255,0.07)" stroke-width="7" stroke-linecap="round"/>`;
  svg+=`<line x1="${gx(0)}" y1="${Y}" x2="${gx(5)}" y2="${Y}" stroke="url(#lg)" stroke-width="4.5" stroke-linecap="round" filter="url(#gl)" opacity="0.85"/>`;

  // Trains
  trains.forEach(tr=>{
    const x=fracX(tr.frac),toA=tr.dir==='arechi',yO=toA?-15:15,col=toA?'#E63946':'rgba(100,175,255,1)';
    if(tr.at){
      svg+=`<g><circle cx="${x}" cy="${Y+yO*0.5}" r="6" fill="${col}" opacity="0.2" filter="url(#tg)"><animate attributeName="r" values="6;9;6" dur="1.8s" repeatCount="indefinite"/></circle><rect x="${x-7}" y="${Y+yO-4.5}" width="14" height="9" rx="3" fill="${col}" opacity="0.75" stroke-dasharray="2 1.5" stroke="#fff" stroke-width="0.5"/></g>`;
    }else{
      svg+=`<g><rect x="${x-7}" y="${Y+yO-4.5}" width="14" height="9" rx="3" fill="${col}" opacity="0.9"/>`;
      if(toA)svg+=`<polygon points="${x+9},${Y+yO} ${x+6},${Y+yO-3.5} ${x+6},${Y+yO+3.5}" fill="#fff" opacity="0.85"/>`;
      else svg+=`<polygon points="${x-9},${Y+yO} ${x-6},${Y+yO-3.5} ${x-6},${Y+yO+3.5}" fill="#fff" opacity="0.85"/>`;
      svg+=`<circle cx="${toA?x+10:x-10}" cy="${Y+yO}" r="1.8" fill="#fff" opacity="0.6"><animate attributeName="opacity" values="0.7;0.25;0.7" dur="1.2s" repeatCount="indefinite"/></circle></g>`;
    }
  });

  // Duomo dot
  const dSel=selIdx===-1;
  if(dSel){
    svg+=`<g class="duo-g" onclick="selectStation(-1)" style="cursor:pointer"><rect x="${DX-16}" y="${DY-20}" width="32" height="45" fill="transparent"/>`;
    svg+=`<circle cx="${DX}" cy="${DY}" r="7" fill="none" stroke="#34d399" stroke-width="1" opacity="0"><animate attributeName="r" values="7;18" dur="2s" repeatCount="indefinite"/><animate attributeName="opacity" values="0.5;0" dur="2s" repeatCount="indefinite"/></circle>`;
    svg+=`<circle cx="${DX}" cy="${DY}" r="7" fill="#34d399" opacity="0.9"><animate attributeName="r" values="6;8;6" dur="2.5s" repeatCount="indefinite"/></circle>`;
    svg+=`<circle cx="${DX}" cy="${DY}" r="3" fill="#fff" opacity="0.95"/>`;
    svg+=`<text x="${DX}" y="${DY+18}" text-anchor="middle" fill="var(--text)" font-size="8.5" font-weight="800" font-family="'DM Sans',sans-serif">Duomo</text></g>`;
  }else{
    svg+=`<g onclick="selectStation(-1)" style="cursor:pointer"><rect x="${DX-16}" y="${DY-20}" width="32" height="45" fill="transparent"/>`;
    svg+=`<circle cx="${DX}" cy="${DY}" r="5" fill="var(--bg)" stroke="#34d399" stroke-width="2" opacity="0.7"/><circle cx="${DX}" cy="${DY}" r="1.8" fill="#34d399" opacity="0.5"/>`;
    svg+=`<text x="${DX}" y="${DY+14}" text-anchor="middle" fill="rgba(52,211,153,0.55)" font-size="6" font-weight="500" font-family="'DM Sans',sans-serif">Duomo</text></g>`;
  }

  // Station dots
  ST.forEach((s,i)=>{
    const x=gx(i),isSel=selIdx===i,isTerm=s.term;
    svg+=`<g onclick="selectStation(${i})" style="cursor:pointer"><rect x="${x-18}" y="${Y-40}" width="36" height="85" fill="transparent"/>`;
    if(isSel){
      svg+=`<circle cx="${x}" cy="${Y}" r="10" fill="none" stroke="#E63946" stroke-width="1" opacity="0"><animate attributeName="r" values="10;26" dur="2s" repeatCount="indefinite"/><animate attributeName="opacity" values="0.5;0" dur="2s" repeatCount="indefinite"/></circle>`;
      svg+=`<circle cx="${x}" cy="${Y}" r="10" fill="#E63946" filter="url(#sg)" opacity="0.9"><animate attributeName="r" values="9;11;9" dur="2.5s" repeatCount="indefinite"/></circle>`;
      svg+=`<circle cx="${x}" cy="${Y}" r="4.5" fill="#fff" opacity="0.95"><animate attributeName="r" values="4;5;4" dur="2.5s" repeatCount="indefinite"/></circle>`;
      svg+=`<text x="${x}" y="${Y+30}" text-anchor="middle" fill="var(--text)" font-size="10" font-weight="800" font-family="'DM Sans',sans-serif">${s.name.replace(' FS','')}</text>`;
      svg+=`<text x="${x}" y="${Y+42}" text-anchor="middle" fill="var(--dim)" font-size="5.5" font-family="'DM Sans',sans-serif">km ${s.km.toFixed(1)}</text>`;
    }else{
      svg+=`<circle cx="${x}" cy="${Y}" r="${isTerm?7.5:6}" fill="var(--bg)" stroke="#E63946" stroke-width="2.5" opacity="0.85"/>`;
      if(isTerm)svg+=`<circle cx="${x}" cy="${Y}" r="3" fill="#E63946" opacity="0.7"/>`;
      svg+=`<text x="${x}" y="${Y+25}" text-anchor="middle" fill="rgba(240,236,228,0.45)" font-size="7" font-weight="500" font-family="'DM Sans',sans-serif">${s.name.replace(' FS','')}</text>`;
      if(i===0)svg+=`<text x="${x}" y="${Y-20}" text-anchor="middle" fill="rgba(240,236,228,0.18)" font-size="5" font-weight="600" font-family="'DM Sans',sans-serif" letter-spacing="1">CAPOLINEA</text>`;
    }
    svg+=`</g>`;
  });

  svg+=`</svg>`;
  document.getElementById('schematic').innerHTML=`<div style="padding:72px 0 0;position:relative;z-index:2">${svg}</div>`;
}

// ─── MAP SETUP ──────────────────────────────────
let leafletMap,mapMarkers=[],userMarker=null,mapReady=false;

function initMap(){
  if(mapReady)return;
  leafletMap=L.map('map',{center:[40.667,14.800],zoom:14,zoomControl:false,attributionControl:false});
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',{maxZoom:19,subdomains:'abcd'}).addTo(leafletMap);

  // Lines
  L.polyline(ST.map(s=>[s.lat,s.lng]),{color:'#E63946',weight:5,opacity:0.9,lineCap:'round'}).addTo(leafletMap);
  L.polyline(ST.map(s=>[s.lat,s.lng]),{color:'#E63946',weight:12,opacity:0.15,lineCap:'round'}).addTo(leafletMap);
  L.polyline([[ST[5].lat,ST[5].lng],...FU.map(s=>[s.lat,s.lng])],{color:'#E63946',weight:3,opacity:0.2,dashArray:'8,8',lineCap:'round'}).addTo(leafletMap);
  L.polyline([[ST[0].lat,ST[0].lng],[DU.lat,DU.lng]],{color:'#34d399',weight:3,opacity:0.5,dashArray:'6,6',lineCap:'round'}).addTo(leafletMap);

  // Station markers
  ST.forEach((s,i)=>{
    const m=L.marker([s.lat,s.lng],{icon:mkIcon(s,i===selIdx,false,false)}).addTo(leafletMap).on('click',()=>selectStation(i));
    mapMarkers.push({m,s,i,t:'metro'});
    L.marker([s.lat,s.lng],{icon:L.divIcon({className:`slbl${i===selIdx?'':' d'}`,html:s.name,iconSize:[120,16],iconAnchor:[60,-12]}),interactive:false}).addTo(leafletMap);
  });

  // Duomo
  const dm=L.marker([DU.lat,DU.lng],{icon:mkIcon(DU,selIdx===-1,true,false)}).addTo(leafletMap).on('click',()=>selectStation(-1));
  mapMarkers.push({m:dm,s:DU,i:-1,t:'duo'});
  L.marker([DU.lat,DU.lng],{icon:L.divIcon({className:'slbl d',html:DU.name,iconSize:[140,16],iconAnchor:[70,-10]}),interactive:false}).addTo(leafletMap);

  // Future
  FU.forEach(s=>{
    L.marker([s.lat,s.lng],{icon:mkIcon(s,false,false,true),interactive:false}).addTo(leafletMap);
    L.marker([s.lat,s.lng],{icon:L.divIcon({className:'slbl f',html:s.name,iconSize:[100,16],iconAnchor:[50,-8]}),interactive:false}).addTo(leafletMap);
  });

  mapReady=true;
}

function mkIcon(s,sel,duo,fut){
  let c='sm';if(s.term)c+=' term';if(sel)c+=' sel';if(duo)c+=' duo';if(fut)c+=' fut';
  const sz=s.term?24:duo?16:20;
  return L.divIcon({className:c,iconSize:[sz,sz],iconAnchor:[sz/2,sz/2]});
}

function updateMapMarkers(){
  if(!mapReady)return;
  mapMarkers.forEach(({m,s,i,t})=>{
    m.setIcon(mkIcon(s,i===selIdx,t==='duo',false));
  });
}

// ─── VIEW TOGGLE ────────────────────────────────
function setView(mode){
  viewMode=mode;
  document.getElementById('tLine').classList.toggle('active',mode==='line');
  document.getElementById('tMap').classList.toggle('active',mode==='map');
  document.getElementById('tPlan').classList.toggle('active',mode==='plan');
  const sch=document.getElementById('schematic');
  const mw=document.getElementById('mapWrap');
  const pv=document.getElementById('planView');
  const panel=document.getElementById('panel');
  const loc=document.getElementById('locBtn');

  // Hide all first
  sch.classList.add('hidden');
  mw.classList.remove('active');
  pv.style.opacity='0';pv.style.pointerEvents='none';pv.style.transform='scale(0.96)';
  panel.style.display='';
  loc.style.display='';

  if(mode==='map'){
    initMap();
    mw.classList.add('active');
    setTimeout(()=>{
      leafletMap.invalidateSize();
      const st=selIdx===-1?DU:ST[Math.max(0,selIdx)];
      leafletMap.flyTo([st.lat,st.lng],15,{duration:0.8});
      updateMapMarkers();
    },100);
  }else if(mode==='plan'){
    pv.style.opacity='1';pv.style.pointerEvents='auto';pv.style.transform='scale(1)';
    panel.style.display='none';
    loc.style.display='none';
    initPlanForm();
  }else{
    sch.classList.remove('hidden');
    buildSchematic();
  }
}

// ─── SELECTION ──────────────────────────────────
function selectStation(idx){
  selIdx=idx;
  const st=idx===-1?DU:ST[idx];
  document.getElementById('stName').textContent=st.name;
  document.getElementById('stName').style.animation='none';
  requestAnimationFrame(()=>{document.getElementById('stName').style.animation='stReveal 0.4s ease-out both'});

  let meta='';
  if(userDist!==null)meta+=`<span class="geo-badge">${userDist<1000?userDist+'m':(userDist/1000).toFixed(1)+'km'}</span>`;
  if(idx>=0)meta+=`<span>km ${ST[idx].km.toFixed(1)}</span>`;
  if(idx===-1)meta+=`<span>Linea regionale Napoli–Salerno</span>`;
  document.getElementById('stMeta').innerHTML=meta;

  renderPOIBar();
  renderDepartures();
  refreshRealtime();

  if(viewMode==='line')buildSchematic();
  if(viewMode==='map'&&mapReady){
    updateMapMarkers();
    leafletMap.flyTo([st.lat,st.lng],15,{duration:0.6});
  }
  if(panelCollapsed){panelCollapsed=false;document.getElementById('panel').classList.remove('collapsed')}
}

// ─── POI BAR ────────────────────────────────────
function renderPOIBar(){
  const stId=selIdx===-1?'DV':ST[Math.max(0,selIdx)].id;
  const pois=POI[stId]||[];
  if(!pois.length){document.getElementById('poiBar').innerHTML='';return}
  let h='<div class="poi-scroll">';
  pois.forEach((p,i)=>{
    h+=`<div class="poi-chip" onclick="planTrip('${stId}',${i})"><span class="poi-icon">${p.icon}</span>${p.n}</div>`;
  });
  h+='</div>';
  document.getElementById('poiBar').innerHTML=h;
}

// ─── TRIP PLANNER ───────────────────────────────
function planTrip(stId,poiIdx){
  const pois=POI[stId]||[];
  const poi=pois[poiIdx];
  if(!poi)return;

  // Find which station this POI belongs to
  const destStIdx=stId==='DV'?-1:ST.findIndex(s=>s.id===stId);
  const destSt=destStIdx===-1?DU:ST[destStIdx];

  // Figure out where user is (selected station or GPS nearest)
  const fromIdx=selIdx;
  const fromSt=fromIdx===-1?DU:ST[Math.max(0,fromIdx)];

  // Calculate metro travel time from current station to POI's station
  let metroMins=0;
  if(fromIdx!==destStIdx && fromIdx>=0 && destStIdx>=0){
    metroMins=Math.abs(CUM[destStIdx]-CUM[fromIdx]);
  } else if(fromIdx===destStIdx){
    metroMins=0;
  } else {
    metroMins=3; // Duomo branch
  }

  // Next train departure
  const now=new Date();
  const cm=now.getHours()*60+now.getMinutes();
  const hol=now.getDay()===0;
  let waitMins=0, nextTrainTime='';

  if(metroMins>0 && fromIdx>=0 && destStIdx>=0){
    const dir=destStIdx>fromIdx?'arechi':'salerno';
    const deps=metroDeps(fromIdx,cm,hol).filter(d=>d.dir===dir);
    if(deps.length){waitMins=deps[0].mins;nextTrainTime=deps[0].time}
    else{waitMins=0;nextTrainTime='—'}
  }

  const totalMins=waitMins+metroMins+poi.walk;
  const arriveMin=cm+totalMins;
  const arrH=Math.floor(arriveMin/60)%24, arrM=Math.floor(arriveMin%60);
  const arriveTime=`${String(arrH).padStart(2,'0')}:${String(arrM).padStart(2,'0')}`;

  // Build the modal
  const sameStation=(metroMins===0 && fromIdx===destStIdx);
  const d=document.createElement('div');
  d.id='tripModal';
  d.innerHTML=`
  <div style="position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:2000;display:flex;align-items:flex-end;justify-content:center;animation:fadeIn 0.2s ease" onclick="if(event.target===this)this.remove()">
    <div style="background:rgba(20,20,28,0.98);backdrop-filter:blur(24px);border-radius:20px 20px 0 0;padding:24px 20px 32px;width:100%;max-width:420px;animation:slideUp 0.35s cubic-bezier(0.16,1,0.3,1) both">
      <div style="width:36px;height:4px;border-radius:2px;background:rgba(255,255,255,0.15);margin:0 auto 20px"></div>

      <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
        <span style="font-size:28px">${poi.icon}</span>
        <div>
          <div style="font-size:18px;font-weight:800">${poi.n}</div>
          <div style="font-size:12px;color:var(--dim)">${poi.walk} min a piedi da ${destSt.name}</div>
        </div>
      </div>

      <div style="margin:16px 0;padding:16px;border-radius:14px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06)">
        <!-- Timeline -->
        <div style="display:flex;gap:12px">
          <div style="display:flex;flex-direction:column;align-items:center;padding-top:2px">
            <div class="poi-trip-dot" style="background:var(--red)"></div>
            ${!sameStation?`<div class="poi-trip-line" style="background:var(--red);opacity:0.3"></div>
            <div class="poi-trip-dot" style="background:var(--red)"></div>`:''}
            <div class="poi-trip-line" style="background:rgba(255,255,255,0.15);${sameStation?'':''}"></div>
            <div class="poi-trip-dot" style="background:var(--emerald)"></div>
          </div>
          <div style="flex:1">
            <div style="font-size:13px;font-weight:700;padding:0 0 ${sameStation?'14px':'10px'}">${fromSt.name}</div>
            ${!sameStation?`
            <div style="font-size:11px;color:var(--dim);padding:0 0 4px">
              ${waitMins>0?`Prossimo treno: <span style="color:var(--text);font-weight:700">${nextTrainTime}</span> · attesa ${waitMins} min`:'Treno in partenza'}
            </div>
            <div style="font-size:13px;font-weight:700;padding:6px 0 10px;display:flex;align-items:center;gap:6px">
              ${destSt.name}
              <span style="font-size:10px;color:var(--dim);font-weight:400">${metroMins} min metro</span>
            </div>`:''}
            <div style="font-size:11px;color:var(--dim);padding:0 0 4px">🚶 ${poi.walk} min a piedi</div>
            <div style="font-size:13px;font-weight:700;padding:6px 0 0;color:var(--emerald)">${poi.n}</div>
          </div>
        </div>
      </div>

      <!-- Result -->
      <div style="display:flex;align-items:center;justify-content:space-between;padding:0 4px">
        <div>
          <div style="font-size:11px;color:var(--dim)">Tempo totale</div>
          <div style="font-size:28px;font-weight:800;letter-spacing:-1px">${totalMins} min</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:11px;color:var(--dim)">Arrivo stimato</div>
          <div style="font-size:28px;font-weight:800;letter-spacing:-1px;color:var(--emerald)">${arriveTime}</div>
        </div>
      </div>

      <!-- Navigate button -->
      <a href="https://www.google.com/maps/dir/?api=1&destination=${poi.lat},${poi.lng}&travelmode=walking" target="_blank" rel="noopener"
        style="display:flex;align-items:center;justify-content:center;gap:8px;margin-top:16px;padding:14px;border-radius:14px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.08);color:var(--text);text-decoration:none;font-weight:700;font-size:14px">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
        Naviga con Google Maps
      </a>

      <div onclick="document.getElementById('tripModal').remove()" style="text-align:center;padding:14px;color:var(--dim);font-size:13px;cursor:pointer;margin-top:4px">Chiudi</div>
    </div>
  </div>`;
  document.body.appendChild(d);
}

function renderDepartures(){
  const now=new Date(),cm=now.getHours()*60+now.getMinutes(),hol=now.getDay()===0;
  let h='';
  if(selIdx>=0){
    const service=metroServiceStatus(cm,now.getDay());
    if(service.closed)h+=`<div class="service-closed"><span class="service-closed-dot"></span><div><strong>Metropolitana chiusa</strong><span>${service.detail}</span></div></div>`;
  }
  const station=selIdx===-1?DU:ST[Math.max(0,selIdx)];
  const realtime=realtimeByStation.get(station.id);
  if(realtime?.departures.length){
    const age=Math.max(0,Math.round((Date.now()-Date.parse(realtime.observedAt))/60000));
    const label=realtime.source==='live'?'LIVE':realtime.source==='cached'?`AGGIORNATO ${age} MIN FA`:'DATI LIVE NON RECENTI';
    h+=`<div class="dir-label" style="background:rgba(52,211,153,0.1);color:#34d399">${label}</div>`;
    realtime.departures.slice(0,6).forEach((d,i)=>{
      const [hh,mm]=d.time.split(':').map(Number);
      const expected=hh*60+mm+(d.delayMinutes||0);
      h+=dc({time:escapeHTML(d.time),dest:`→ ${escapeHTML(d.destination)}`,mins:Math.max(0,expected-cm)},i===0,'#34d399',i);
    });
    h+=`<div style="height:1px;background:rgba(255,255,255,0.06);margin:12px 0"></div>`;
  }
  if(selIdx>=0){
    const deps=metroDeps(selIdx,cm,hol);
    const toA=deps.filter(d=>d.dir==='arechi').slice(0,3),toS=deps.filter(d=>d.dir==='salerno').slice(0,3);
    if(selIdx<5&&toA.length){h+=`<div class="dir-label" style="background:rgba(230,57,70,0.12);color:#E63946">→ Stadio Arechi</div>`;toA.forEach((d,i)=>{h+=dc(d,i===0,'#E63946',i)})}
    if(selIdx>0&&toS.length){h+=`<div class="dir-label" style="background:rgba(100,175,255,0.1);color:rgba(100,175,255,0.9);${toA.length?'margin-top:12px':''}">→ Salerno FS</div>`;toS.forEach((d,i)=>{h+=dc(d,i===0,'rgba(100,175,255,0.9)',i+3)})}
  }
  if(selIdx===0||selIdx===-1){
    const rd=duomoDeps(cm).slice(0,selIdx===-1?6:3);
    if(rd.length){
      if(selIdx===0&&h)h+=`<div style="height:1px;background:rgba(255,255,255,0.06);margin:12px 0"></div>`;
      h+=`<div class="dir-label" style="background:rgba(52,211,153,0.1);color:#34d399">${selIdx===-1?'Regionali':'Duomo-Via Vernieri'}</div>`;
      rd.forEach((d,i)=>{h+=dc(d,i===0,'#34d399',i+6)});
    }
  }
  if(!h)h=`<div style="text-align:center;padding:20px;color:var(--dim);font-size:13px">Servizio terminato per oggi.</div>`;

  // Ticket purchase section
  const stName=selIdx===-1?'Duomo - Via Vernieri':ST[Math.max(0,selIdx)].name;
  h+=`<div class="ticket-bar">
    <a class="ticket-btn primary" href="javascript:void(0)" onclick="buyTicket('app')">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>
      Acquista biglietto
    </a>
    <a class="ticket-btn secondary" href="javascript:void(0)" onclick="buyTicket('stores')" title="Dove comprare">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><circle cx="12" cy="17" r=".5"/></svg>
    </a>
  </div>
  <div class="ticket-info">1,40€ corsa singola · Biglietto Digitale Regionale via app o sito Trenitalia</div>`;

  h+=`<div class="footer-info"><span style="color:#E63946">●</span> Orario programmato sempre disponibile${realtime?' · dati live opzionali':''}</div>`;
  const el=document.getElementById('departures');
  if(el.getAttribute('data-hash')===h)return; // skip if unchanged
  el.setAttribute('data-hash',h);
  el.innerHTML=h;
}

function dc(d,first,col,di){
  const mh=d.mins===0?`<div class="dep-mins" style="font-size:14px;color:var(--emerald)">ORA</div><div class="dep-mins-label" style="color:var(--emerald)">in stazione</div>`:`<div class="dep-mins" style="color:${col}">${d.mins}</div><div class="dep-mins-label">min</div>`;
  return`<div class="dep-card${first?' first':''}" style="animation-delay:${di*0.04}s"><div><div class="dep-time">${d.time}</div><div class="dep-dest">${d.dest}</div></div><div style="text-align:right;min-width:40px">${mh}</div></div>`;
}

// ─── PANEL ──────────────────────────────────────
function togglePanel(){panelCollapsed=!panelCollapsed;document.getElementById('panel').classList.toggle('collapsed',panelCollapsed)}

// ─── GEOLOCATION ────────────────────────────────
function locateUser(){
  if(!navigator.geolocation)return;
  navigator.geolocation.getCurrentPosition(pos=>{
    const lat=pos.coords.latitude,lng=pos.coords.longitude;
    userPos={lat,lng};

    // Find nearest
    let minD=Infinity,minI=0;
    ST.forEach((s,i)=>{const d=hav(lat,lng,s.lat,s.lng);if(d<minD){minD=d;minI=i}});
    if(hav(lat,lng,DU.lat,DU.lng)<minD){minD=hav(lat,lng,DU.lat,DU.lng);minI=-1}
    userDist=Math.round(minD);
    selectStation(minI);

    // Map marker
    if(viewMode==='map'&&mapReady){
      if(userMarker)leafletMap.removeLayer(userMarker);
      userMarker=L.marker([lat,lng],{icon:L.divIcon({className:'',html:'<div class="um"><div class="umr"></div></div>',iconSize:[16,16],iconAnchor:[8,8]}),zIndexOffset:1000}).addTo(leafletMap);
    }
  },null,{enableHighAccuracy:true,timeout:8000});
}

// ─── TICKET PURCHASE ────────────────────────────
// Trenitalia station names for URL (matched to their search)
const TI_NAMES={SA:'SALERNO',TO:'SALERNO TORRIONE',PA:'SALERNO PASTENA',ME:'SALERNO MERCATELLO-MARICONDA',AR:'SALERNO ARBOSTELLA',ST:'STADIO ARECHI-AZ.OSPED.UNIV.',DV:'DUOMO - VIA VERNIERI'};

function buyTicket(mode){
  if(mode==='stores'){
    showStoreInfo();
    return;
  }

  const st=selIdx===-1?DU:ST[Math.max(0,selIdx)];
  const origin=TI_NAMES[st.id]||'SALERNO';
  // Determine likely destination based on position
  const dest=selIdx<=2?TI_NAMES.ST:TI_NAMES.SA;
  const webUrl='https://www.trenitalia.com/it.html';

  // Try to open Trenitalia app first (works on mobile)
  const isIOS=/iPad|iPhone|iPod/.test(navigator.userAgent);
  const isAndroid=/Android/.test(navigator.userAgent);

  if(isIOS||isAndroid){
    // Show choice dialog
    const d=document.createElement('div');
    d.id='ticketModal';
    d.innerHTML=`
      <div style="position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:2000;display:flex;align-items:flex-end;justify-content:center;animation:fadeIn 0.2s ease" onclick="if(event.target===this)this.remove()">
        <div style="background:rgba(20,20,28,0.98);backdrop-filter:blur(24px);border-radius:20px 20px 0 0;padding:24px 20px 32px;width:100%;max-width:420px;animation:slideUp 0.35s cubic-bezier(0.16,1,0.3,1) both">
          <div style="width:36px;height:4px;border-radius:2px;background:rgba(255,255,255,0.15);margin:0 auto 20px"></div>
          <div style="font-size:18px;font-weight:800;margin-bottom:4px">Acquista biglietto</div>
          <div style="font-size:12px;color:var(--dim);margin-bottom:20px">Da ${st.name} · 1,40€ corsa singola</div>

          <a href="${webUrl}" target="_blank" rel="noopener" onclick="document.getElementById('ticketModal').remove()"
            style="display:flex;align-items:center;gap:12px;padding:16px;border-radius:14px;background:var(--red);color:#fff;text-decoration:none;font-weight:700;font-size:14px;margin-bottom:8px;border:none">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>
            <div>
              <div>Apri Trenitalia</div>
              <div style="font-size:11px;font-weight:400;opacity:0.7;margin-top:2px">Biglietto Digitale Regionale</div>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-left:auto"><path d="M7 17L17 7M17 7H7M17 7v10"/></svg>
          </a>

          <a href="https://apps.apple.com/it/app/trenitalia/id331050847" target="_blank" rel="noopener" onclick="document.getElementById('ticketModal').remove()"
            style="display:${isIOS?'flex':'none'};align-items:center;gap:12px;padding:14px 16px;border-radius:14px;background:rgba(255,255,255,0.06);color:var(--text);text-decoration:none;font-weight:600;font-size:13px;margin-bottom:8px;border:1px solid rgba(255,255,255,0.08)">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83"/><path d="M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11"/></svg>
            Scarica app da App Store
          </a>

          <a href="https://play.google.com/store/apps/details?id=com.lynxspa.prontotreno" target="_blank" rel="noopener" onclick="document.getElementById('ticketModal').remove()"
            style="display:${isAndroid?'flex':'none'};align-items:center;gap:12px;padding:14px 16px;border-radius:14px;background:rgba(255,255,255,0.06);color:var(--text);text-decoration:none;font-weight:600;font-size:13px;margin-bottom:8px;border:1px solid rgba(255,255,255,0.08)">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M3 20.5v-17c0-.59.34-1.11.84-1.35L13.69 12l-9.85 9.85c-.5-.24-.84-.76-.84-1.35zm13.81-5.38L6.05 21.34l8.49-8.49 2.27 2.27zm.91-.91L19.59 12l-1.87-2.21-2.27 2.27 2.27 2.15zM6.05 2.66l10.76 6.22-2.27 2.27-8.49-8.49z"/></svg>
            Scarica app da Play Store
          </a>

          <div onclick="document.getElementById('ticketModal').remove()" style="text-align:center;padding:12px;color:var(--dim);font-size:13px;cursor:pointer;margin-top:4px">Annulla</div>
        </div>
      </div>`;
    document.body.appendChild(d);
  } else {
    // Desktop: just open Trenitalia
    window.open(webUrl,'_blank');
  }
}

function showStoreInfo(){
  const d=document.createElement('div');
  d.id='storeModal';
  d.innerHTML=`
    <div style="position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:2000;display:flex;align-items:flex-end;justify-content:center;animation:fadeIn 0.2s ease" onclick="if(event.target===this)this.remove()">
      <div style="background:rgba(20,20,28,0.98);backdrop-filter:blur(24px);border-radius:20px 20px 0 0;padding:24px 20px 32px;width:100%;max-width:420px;animation:slideUp 0.35s cubic-bezier(0.16,1,0.3,1) both">
        <div style="width:36px;height:4px;border-radius:2px;background:rgba(255,255,255,0.15);margin:0 auto 20px"></div>
        <div style="font-size:18px;font-weight:800;margin-bottom:16px">Dove acquistare</div>

        <div style="display:flex;flex-direction:column;gap:10px">
          <div style="display:flex;align-items:flex-start;gap:12px;padding:14px;border-radius:12px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06)">
            <div style="width:32px;height:32px;border-radius:8px;background:rgba(230,57,70,0.15);display:flex;align-items:center;justify-content:center;flex-shrink:0">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#E63946" stroke-width="2"><rect x="5" y="2" width="14" height="20" rx="2"/><circle cx="12" cy="18" r="1"/></svg>
            </div>
            <div>
              <div style="font-weight:700;font-size:13px">App Trenitalia</div>
              <div style="font-size:11px;color:var(--dim);margin-top:2px;line-height:1.4">Biglietto Digitale Regionale. Acquista fino a 5 min prima della partenza, check-in automatico.</div>
            </div>
          </div>

          <div style="display:flex;align-items:flex-start;gap:12px;padding:14px;border-radius:12px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06)">
            <div style="width:32px;height:32px;border-radius:8px;background:rgba(100,175,255,0.12);display:flex;align-items:center;justify-content:center;flex-shrink:0">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64b5ff" stroke-width="2"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M2 10h20"/><path d="M6 14h4"/></svg>
            </div>
            <div>
              <div style="font-weight:700;font-size:13px">Tap&Tap contactless</div>
              <div style="font-size:11px;color:var(--dim);margin-top:2px;line-height:1.4">Carta di pagamento contactless ai lettori in stazione. Tariffa cumulata automatica.</div>
            </div>
          </div>

          <div style="display:flex;align-items:flex-start;gap:12px;padding:14px;border-radius:12px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06)">
            <div style="width:32px;height:32px;border-radius:8px;background:rgba(52,211,153,0.12);display:flex;align-items:center;justify-content:center;flex-shrink:0">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#34d399" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            </div>
            <div>
              <div style="font-weight:700;font-size:13px">Punti vendita fisici</div>
              <div style="font-size:11px;color:var(--dim);margin-top:2px;line-height:1.4">Biglietteria stazione FS, edicole e tabaccai abilitati nelle vicinanze delle fermate.</div>
            </div>
          </div>

          <div style="display:flex;align-items:flex-start;gap:12px;padding:14px;border-radius:12px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06)">
            <div style="width:32px;height:32px;border-radius:8px;background:rgba(234,179,8,0.12);display:flex;align-items:center;justify-content:center;flex-shrink:0">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#eab308" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/></svg>
            </div>
            <div>
              <div style="font-weight:700;font-size:13px">Sito trenitalia.com</div>
              <div style="font-size:11px;color:var(--dim);margin-top:2px;line-height:1.4">Acquisto online con carta, ricevi il biglietto via email. Anche da self-service in stazione.</div>
            </div>
          </div>
        </div>

        <div style="margin-top:14px;padding:10px 12px;border-radius:10px;background:rgba(52,211,153,0.06);border:1px solid rgba(52,211,153,0.1);font-size:11px;color:rgba(52,211,153,0.8);line-height:1.5">
          💡 Consiglio: con il Biglietto Digitale Regionale, in caso di ritardo ricevi automaticamente l'indennizzo sulla carta usata per l'acquisto.
        </div>

        <div onclick="document.getElementById('storeModal').remove()" style="text-align:center;padding:14px;color:var(--dim);font-size:13px;cursor:pointer;margin-top:4px">Chiudi</div>
      </div>
    </div>`;
  document.body.appendChild(d);
}


// ─── TRIP PLANNER (free-form) ─────────────────────
let planFromCoords=null, planToCoords=null;
let geocodeTimer=null;

function initPlanForm(){
  const now=new Date();
  const nextH=(now.getHours()+1)%24;
  document.getElementById('planTime').value=`${String(nextH).padStart(2,'0')}:00`;
  if(userPos){planFromCoords={lat:userPos.lat,lng:userPos.lng};document.getElementById('planFromAddr').value='📍 La mia posizione'}
  const sc=document.getElementById('planPOIShortcuts');
  if(sc.children.length)return;
  let chips='';
  Object.entries(POI).forEach(([stId,pois])=>{pois.forEach(p=>{chips+=`<div class="poi-chip" onclick="planSetPOI('${p.n.replace(/'/g,"\\'")}',${p.lat},${p.lng})">${p.icon} ${p.n}</div>`})});
  sc.innerHTML=chips;
  const fi=document.getElementById('planFromAddr'),ti=document.getElementById('planToAddr');
  fi.addEventListener('input',()=>geocodeDebounced(fi.value,'from'));
  ti.addEventListener('input',()=>geocodeDebounced(ti.value,'to'));
  fi.addEventListener('focus',()=>{if(fi.value==='📍 La mia posizione')fi.select()});
}

function planSetPOI(name,lat,lng){
  document.getElementById('planToAddr').value=name;
  planToCoords={lat,lng};
  document.getElementById('planToSugg').classList.remove('open');
  document.getElementById('planToSugg').innerHTML='';
}

function planUseGPS(field){
  if(!navigator.geolocation)return;
  const input=document.getElementById(field==='from'?'planFromAddr':'planToAddr');
  input.value='Localizzazione...';
  navigator.geolocation.getCurrentPosition(pos=>{
    const c={lat:pos.coords.latitude,lng:pos.coords.longitude};
    if(field==='from'){planFromCoords=c;input.value='📍 La mia posizione'}
    else{planToCoords=c;input.value='📍 Posizione attuale'}
  },()=>{input.value='';input.placeholder='Errore GPS, inserisci indirizzo'},{enableHighAccuracy:true,timeout:8000});
}

function geocodeDebounced(q,field){
  clearTimeout(geocodeTimer);
  if(q.length<3){document.getElementById(field==='from'?'planFromSugg':'planToSugg').classList.remove('open');return}
  geocodeTimer=setTimeout(()=>geocodeSearch(q,field),400);
}

async function geocodeSearch(q,field){
  const el=document.getElementById(field==='from'?'planFromSugg':'planToSugg');
  el.innerHTML='<div class="plan-loading">Cercando...</div>';el.classList.add('open');
  try{
    const r=await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q+', Salerno, Italy')}&format=json&limit=5&addressdetails=1`,{headers:{'Accept-Language':'it'}});
    const data=await r.json();
    if(!data.length){el.innerHTML='<div class="plan-loading">Nessun risultato</div>';return}
    el.innerHTML=data.map(d=>{
      const nm=d.display_name.split(',').slice(0,3).join(', ');
      return`<div class="plan-sugg-item" onclick="planSelectAddr('${field}',${d.lat},${d.lon},'${nm.replace(/'/g,"\\'")}')">${nm}<div class="sugg-sub">${d.type||''}</div></div>`;
    }).join('');
  }catch{el.innerHTML='<div class="plan-loading">Errore di rete</div>'}
}

function planSelectAddr(field,lat,lng,name){
  document.getElementById(field==='from'?'planFromAddr':'planToAddr').value=name;
  if(field==='from')planFromCoords={lat,lng};else planToCoords={lat,lng};
  const el=document.getElementById(field==='from'?'planFromSugg':'planToSugg');
  el.classList.remove('open');el.innerHTML='';
}

function walkMins(lat1,lng1,lat2,lng2){
  const d=hav(lat1,lng1,lat2,lng2)*1.4;return Math.max(1,Math.round(d/75));
}

function calculatePlan(){
  const res=document.getElementById('planResult');
  if(!planFromCoords){res.innerHTML=errBox('Inserisci partenza o usa GPS');return}
  if(!planToCoords){res.innerHTML=errBox('Inserisci destinazione');return}
  const tv=document.getElementById('planTime').value;
  if(!tv){res.innerHTML=errBox('Inserisci orario di arrivo');return}
  const dv=document.getElementById('planDay').value;
  const now=new Date();
  const [aH,aM]=tv.split(':').map(Number),arrMin=aH*60+aM;

  let bFS=0,bFD=Infinity;ST.forEach((s,i)=>{const d=hav(planFromCoords.lat,planFromCoords.lng,s.lat,s.lng);if(d<bFD){bFD=d;bFS=i}});
  let bTS=0,bTD=Infinity;ST.forEach((s,i)=>{const d=hav(planToCoords.lat,planToCoords.lng,s.lat,s.lng);if(d<bTD){bTD=d;bTS=i}});
  const w1=walkMins(planFromCoords.lat,planFromCoords.lng,ST[bFS].lat,ST[bFS].lng);
  const w2=walkMins(ST[bTS].lat,ST[bTS].lng,planToCoords.lat,planToCoords.lng);
  const directW=walkMins(planFromCoords.lat,planFromCoords.lng,planToCoords.lat,planToCoords.lng);
  const mMins=Math.abs(CUM[bTS]-CUM[bFS]);
  const same=bFS===bTS;
  const mustArr=arrMin-w2;
  const selectedWeekday=dv==='today'?now.getDay():dv==='tomorrow'?(now.getDay()+1)%7:dv==='weekend'?0:1;
  const best=same?null:findLatestConnection(bFS,bTS,mustArr,selectedWeekday);

  const fmt=m=>{const h=Math.floor(((m%1440)+1440)%1440/60),mi=Math.floor(((m%1440)+1440)%1440%60);return`${String(h).padStart(2,'0')}:${String(mi).padStart(2,'0')}`};
  const fN=document.getElementById('planFromAddr').value;
  const tN=document.getElementById('planToAddr').value;

  if(same||directW<=(w1+3+mMins+w2)){
    const lh=arrMin-directW;
    res.innerHTML=`<div style="border-radius:18px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);overflow:hidden;animation:cardIn 0.4s ease-out both">
      <div style="padding:16px 18px;background:rgba(100,175,255,0.06);border-bottom:1px solid rgba(255,255,255,0.06);text-align:center">
        <div style="font-size:12px;color:var(--dim);margin-bottom:4px">🚶 Vai a piedi — è più veloce!</div>
        <div style="font-size:11px;color:var(--dim)">Esci alle <span style="color:var(--text);font-weight:800;font-size:18px">${fmt(lh)}</span> · ${directW} min a piedi</div>
      </div>
      <a href="https://www.google.com/maps/dir/?api=1&origin=${planFromCoords.lat},${planFromCoords.lng}&destination=${planToCoords.lat},${planToCoords.lng}&travelmode=walking" target="_blank" rel="noopener" style="display:flex;align-items:center;justify-content:center;gap:8px;padding:14px;color:var(--text);text-decoration:none;font-weight:700;font-size:13px;border-top:1px solid rgba(255,255,255,0.05)">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>Apri in Google Maps</a></div>`;
    return;
  }
  if(!best){res.innerHTML=errBox('Nessun treno disponibile. Prova un orario diverso.');return}
  const lh=best.da-w1,tot=arrMin-lh;
  res.innerHTML=`<div style="border-radius:18px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);overflow:hidden;animation:cardIn 0.4s ease-out both">
    <div style="padding:16px 18px;background:rgba(230,57,70,0.08);border-bottom:1px solid rgba(255,255,255,0.06);display:flex;align-items:center;justify-content:space-between">
      <div><div style="font-size:11px;color:var(--dim)">Esci alle</div><div style="font-size:32px;font-weight:800;letter-spacing:-1.5px;color:var(--red)">${fmt(lh)}</div></div>
      <div style="text-align:right"><div style="font-size:11px;color:var(--dim)">Arrivi entro le</div><div style="font-size:32px;font-weight:800;letter-spacing:-1.5px;color:var(--emerald)">${fmt(arrMin)}</div></div>
    </div>
    <div style="padding:18px;display:flex;gap:14px">
      <div style="display:flex;flex-direction:column;align-items:center;padding-top:2px">
        <div style="width:10px;height:10px;border-radius:50%;background:var(--blue);flex-shrink:0"></div>
        <div style="width:2px;flex:1;background:rgba(255,255,255,0.08)"></div>
        <div style="width:10px;height:10px;border-radius:50%;background:var(--red);flex-shrink:0"></div>
        <div style="width:3px;flex:1;background:var(--red);opacity:0.4"></div>
        <div style="width:10px;height:10px;border-radius:50%;background:var(--red);flex-shrink:0"></div>
        <div style="width:2px;flex:1;background:rgba(255,255,255,0.08)"></div>
        <div style="width:10px;height:10px;border-radius:50%;background:var(--emerald);flex-shrink:0"></div>
      </div>
      <div style="flex:1">
        <div style="padding-bottom:12px"><div style="font-size:13px;font-weight:700">${fmt(lh)} — ${fN}</div><div style="font-size:11px;color:var(--dim)">🚶 ${w1} min a piedi</div></div>
        <div style="padding-bottom:12px"><div style="font-size:13px;font-weight:700;display:flex;align-items:center;gap:6px">${fmt(best.da)} — ${ST[bFS].name} <span style="font-size:10px;padding:2px 6px;border-radius:4px;background:rgba(230,57,70,0.12);color:var(--red);font-weight:700">METRO</span></div><div style="font-size:11px;color:var(--dim)">🚇 ${mMins} min → ${ST[bTS].name}</div></div>
        <div style="padding-bottom:12px"><div style="font-size:13px;font-weight:700">${fmt(best.aa)} — ${ST[bTS].name}</div><div style="font-size:11px;color:var(--dim)">🚶 ${w2} min a piedi</div></div>
        <div><div style="font-size:13px;font-weight:700;color:var(--emerald)">${fmt(arrMin)} — ${tN}</div></div>
      </div>
    </div>
    <div style="padding:14px 18px;background:rgba(255,255,255,0.02);border-top:1px solid rgba(255,255,255,0.05);display:flex;align-items:center;justify-content:space-between"><div style="font-size:12px;color:var(--dim)">Durata totale</div><div style="font-size:16px;font-weight:800">${tot} min</div></div>
    <a href="https://www.google.com/maps/dir/?api=1&origin=${planFromCoords.lat},${planFromCoords.lng}&destination=${planToCoords.lat},${planToCoords.lng}&travelmode=transit" target="_blank" rel="noopener" style="display:flex;align-items:center;justify-content:center;gap:8px;padding:14px;color:var(--text);text-decoration:none;font-weight:600;font-size:13px;border-top:1px solid rgba(255,255,255,0.05)"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>Apri in Google Maps</a>
  </div>
  <div style="margin-top:12px;padding:10px 14px;border-radius:12px;background:rgba(234,179,8,0.06);border:1px solid rgba(234,179,8,0.1);font-size:11px;color:rgba(234,179,8,0.8);line-height:1.5">💡 Prevedi 2-3 min di margine. Tempi a piedi calcolati su percorso stimato.</div>`;
}

function errBox(msg){return`<div style="text-align:center;padding:20px;color:var(--dim);font-size:13px;border-radius:14px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06)">${msg}</div>`}

// ─── CLOCK ──────────────────────────────────────
function tick(){
  const n=new Date(),ts=`${String(n.getHours()).padStart(2,'0')}:${String(n.getMinutes()).padStart(2,'0')}`;
  document.getElementById('clock').textContent=`${ts} · ${n.getDay()===0?'Fest.':'Fer.'}`;
}

// ─── INIT ───────────────────────────────────────
tick();setInterval(tick,15000);
buildSchematic();
selectStation(0);

// Schematic redraws every 2s for train positions (no card animations)
setInterval(()=>{if(viewMode==='line')buildSchematic()},2000);
// Departures refresh every 30s only, with dirty check to avoid re-animation
let lastDepHTML='';
function refreshDeps(){
  const el=document.getElementById('departures');
  const prev=lastDepHTML;
  renderDepartures();
  const cur=el.innerHTML;
  if(prev===cur){/* no change, skip */}
  lastDepHTML=cur;
}
setInterval(refreshDeps,30000);
setInterval(refreshRealtime,30000);

// Register service worker
registerServiceWorker();
initInstallPrompt();

// Inline event attributes are retained for now; expose only the UI entry points.
Object.assign(window,{
  buyTicket,calculatePlan,locateUser,planSelectAddr,planSetPOI,planTrip,
  planUseGPS,selectStation,setView,togglePanel,
});
