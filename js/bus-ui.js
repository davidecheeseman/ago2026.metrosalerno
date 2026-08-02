import { BUS_LINES, BUS_META, BUS_STOPS, BUS_TRIPS } from "./bus-data.js";

let initialized = false, userPosition = null, selectedLine = null, selectedTripIndex = null, selectedStopPosition = 0;
const searchIndex = new Map();
const normalize = value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const escapeHTML = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
const toMinutes = time => { const [hours, minutes] = time.split(":").map(Number); return hours * 60 + minutes; };

function validityActive(label, date = new Date()) {
  const text = normalize(label), day = date.getDay(), month = date.getMonth();
  const summer = month >= 5 && month <= 8;
  if ((text.includes("escluso estivo") || text.includes("escl. estivo")) && summer) return false;
  if (text.includes("estivo") && !text.includes("escluso") && !text.includes("escl.") && !summer) return false;
  if (text.includes("scolastic") && !text.includes("vacanze") && (month === 6 || month === 7)) return false;
  if (text.includes("sabato")) return day === 6;
  if (text.includes("lun-ven") || text.includes("lu-ve")) return day >= 1 && day <= 5;
  if (text.includes("festivo") && !text.includes("giornaliero")) return day === 0;
  if (text.includes("feriale")) return day >= 1 && day <= 6;
  if (/^0?3(?:-|$)/.test(text)) return day === 0;
  if (/^0?(2|4|23)(?:-|$)/.test(text)) return day >= 1 && day <= 6;
  return true;
}

