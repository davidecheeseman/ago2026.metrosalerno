import { BUS_LINES, BUS_META, BUS_STOPS, BUS_TRIPS } from "./bus-data.js";

let initialized = false, userPosition = null, selectedLine = null;
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

function nextTrips(line) {
  const now = new Date(), current = now.getHours() * 60 + now.getMinutes();
  return line.trips.map(index => BUS_TRIPS[index])
    .filter(trip => trip.stops.length && validityActive(trip.validity, now))
    .map(trip => ({ trip, departure: toMinutes(trip.stops[0][1]) }))
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

function showLine(code) {
  const line = BUS_LINES.find(item => item.code === code);
  if (!line) return;
  selectedLine = line;
  const departures = nextTrips(line);
  const directions = [...new Set(line.trips.map(index => BUS_TRIPS[index].direction).filter(Boolean))];
  const representative = directions.map(direction => line.trips.map(index => BUS_TRIPS[index]).find(trip => trip.direction === direction && trip.stops.length)).filter(Boolean);
  document.getElementById("busOverview").hidden = true;
  const detail = document.getElementById("busDetail");
  detail.hidden = false;
  detail.innerHTML = `
    <button class="bus-back" type="button">← Tutte le linee</button>
    <div class="bus-detail-head"><span class="bus-line-badge large">${escapeHTML(line.code)}</span><div><h2>Linea ${escapeHTML(line.code)}</h2><p>${escapeHTML(line.terminals.slice(0, 4).join(" · "))}</p></div></div>
    <section class="bus-section"><div class="bus-section-title"><strong>Prossime corse di oggi</strong><span>${departures.length ? "orario offline" : "nessuna corsa compatibile"}</span></div>
      <div>${departures.map(({ trip }) => {
        const first = trip.stops[0], last = trip.stops.at(-1);
        return `<div class="bus-departure"><time>${escapeHTML(first[1])}</time><div><strong>→ ${escapeHTML(BUS_STOPS[last[0]]?.name)}</strong><span>Da ${escapeHTML(BUS_STOPS[first[0]]?.name)} · ${escapeHTML(trip.validity || "validità non indicata")}</span></div></div>`;
      }).join("") || `<div class="bus-empty">Il servizio selezionato non ha altre partenze previste oggi.</div>`}</div>
    </section>
    <section class="bus-section"><div class="bus-section-title"><strong>Percorsi</strong><span>${directions.length} direzioni</span></div>
      ${representative.map(trip => `<details class="bus-route"><summary>${escapeHTML(trip.direction)} · ${trip.stops.length} fermate</summary><ol>${trip.stops.map(([stopIndex, time]) => `<li><time>${escapeHTML(time)}</time><span>${escapeHTML(BUS_STOPS[stopIndex]?.name)}</span></li>`).join("")}</ol></details>`).join("")}
    </section>`;
  detail.querySelector(".bus-back").addEventListener("click", showOverview);
  document.getElementById("busView").scrollTop = 0;
}

function showOverview() {
  selectedLine = null;
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
