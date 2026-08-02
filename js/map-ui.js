import { ST, DU } from "./data.js";
import { BUS_LINES, BUS_STOPS, BUS_TRIPS } from "./bus-data.js";

const STORAGE_KEY = "metro-salerno:map-route";
const escapeHTML = value => String(value ?? "").replace(/[&<>"']/g, char => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
})[char]);

let map;
let networkLayer;
let userMarker;
let selectedStationIndex = 0;
let selectedRoute = "metro";
let stationMarkers = [];
let onSelectStation = () => {};

function stationIcon(station, selected, duomo = false) {
  let className = "sm";
  if (station.term) className += " term";
  if (selected) className += " sel";
  if (duomo) className += " duo";
  const size = station.term ? 24 : duomo ? 16 : 20;
  return L.divIcon({ className, iconSize: [size, size], iconAnchor: [size / 2, size / 2] });
}

function renderMetro() {
  const points = ST.map(station => [station.lat, station.lng]);
  const bounds = [...points, [DU.lat, DU.lng]];
  L.polyline(points, { color: "#E63946", weight: 12, opacity: 0.15, lineCap: "round" }).addTo(networkLayer);
  L.polyline(points, { color: "#E63946", weight: 5, opacity: 0.92, lineCap: "round" }).addTo(networkLayer);
  L.polyline([[ST[0].lat, ST[0].lng], [DU.lat, DU.lng]], { color: "#34d399", weight: 3, opacity: 0.55, dashArray: "6,6", lineCap: "round" }).addTo(networkLayer);

  ST.forEach((station, index) => {
    const marker = L.marker([station.lat, station.lng], { icon: stationIcon(station, index === selectedStationIndex) })
      .addTo(networkLayer)
      .on("click", () => onSelectStation(index));
    stationMarkers.push({ marker, station, index, duomo: false });
    L.marker([station.lat, station.lng], {
      icon: L.divIcon({ className: `slbl${index === selectedStationIndex ? "" : " d"}`, html: station.name, iconSize: [120, 16], iconAnchor: [60, -12] }),
      interactive: false,
    }).addTo(networkLayer);
  });

  const duomoMarker = L.marker([DU.lat, DU.lng], { icon: stationIcon(DU, selectedStationIndex === -1, true) })
    .addTo(networkLayer)
    .on("click", () => onSelectStation(-1));
  stationMarkers.push({ marker: duomoMarker, station: DU, index: -1, duomo: true });
  L.marker([DU.lat, DU.lng], {
    icon: L.divIcon({ className: "slbl d", html: DU.name, iconSize: [140, 16], iconAnchor: [70, -10] }),
    interactive: false,
  }).addTo(networkLayer);
  map.fitBounds(bounds, { padding: [45, 45] });
}

function representativeTrips(line) {
  const byDirection = new Map();
  line.trips.forEach(index => {
    const trip = BUS_TRIPS[index];
    const current = byDirection.get(trip.direction);
    if (current === undefined || trip.stops.length > BUS_TRIPS[current].stops.length) byDirection.set(trip.direction, index);
  });
  return [...byDirection.values()].map(index => BUS_TRIPS[index]);
}

function renderBus(line) {
  const bounds = [];
  const shownStops = new Set();
  representativeTrips(line).forEach((trip, directionIndex) => {
    const stops = trip.stops
      .map(([stopIndex]) => ({ stopIndex, stop: BUS_STOPS[stopIndex] }))
      .filter(({ stop }) => Number.isFinite(stop?.lat) && Number.isFinite(stop?.lng));
    const points = stops.map(({ stop }) => [stop.lat, stop.lng]);
    if (points.length > 1) {
      L.polyline(points, { color: "#f59e0b", weight: 11, opacity: 0.13, lineCap: "round" }).addTo(networkLayer);
      L.polyline(points, { color: directionIndex ? "#fbbf24" : "#f59e0b", weight: 4, opacity: 0.9, lineCap: "round" }).addTo(networkLayer);
    }
    stops.forEach(({ stopIndex, stop }) => {
      bounds.push([stop.lat, stop.lng]);
      if (shownStops.has(stopIndex)) return;
      shownStops.add(stopIndex);
      const otherLines = stop.lines.filter(code => code !== line.code);
      const details = otherLines.length ? ` · anche ${otherLines.join(", ")}` : "";
      L.marker([stop.lat, stop.lng], {
        icon: L.divIcon({ className: "bus-map-marker", html: `<span>${escapeHTML(line.code)}</span>`, iconSize: [24, 24], iconAnchor: [12, 12] }),
      }).bindPopup(`<strong>${escapeHTML(stop.name)}</strong><br><small>Linea ${escapeHTML(line.code)}${escapeHTML(details)}</small>`).addTo(networkLayer);
    });
  });
  if (bounds.length) map.fitBounds(bounds, { padding: [55, 55], maxZoom: 16 });
}