function distance(a, b) {
  const radians = degrees => degrees * Math.PI / 180, earth = 6371000;
  const dLat = radians(b.lat - a.lat), dLng = radians(b.lng - a.lng);
  const value = Math.sin(dLat / 2) ** 2 + Math.cos(radians(a.lat)) * Math.cos(radians(b.lat)) * Math.sin(dLng / 2) ** 2;
  return earth * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function representativeTrips(line) {
  const byDirection = new Map();
  for (const tripIndex of line.trips) {
    const trip = BUS_TRIPS[tripIndex];
    const current = byDirection.get(trip.direction);
    if (trip.stops.length && (!current || trip.stops.length > BUS_TRIPS[current].stops.length)) byDirection.set(trip.direction, tripIndex);
  }
  return [...byDirection.values()];
}

function nextTripsAtStop(line, stopIndex) {
  const now = new Date(), current = now.getHours() * 60 + now.getMinutes();
  return line.trips.map(index => BUS_TRIPS[index])
    .filter(trip => trip.stops.length && validityActive(trip.validity, now))
    .map(trip => {
      const stop = trip.stops.find(item => item[0] === stopIndex);
      return stop ? { trip, stop, departure: toMinutes(stop[1]) } : null;
    }).filter(Boolean)
    .filter(item => item.departure >= current)
    .sort((a, b) => a.departure - b.departure)
    .slice(0, 8);
}

function lineSearchText(line) {
  if (!searchIndex.has(line.code)) {
    const stopNames = new Set();
    for (const tripIndex of line.trips) {
      for (const [stopIndex] of BUS_TRIPS[tripIndex].stops) stopNames.add(BUS_STOPS[stopIndex]?.name);
    }
    searchIndex.set(line.code, normalize([line.code, ...line.terminals, ...line.directions, ...stopNames].join(" ")));
  }
  return searchIndex.get(line.code);
}

function renderNearby() {
  const target = document.getElementById("busNearby");
  if (!userPosition) {
    target.innerHTML = `<div class="bus-empty">Attiva la posizione per vedere le fermate bus più vicine.</div>`;
    return;
  }
  const nearby = BUS_STOPS.filter(stop => stop.lat !== null && stop.lng !== null)
    .map(stop => ({ stop, meters: distance(userPosition, stop) }))
    .sort((a, b) => a.meters - b.meters).slice(0, 5);
  target.innerHTML = nearby.map(({ stop, meters }) => `<div class="bus-nearby-row"><div><strong>${escapeHTML(stop.name)}</strong><span>Linee ${stop.lines.map(escapeHTML).join(", ") || "—"}</span></div><b>${meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(1)} km`}</b></div>`).join("");
}

function renderLines(query = "") {
  const normalizedQuery = normalize(query);
  const matches = BUS_LINES.filter(line => !normalizedQuery || lineSearchText(line).includes(normalizedQuery));
  document.getElementById("busLinesCount").textContent = `${matches.length} ${matches.length === 1 ? "linea" : "linee"}`;
  document.getElementById("busLines").innerHTML = matches.map(line => `
    <button class="bus-line-card" type="button" data-line="${line.code}">
      <span class="bus-line-badge">${escapeHTML(line.code)}</span>
      <span class="bus-line-copy"><strong>${escapeHTML(line.terminals.slice(0, 2).join(" ↔ ") || `Linea ${line.code}`)}</strong><small>${line.trips.length} corse · ${escapeHTML(line.directions.join(" / "))}</small></span>
      <span class="bus-chevron">›</span>
    </button>`).join("") || `<div class="bus-empty">Nessuna linea o destinazione trovata.</div>`;
  document.querySelectorAll(".bus-line-card").forEach(button => button.addEventListener("click", () => showLine(button.dataset.line)));
}

function showLine(code, tripIndex = null, stopPosition = 0) {
  const line = BUS_LINES.find(item => item.code === code);
  if (!line) return;
  selectedLine = line;
  const representative = representativeTrips(line);
  selectedTripIndex = tripIndex ?? representative[0];
  const selectedTrip = BUS_TRIPS[selectedTripIndex];
  selectedStopPosition = Math.max(0, Math.min(stopPosition, selectedTrip.stops.length - 1));
  const selectedStopIndex = selectedTrip.stops[selectedStopPosition][0];
  const selectedStop = BUS_STOPS[selectedStopIndex];
  const departures = nextTripsAtStop(line, selectedStopIndex);
  document.getElementById("busOverview").hidden = true;
  const detail = document.getElementById("busDetail");
  detail.hidden = false;
  detail.innerHTML = `
    <button class="bus-back" type="button">← Tutte le linee</button>
    <div class="bus-detail-head"><span class="bus-line-badge large">${escapeHTML(line.code)}</span><div><div class="hsub">LINEA BUSITALIA</div><h2>Linea ${escapeHTML(line.code)}</h2><p>${escapeHTML(line.terminals.slice(0, 4).join(" · "))}</p></div></div>
    <div class="bus-direction-toggle">${representative.map(index => `<button type="button" data-trip="${index}" class="${index === selectedTripIndex ? "active" : ""}">${escapeHTML(BUS_TRIPS[index].direction || "Percorso")}</button>`).join("")}</div>
    <section class="bus-schematic-card">
      <div class="bus-schematic-scroll"><div class="bus-track" style="width:max(100%,${selectedTrip.stops.length * 88}px)">${selectedTrip.stops.map(([stopIndex, time], position) => `<button type="button" class="bus-stop-node ${position === selectedStopPosition ? "selected" : ""}" data-stop-position="${position}"><span class="bus-stop-time">${escapeHTML(time)}</span><i></i><span class="bus-stop-name">${escapeHTML(BUS_STOPS[stopIndex]?.name)}</span></button>`).join("")}</div></div>
    </section>
    <section class="bus-stop-panel">
      <div class="st-name">${escapeHTML(selectedStop.name)}</div>
      <div class="st-meta"><span class="geo-badge bus-geo">Linea ${escapeHTML(line.code)}</span><span>${escapeHTML(selectedTrip.direction)}</span><span>${selectedStopPosition + 1}/${selectedTrip.stops.length} fermate</span></div>
      <div class="dir-label bus-dir-label">PROSSIME PARTENZE · ORARIO OFFLINE</div>
      <div>${departures.map(({ trip, stop }, index) => {
        const last = trip.stops.at(-1);
        const minutes = Math.max(0, toMinutes(stop[1]) - (new Date().getHours() * 60 + new Date().getMinutes()));
        return `<div class="dep-card${index === 0 ? " first" : ""}"><div><div class="dep-time">${escapeHTML(stop[1])}</div><div class="dep-dest">→ ${escapeHTML(BUS_STOPS[last[0]]?.name)} · ${escapeHTML(trip.direction)}</div></div><div style="text-align:right;min-width:40px"><div class="dep-mins bus-mins">${minutes || "ORA"}</div><div class="dep-mins-label">${minutes ? "min" : "in fermata"}</div></div></div>`;
      }).join("") || `<div class="service-closed"><span class="service-closed-dot bus-closed-dot"></span><div><strong>Servizio terminato</strong><span>Nessun altro bus previsto oggi da questa fermata.</span></div></div>`}</div>
      <div class="footer-info"><span class="bus-live-dot">●</span> Busitalia · dati programmati disponibili offline</div>
    </section>`;
  detail.querySelector(".bus-back").addEventListener("click", showOverview);
  detail.querySelectorAll("[data-trip]").forEach(button => button.addEventListener("click", () => showLine(code, Number(button.dataset.trip), 0)));
  detail.querySelectorAll("[data-stop-position]").forEach(button => button.addEventListener("click", () => showLine(code, selectedTripIndex, Number(button.dataset.stopPosition))));
  if (tripIndex === null) document.getElementById("busView").scrollTop = 0;
}

function showOverview() {
  selectedLine = null;
  selectedTripIndex = null;
  document.getElementById("busDetail").hidden = true;
  document.getElementById("busOverview").hidden = false;
}

export function updateBusPosition(position) {
  userPosition = position;
  if (initialized && !selectedLine) renderNearby();
}

export function initBusView(position = null) {
  userPosition = position || userPosition;
  if (initialized) { if (!selectedLine) renderNearby(); return; }
  initialized = true;
  document.getElementById("busDatasetMeta").textContent = `${BUS_META.lines} linee · ${BUS_META.stops} fermate · ${BUS_META.trips} corse offline`;
  document.getElementById("busSearch").addEventListener("input", event => renderLines(event.target.value));
  renderNearby();
  renderLines();
}
