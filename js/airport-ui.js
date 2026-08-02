import { AIRPORT, AIRPORT_FLIGHTS } from "./airport-data.js";
import { BUS_LINES, BUS_STOPS, BUS_TRIPS } from "./bus-data.js";
import { validityActive } from "./bus-ui.js";

let initialized = false, flightMode = "departures";
const escapeHTML = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
const statusLabels = { J:"Atterrato",T:"Atterrato",W:"Atterrato",X:"Cancellato",Z:"Imbarcato",B:"Imbarco",K:"Imbarco cancellato",L:"In chiusura",D:"In ritardo",S:"In ritardo",C:"Partito" };

function terminalStatus() {
  const now = new Date(), minutes = now.getHours() * 60 + now.getMinutes();
  const [openH, openM] = AIRPORT.opens.split(":").map(Number), [closeH, closeM] = AIRPORT.closes.split(":").map(Number);
  const open = minutes >= openH * 60 + openM && minutes <= closeH * 60 + closeM;
  return { open, label: open ? `Orario ordinario · terminal aperto fino alle ${AIRPORT.closes}` : `Orario ordinario · terminal chiuso fino alle ${AIRPORT.opens}` };
}

function renderTerminalStatus() {
  const status = terminalStatus();
  const element = document.getElementById("airportStatus");
  element.classList.toggle("closed", !status.open);
  element.innerHTML = `<i></i><span>${status.label}</span>`;
}

function renderFlights() {
  const flights = AIRPORT_FLIGHTS[flightMode] || [];
  const target = document.getElementById("airportFlights");
  target.innerHTML = flights.map(flight => {
    const status = statusLabels[flight.status] || "Programmato";
    const actual = flight.actualTime && flight.actualTime !== flight.scheduledTime ? `<span class="airport-actual">${escapeHTML(flight.actualTime)}</span>` : "";
    return `<div class="airport-flight-card"><div class="airport-flight-time"><time>${escapeHTML(flight.scheduledTime)}</time>${actual}</div><div class="airport-flight-main"><strong>${escapeHTML(flight.airport)}</strong><span>${escapeHTML(flight.airportCode)} · ${escapeHTML(flight.flight)} · ${escapeHTML(flight.carrier)}</span></div><div class="airport-flight-status ${flight.status==='X'?'alert':''}">${escapeHTML(status)}${flight.delay?`<small>${flight.delay} min</small>`:''}</div></div>`;
  }).join("") || `<div class="bus-empty">Nessun volo presente nello snapshot corrente.</div>`;
  document.querySelectorAll("[data-flight-mode]").forEach(button => button.classList.toggle("active", button.dataset.flightMode === flightMode));
  document.getElementById("airportLiveLink").href = AIRPORT_FLIGHTS.source[flightMode];
  document.getElementById("airportLiveLink").textContent = flightMode === "departures" ? "Apri partenze live GESAC" : "Apri arrivi live GESAC";
}

function airportBuses() {
  const line = BUS_LINES.find(item => item.code === "008");
  if (!line) return [];
  const now = new Date(), current = now.getHours() * 60 + now.getMinutes();
  return line.trips.map(index => BUS_TRIPS[index]).filter(trip => validityActive(trip.validity, now)).map(trip => {
    const airportStop = trip.stops.find(([stopIndex]) => normalizeStop(BUS_STOPS[stopIndex]?.name).includes("aeroporto"));
    if (!airportStop) return null;
    const [hours, minutes] = airportStop[1].split(":").map(Number);
    const last = trip.stops.at(-1);
    return { time: airportStop[1], minute: hours * 60 + minutes, destination: BUS_STOPS[last[0]]?.name, direction: trip.direction };
  }).filter(item => item && item.minute >= current).sort((a,b)=>a.minute-b.minute).slice(0,6);
}

const normalizeStop = value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

function renderAirportBuses() {
  const buses = airportBuses(), now = new Date(), current = now.getHours()*60+now.getMinutes();
  document.getElementById("airportBuses").innerHTML = buses.map((bus,index)=>`<div class="dep-card${index===0?' first':''}"><div><div class="dep-time">${escapeHTML(bus.time)}</div><div class="dep-dest">Linea 008 → ${escapeHTML(bus.destination)}</div></div><div style="text-align:right"><div class="dep-mins airport-mins">${Math.max(0,bus.minute-current)||'ORA'}</div><div class="dep-mins-label">${bus.minute-current>0?'min':'in fermata'}</div></div></div>`).join("") || `<div class="service-closed"><span class="service-closed-dot airport-dot"></span><div><strong>Nessun’altra corsa</strong><span>Non risultano altre partenze della linea 008 oggi.</span></div></div>`;
}

export function initAirportView() {
  renderTerminalStatus();
  if (initialized) { renderFlights(); renderAirportBuses(); return; }
  initialized = true;
  const snapshotDate = new Date(AIRPORT_FLIGHTS.fetchedAt);
  document.getElementById("airportSnapshot").textContent = `Snapshot GESAC aggiornato ${snapshotDate.toLocaleDateString('it-IT')} alle ${snapshotDate.toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'})}`;
  document.querySelectorAll("[data-flight-mode]").forEach(button => button.addEventListener("click",()=>{flightMode=button.dataset.flightMode;renderFlights()}));
  document.getElementById("airportMapLink").href = `https://www.google.com/maps/search/?api=1&query=${AIRPORT.lat},${AIRPORT.lng}`;
  renderFlights();
  renderAirportBuses();
}
