import { CUM, TOT } from "./data.js";
import { OFFLINE_TIMETABLE } from "./offline-timetable.js";

const METRO_STATIONS = ["SA", "TO", "PA", "ME", "AR", "ST"];
const toMinutes = time => {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
};

function daySchedule(stationId, weekday = new Date().getDay()) {
  return OFFLINE_TIMETABLE[stationId]?.[weekday] || [];
}

function directionOf(departure) {
  const destination = departure.destination.toUpperCase();
  if (destination.includes("ARECHI")) return "arechi";
  if (destination === "SALERNO" || destination.includes("SALERNO CENTRALE")) return "salerno";
  return null;
}

export function metroDeps(stationIndex, currentMinutes, _holiday, weekday = new Date().getDay()) {
  const stationId = METRO_STATIONS[stationIndex];
  return daySchedule(stationId, weekday)
    .map(departure => ({ ...departure, dir: directionOf(departure), minute: toMinutes(departure.time) }))
    .filter(departure => departure.dir && departure.minute >= currentMinutes)
    .map(departure => ({
      time: departure.time,
      train: departure.train,
      dest: departure.dir === "arechi" ? "→ Arechi" : "→ Salerno FS",
      dir: departure.dir,
      mins: Math.max(0, Math.round(departure.minute - currentMinutes)),
    }))
    .sort((a, b) => a.mins - b.mins);
}

export function duomoDeps(currentMinutes, weekday = new Date().getDay()) {
  return daySchedule("DV", weekday)
    .map(departure => ({ ...departure, minute: toMinutes(departure.time) }))
    .filter(departure => departure.minute >= currentMinutes)
    .map(departure => ({
      time: departure.time,
      train: departure.train,
      dest: `→ ${departure.destination}`,
      mins: Math.max(0, Math.round(departure.minute - currentMinutes)),
    }));
}

export function findLatestConnection(fromIndex, toIndex, arrivalDeadline, weekday) {
  const from = daySchedule(METRO_STATIONS[fromIndex], weekday);
  const to = daySchedule(METRO_STATIONS[toIndex], weekday);
  const destination = toIndex > fromIndex ? "arechi" : "salerno";
  const arrivalsByTrain = new Map(to.filter(item => directionOf(item) === destination).map(item => [item.train, item]));
  let best = null;
  for (const departure of from) {
    if (directionOf(departure) !== destination) continue;
    const arrival = arrivalsByTrain.get(departure.train);
    const da = toMinutes(departure.time);
    // Terminal stations do not expose a subsequent departure for the same
    // train. In that case use the line's published segment travel time.
    const aa = arrival ? toMinutes(arrival.time) : da + Math.abs(CUM[toIndex] - CUM[fromIndex]);
    if (aa <= arrivalDeadline && (!best || aa > best.aa)) best = { da, aa, train: departure.train };
  }
  return best;
}

export function activeTrains(currentMinutes, _holiday, weekday = new Date().getDay()) {
  const trains = [];
  for (const [stationId, direction] of [["SA", "arechi"], ["ST", "salerno"]]) {
    for (const departure of daySchedule(stationId, weekday)) {
      if (directionOf(departure) !== direction) continue;
      const elapsed = currentMinutes - toMinutes(departure.time);
      if (elapsed < 0 || elapsed > TOT + 1) continue;
      const covered = Math.max(0, Math.min(elapsed, TOT));
      trains.push({
        frac: direction === "arechi" ? covered / TOT : 1 - covered / TOT,
        dir: direction,
        at: elapsed <= 0.5 || elapsed >= TOT - 0.5,
        id: departure.train,
      });
    }
  }
  return trains;
}

export function hav(a1, o1, a2, o2) {
  const R = 6371000, radians = degrees => degrees * Math.PI / 180;
  const latitude = radians(a2 - a1), longitude = radians(o2 - o1);
  const value = Math.sin(latitude / 2) ** 2 + Math.cos(radians(a1)) * Math.cos(radians(a2)) * Math.sin(longitude / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}