function renderRoute(route) {
  stationMarkers = [];
  networkLayer.clearLayers();
  const line = BUS_LINES.find(item => item.code === route);
  if (line) {
    selectedRoute = line.code;
    renderBus(line);
    document.getElementById("mapRouteLabel").textContent = `Bus ${line.code}`;
  } else {
    selectedRoute = "metro";
    renderMetro();
    document.getElementById("mapRouteLabel").textContent = "Metropolitana";
  }
  localStorage.setItem(STORAGE_KEY, selectedRoute);
  document.querySelectorAll("[data-map-route]").forEach(button => button.classList.toggle("selected", button.dataset.mapRoute === selectedRoute));
}

function renderChoices(query = "") {
  const normalized = query.trim().toLowerCase();
  const lines = BUS_LINES.filter(line => !normalized || line.code.includes(normalized) || line.terminals.join(" ").toLowerCase().includes(normalized));
  const target = document.getElementById("mapRouteChoices");
  target.innerHTML = `<button type="button" data-map-route="metro" class="map-route-choice"><span class="map-route-symbol metro-symbol">M</span><div><strong>Metropolitana</strong><small>Salerno FS ↔ Stadio Arechi</small></div></button>`
    + lines.map(line => `<button type="button" data-map-route="${escapeHTML(line.code)}" class="map-route-choice"><span class="map-route-symbol bus-symbol">${escapeHTML(line.code)}</span><div><strong>Linea bus ${escapeHTML(line.code)}</strong><small>${escapeHTML(line.terminals.slice(0, 3).join(" · "))}</small></div></button>`).join("");
  target.querySelectorAll("[data-map-route]").forEach(button => button.addEventListener("click", () => {
    renderRoute(button.dataset.mapRoute);
    document.getElementById("mapRouteSheet").classList.remove("open");
    document.getElementById("mapRouteButton").setAttribute("aria-expanded", "false");
  }));
  target.querySelectorAll("[data-map-route]").forEach(button => button.classList.toggle("selected", button.dataset.mapRoute === selectedRoute));
}

function initSelector() {
  renderChoices();
  const button = document.getElementById("mapRouteButton");
  const sheet = document.getElementById("mapRouteSheet");
  button.addEventListener("click", () => {
    const open = sheet.classList.toggle("open");
    button.setAttribute("aria-expanded", String(open));
    if (open) document.getElementById("mapRouteSearch").focus();
  });
  document.getElementById("mapRouteSearch").addEventListener("input", event => renderChoices(event.target.value));
}

export function initNetworkMap({ stationIndex = 0, selectStation } = {}) {
  selectedStationIndex = stationIndex;
  if (selectStation) onSelectStation = selectStation;
  if (map) return;
  map = L.map("map", { center: [40.667, 14.800], zoom: 14, zoomControl: false, attributionControl: false });
  L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", { maxZoom: 19, subdomains: "abcd" }).addTo(map);
  networkLayer = L.layerGroup().addTo(map);
  initSelector();
  renderRoute(localStorage.getItem(STORAGE_KEY) || "metro");
}

export function refreshNetworkMap() {
  if (map) map.invalidateSize();
}

export function focusMetroStation(index) {
  selectedStationIndex = index;
  if (!map || selectedRoute !== "metro") return;
  stationMarkers.forEach(({ marker, station, index: markerIndex, duomo }) => {
    marker.setIcon(stationIcon(station, markerIndex === selectedStationIndex, duomo));
  });
  const station = index === -1 ? DU : ST[index];
  map.flyTo([station.lat, station.lng], 15, { duration: 0.6 });
}

export function showUserOnNetworkMap({ lat, lng }) {
  if (!map) return;
  if (userMarker) map.removeLayer(userMarker);
  userMarker = L.marker([lat, lng], {
    icon: L.divIcon({ className: "", html: '<div class="um"><div class="umr"></div></div>', iconSize: [16, 16], iconAnchor: [8, 8] }),
    zIndexOffset: 1000,
  }).addTo(map);
}
