/**
 * Domestic flights
 *
 * Flights from Reykjavík crossing the country at cruise height.
 *
 * Functions: buildCruise, stepCruise
 * State and constants: DESTC, CRUISE, cruiseDay
 */

/* ================= domestic flights across the country =================
   Each departure from Reykjavík climbs out locally and then crosses the island at cruise height to its destination;
   arrivals cross back and hand over to the approach. Positions follow the game clock (flight times as scheduled). */
const DESTC = {
  'Akureyri': [65.66, -18.0727, 45],
  'Egilsstaðir': [65.2833, -14.4014, 60],
  'Ísafjörður': [66.0581, -23.1353, 40],
  'Höfn': [64.2956, -15.2272, 55],
  'Bíldudalur': [65.6413, -23.5462, 45],
  'Gjögur': [65.9953, -21.3269, 50],
  'Nuuk': [64.6, -28.5, 210],
  'Kulusuk': [65.4, -27.0, 120]
};
let CRUISE = [],
  cruiseDay = -1;
function buildCruise(day) {
  CRUISE = [];
  const ap = AIRPORTS.find(a => a.rkv);
  if (!ap) return;
  const ev = rkvDay(day);
  for (const e of ev) {
    const D = DESTC[e.dest];
    if (!D) continue;
    const dst = LL(D[0], D[1]),
      dur = D[2];
    const alt = e.type === 'dhc6' ? 1800 : 3200;
    const dx = dst[0] - ap.cx,
      dy = dst[1] - ap.cy,
      L = Math.hypot(dx, dy) || 1,
      ux = dx / L,
      uy = dy / L;
    const near = [ap.cx + ux * 9000, ap.cy + uy * 9000],
      far = [dst[0] - ux * 6000, dst[1] - uy * 6000];
    if (e.arr)
      CRUISE.push({
        plane: 1,
        cruise: 1,
        t0: day * 1440 + e.t - dur + 6,
        t1: day * 1440 + e.t - 1,
        a: far,
        b: near,
        t: e.type,
        airline: e.al,
        liv: [150, 154, 160],
        alt,
        dest: e.dest,
        name: e.al + ' · flight from ' + e.dest,
        to: 'Reykjavík'
      });
    else
      CRUISE.push({
        plane: 1,
        cruise: 1,
        t0: day * 1440 + e.t + 3,
        t1: day * 1440 + e.t + dur - 6,
        a: near,
        b: far,
        t: e.type,
        airline: e.al,
        liv: [150, 154, 160],
        alt,
        dest: e.dest,
        name: e.al + ' · flight to ' + e.dest,
        to: e.dest
      });
  }
}
function stepCruise() {
  const day = Math.floor(gameMin / 1440);
  if (day !== cruiseDay) {
    cruiseDay = day;
    buildCruise(day);
  }
  for (const p of CRUISE) {
    const u = (gameMin - p.t0) / (p.t1 - p.t0);
    p.on = u >= 0 && u <= 1;
    if (!p.on) {
      p.x = undefined;
      continue;
    }
    const climb = Math.min(1, u / 0.18, (1 - u) / 0.2);
    p.x = p.a[0] + (p.b[0] - p.a[0]) * u;
    p.y = p.a[1] + (p.b[1] - p.a[1]) * u;
    p.hd = Math.atan2(p.b[1] - p.a[1], p.b[0] - p.a[0]);
    p.alt = 500 + (p.alt0 || (p.alt0 = p.alt)) * Math.max(0, climb);
    p.z = Math.max(hAt(p.x, p.y) + 300, p.alt);
    p.fly = 1;
    p.fade = u < 0.03 ? u / 0.03 - 1 : u > 0.97 ? (1 - u) / 0.03 - 1 : 0;
    p.u = u;
  }
}
