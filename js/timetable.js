import { CUM, TOT } from "./data.js";

// ─── TIMETABLE ──────────────────────────────────
export function metroDeps(si,cm,hol){
  const sm=hol?35:5,r=[];
  for(const dir of['arechi','salerno']){let h=6,m=sm;while(h<22||(h===22&&m<=5)){const dm=h*60+m,am=dir==='arechi'?dm+CUM[si]:dm+CUM[5-si];if(am>=cm&&am<1440){const hh=Math.floor(am/60),mm=am%60;r.push({time:`${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}`,dest:dir==='arechi'?'→ Arechi':'→ Salerno FS',dir,mins:Math.max(0,Math.round(am-cm))})}m+=30;if(m>=60){m-=60;h++}}}
  r.sort((a,b)=>a.mins-b.mins);return r;
}
const DU_T=[[5,6],[5,28],[5,51],[6,14],[6,39],[7,4],[7,22],[7,44],[8,6],[8,28],[8,53],[9,18],[9,44],[10,14],[10,44],[11,14],[11,44],[12,14],[12,44],[13,14],[13,44],[14,14],[14,44],[15,14],[15,39],[16,4],[16,28],[16,53],[17,14],[17,39],[18,7],[18,28],[18,53],[19,18],[19,44],[20,13],[20,39],[21,9],[21,39]];
export function duomoDeps(cm){const r=[];for(const[h,m]of DU_T){const dm=h*60+m;if(dm>=cm)r.push({time:`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`,dest:'→ Napoli',mins:Math.max(0,Math.round(dm-cm))})}return r}

// Active trains
export function activeTrains(cm,hol){
  const tr=[];const sm=hol?35:5;
  for(const dir of['arechi','salerno']){let h=6,m=sm;while(h<22||(h===22&&m<=5)){const dm=h*60+m,el=cm-dm;if(el>=0&&el<=TOT+1){const c=Math.max(0,Math.min(el,TOT));tr.push({frac:dir==='arechi'?c/TOT:1-c/TOT,dir,at:el<=0.5||el>=TOT-0.5,id:`M${dir[0].toUpperCase()}${h}:${String(m).padStart(2,'0')}`})}m+=30;if(m>=60){m-=60;h++}}}
  return tr;
}

export function hav(a1,o1,a2,o2){const R=6371000,r=d=>d*Math.PI/180,dl=r(a2-a1),dg=r(o2-o1),a=Math.sin(dl/2)**2+Math.cos(r(a1))*Math.cos(r(a2))*Math.sin(dg/2)**2;return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a))}
