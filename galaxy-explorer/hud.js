// The flight/foot HUD: mode, readouts, contextual buttons and the waypoint marker.
// g exposes the live game state through getters (see hudState in game.js).
import * as THREE from "./vendor/three.module.js";
const $ = (id) => document.getElementById(id);
const clamp = THREE.MathUtils.clamp;
const vec = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

// Light years for display: AU when close, so arrival distances stay readable.
const fmtLy = (ly) => (ly < 0.05 ? `${Math.max(1, Math.round(ly * 63241))} <small>AU</small>` : `${ly < 10 ? ly.toFixed(2) : ly.toFixed(1)} <small>ly</small>`);
const fmtC = (c) => (c >= 1e6 ? `${(c / 1e6).toFixed(1)}M` : c >= 1e3 ? `${(c / 1e3).toFixed(1)}k` : c.toFixed(0));

function updateDeepHUD(g) {
    const info = g.deep;
    g.shipShadow.visible = false;
    $("worldName").textContent = "DEEP SPACE";
    $("worldType").textContent = info
        ? info.isCourse
            ? `Course: ${info.name} · nearest star ${info.nearestName}`
            : `Nearest star: ${info.name}`
        : "Between the stars";
    $("modeLabel").textContent = info?.autopilot ? "STAR DRIVE / AUTOPILOT" : "STAR DRIVE / INTERSTELLAR";
    $("altLabel").textContent = info?.isCourse ? "TO DESTINATION" : "TO NEAREST STAR";
    $("altitude").innerHTML = info ? fmtLy(info.distance) : "–";
    $("speed").innerHTML = `${info ? fmtC(info.lightSpeeds) : 0} <small>× light</small>`;
    $("verticalReadout").hidden = true;
    $("vesselStatus").textContent = (g.shipName || "Kestrel").toUpperCase();
    $("actionBtn").disabled = false;
    $("approachBtn").disabled = false;
    $("approachBtn").hidden = false;
    $("approachBtn").textContent = "✦ Galaxy map [G]";
    $("approachBtn").onclick = g.openGalaxy;
    if (info?.isCourse) {
        $("approachBtn").textContent = "× Clear course [C]";
        $("approachBtn").onclick = g.clearTarget;
    }
    $("actionBtn").innerHTML = !info?.isCourse
        ? "Set a course <kbd>G</kbd>"
        : info.autopilot
          ? "Autopilot off <kbd>T</kbd>"
          : `Autopilot to ${info.name} <kbd>T</kbd>`;
    $("crosshair").style.display = "none";
    document.body.classList.remove("walking");
    $("controlHint").innerHTML =
        "<kbd>MOUSE</kbd> steer <kbd>W S</kbd> throttle <kbd>A D</kbd> turn <kbd>SHIFT</kbd> boost <kbd>T</kbd> autopilot <span>Q look around · G galaxy map · H controls</span>";
}

const fmtM = (m) => (m >= 10000 ? `${(m / 1000).toFixed(1)} <small>km</small>` : `${Math.round(m)} <small>m</small>`);

export function updateHUD(g) {
    if (g.mode === "deep") return updateDeepHUD(g);
    updateMainHUD(g);
    // A star as your course (and no world in focus): the HUD is about that star.
    const course = g.deep, inSpace = g.mode === "space" || g.mode === "transit";
    if (inSpace && (course || g.target || g.selectedBody)) {
        $("approachBtn").textContent = "× Clear target [C]";
        $("approachBtn").onclick = g.clearTarget;
    }
    if (inSpace && course) {
        $("worldType").textContent = `Course: ${course.name} · ${fmtLy(course.distance).replace(/<\/?small>/g, "")}`;
        $("altLabel").textContent = "TO COURSE STAR";
        $("altitude").innerHTML = fmtLy(course.distance);
        if (g.mode === "space")
            $("actionBtn").innerHTML = course.autopilot ? "Autopilot off <kbd>T</kbd>" : `Autopilot to ${course.name} <kbd>T</kbd>`;
    }
}
function updateMainHUD(g) {
    const { mode, autoApproach, stage, discovered, selectedBody, activeBody, system, shipPosition, playerNormal,
        speed, verticalSpeed, camera, signalNormal, worldOrigin, shipShadow } = g;
    const { surfacePoint, distanceToSignal, altitude, openMap, act, approach, positionOf } = g;
    const isWalking = mode === "walk",
        maneuvering = mode === "landing" || mode === "takeoff",
        diving = mode === "dive", swimming = !!g.swimming;
    const inSpace = mode === "space" || mode === "transit";
    const destination = selectedBody ? positionOf(selectedBody).sub(worldOrigin) : null;
    $("worldName").textContent = inSpace
        ? system.name.toUpperCase()
        : activeBody.name.toUpperCase();
    $("worldType").textContent = inSpace
        ? selectedBody
            ? `Destination: ${selectedBody.name} · ${selectedBody.type}`
            : "No destination · Tab or tap a world to choose one"
        : activeBody.type + " · " + system.name + " system";
    shipShadow.visible = !inSpace && !diving;
    $("modeLabel").textContent = inSpace
        ? mode === "transit"
            ? "CRUISE / INTERPLANETARY"
            : "FREE FLIGHT / INTERPLANETARY"
        : isWalking
          ? swimming ? "SWIMMING / DIVE SUIT" : "SURFACE EXPEDITION"
          : diving
            ? "SUBMERGED / PETREL"
            : mode === "landed"
            ? `LANDED / ${g.shipName || "Kestrel"}`.toUpperCase()
            : maneuvering
              ? mode === "landing"
                  ? "LANDING / GEAR DOWN"
                  : "TAKEOFF / VERTICAL LIFT"
              : autoApproach
                ? "APPROACH ASSIST"
                : "ORBITAL FLIGHT";
    $("altLabel").textContent = inSpace
        ? "TO DESTINATION"
        : isWalking
          ? swimming ? "DEPTH · TO SHIP " + fmtM(g.playerPos().distanceTo(shipPosition)).replace(/<\/?small>/g, "") : "TO SHIP"
          : diving
            ? "DEPTH"
            : mode === "flight" && altitude() > 200
            ? "ALTITUDE · ORBIT AT 600 M"
            : "ALTITUDE";
    $("altitude").innerHTML =
        inSpace && !selectedBody ? "–" : fmtM(Math.max(0, inSpace ? shipPosition.distanceTo(destination) - selectedBody.radius : diving || swimming ? g.depth : isWalking ? g.playerPos().distanceTo(shipPosition) : altitude()));
    $("speed").innerHTML =
        `${(isWalking ? Math.abs(speed) : Math.hypot(speed, verticalSpeed)).toFixed(0)} <small>m/s</small>`;
    const displayedVertical =
        Math.abs(verticalSpeed) < 0.05 ? 0 : verticalSpeed;
    $("verticalSpeed").innerHTML =
        `${displayedVertical >= 0 ? "+" : ""}${displayedVertical.toFixed(1)} <small>m/s</small>`;
    $("verticalReadout").hidden = isWalking;
    $("actionBtn").disabled = maneuvering;
    $("approachBtn").disabled = maneuvering;
    $("vesselStatus").textContent =
        mode === "landed" ? "LANDED" : swimming ? "SWIMMING" : isWalking ? "ON FOOT" : diving ? "PETREL · SUBMERGED" : (g.shipName || "Kestrel").toUpperCase();
    $("approachBtn").hidden = mode === "walk" || diving;
    $("approachBtn").textContent = inSpace
        ? "◉ System map [M]"
        : mode === "landed"
          ? "↑ Take off [L]"
          : autoApproach
            ? "× Cancel approach"
            : "◎ Find landing site";
    $("approachBtn").onclick = inSpace
        ? openMap
        : mode === "landed"
          ? act
          : approach;
    let label;
    if (inSpace)
        label =
            mode === "transit"
                ? "Disengage cruise <kbd>T</kbd>"
                : selectedBody
                  ? `Cruise to ${selectedBody.name} <kbd>T</kbd>`
                  : "Choose a destination <kbd>Tab</kbd>";
    else if (maneuvering)
        label =
            mode === "landing"
                ? "Settling onto surface…"
                : "Lift engines engaged…";
    else if (mode === "landed") label = "Leave ship <kbd>E</kbd>";
    else if (diving) label = g.scanLabel ? `${g.scanLabel} <kbd>E</kbd>` : g.canSwim ? "Swim out <kbd>E</kbd>" : "";
    else if (isWalking) {
        const nearShip =
            g.playerPos().distanceTo(shipPosition) < 9;
        label = distanceToSignal() < 9 && !g.discovered
            ? "Investigate <kbd>E</kbd>"
            : g.scanLabel
              ? `${g.scanLabel} <kbd>E</kbd>`
              : nearShip
                ? `Board the ${g.shipName || "Kestrel"} <kbd>E</kbd>`
                : distanceToSignal() < 9
                  ? "Investigate <kbd>E</kbd>"
                  : ""; // nothing to do here: no button (the waypoint shows the way)
    } else
        label =
            altitude() > 32
                ? "Descend to land <kbd>L</kbd>"
                : Math.abs(speed) > 18
                  ? "Slow to land <kbd>L</kbd>"
                  : `Land on ${activeBody.name} <kbd>L</kbd>`;
    $("actionBtn").innerHTML = label;
    $("actionBtn").hidden = !label;
        $("crosshair").style.display = isWalking || diving ? "block" : "none";
    document.body.classList.toggle("walking", isWalking);
    document.body.classList.toggle("swimming", swimming); // touch: rise and sink buttons while swimming
    $("controlHint").innerHTML = swimming
        ? "<kbd>W A S D</kbd> swim where you look <kbd>SPACE R</kbd> rise <kbd>F</kbd> sink <kbd>E</kbd> scan / board <span>Click: mouse look · M map · H controls</span>"
        : diving
          ? "<kbd>MOUSE</kbd> steer <kbd>W S</kbd> throttle <kbd>A D</kbd> turn <kbd>R F</kbd> rise / sink <kbd>X</kbd> stop <kbd>E</kbd> scan / swim out <span>Hold R at the surface to fly · H controls</span>"
          : isWalking
        ? "<kbd>W A S D</kbd> walk <kbd>SPACE</kbd> jump <kbd>E</kbd> scan / interact <span>Click: mouse look · M map · H controls</span>"
        : inSpace
          ? "<kbd>MOUSE</kbd> steer <kbd>W S</kbd> thrust <kbd>A D</kbd> slide <kbd>R F</kbd> up / down <kbd>SHIFT</kbd> boost <kbd>X</kbd> brake <span>Click to steer · Q look around · H controls</span>"
          : "<kbd>MOUSE</kbd> steer <kbd>W S</kbd> thrust <kbd>A D</kbd> turn <kbd>R F</kbd> lift <kbd>SHIFT</kbd> boost <kbd>X</kbd> brake <span>Click to steer · Q look around · H controls</span>";
    // At a station (game.js stationHUD): its own readouts over the usual ones.
    const st = g.station;
    if (st) {
        if (st.modeLabel) $("modeLabel").textContent = st.modeLabel;
        if (st.status) $("vesselStatus").textContent = st.status;
        if (st.altLabel) $("altLabel").textContent = st.altLabel;
        if (st.altitude != null) $("altitude").innerHTML = fmtM(st.altitude);
        if (st.action !== undefined) { $("actionBtn").innerHTML = st.action; $("actionBtn").hidden = !st.action; $("actionBtn").disabled = !!st.busy; }
        if (st.approach !== undefined) {
            $("approachBtn").hidden = !st.approach;
            if (st.approach) { $("approachBtn").textContent = st.approach.text; $("approachBtn").onclick = st.approach.onclick; }
        }
        if (st.hint) $("controlHint").innerHTML = st.hint;
        if (st.walking) { document.body.classList.add("walking"); $("crosshair").style.display = "block"; $("verticalReadout").hidden = true; $("speed").innerHTML = `${Math.abs(speed).toFixed(0)} <small>m/s</small>`; }
        if (!st.open) shipShadow.visible = false;
    }
}

// The waypoint marker, updated every frame so it moves smoothly with the view.
// Space: the destination world. Deep space: your course or the nearest star.
// On foot: your ship. Hidden while flying near a world and on the ground.
const shown = { text: "", dist: "", visible: null };
function setText(id, key, value) {
    if (shown[key] !== value) $(id).textContent = shown[key] = value;
}
export function updateWaypoint(g) {
    const { mode, camera } = g;
    let point = null, name = "", distance = "";
    if (mode === "deep") {
        const info = g.deep;
        if (info) {
            point = info.point;
            name = info.name.toUpperCase();
            distance = fmtLy(info.distance).replace(/<\/?small>/g, "");
        }
    } else if ((mode === "space" || mode === "transit") && g.deep) {
        // Course star from inside a system: the way out to it.
        point = g.deep.point;
        name = g.deep.name.toUpperCase();
        distance = fmtLy(g.deep.distance).replace(/<\/?small>/g, "");
    } else if ((mode === "space" || mode === "transit") && g.selectedBody) {
        point = g.positionOf(g.selectedBody).sub(g.worldOrigin);
        name = g.selectedBody.name.toUpperCase();
        distance = fmtM(Math.max(0, g.shipPosition.distanceTo(point) - g.selectedBody.radius)).replace(/<\/?small>/g, "");
    } else if (g.stationMark) {
        const m = g.stationMark;
        point = m.point;
        name = m.name;
        distance = fmtM(m.distance).replace(/<\/?small>/g, "");
    } else if (mode === "walk") {
        point = g.shipPosition.clone();
        name = (g.shipName || "Kestrel").toUpperCase();
        distance = fmtM(g.playerPos().distanceTo(point)).replace(/<\/?small>/g, "");
    }
    const el = $("waypoint");
    const visible = !!point;
    if (shown.visible !== visible) el.style.display = (shown.visible = visible) ? "" : "none";
    if (!point) return;
    const projected = point.clone().project(camera);
    const ahead = point.clone().sub(camera.position).dot(camera.getWorldDirection(vec())) > 0;
    const x = ahead ? clamp((projected.x * 0.5 + 0.5) * innerWidth, 55, innerWidth - 55) : innerWidth / 2;
    const y = ahead ? clamp((-projected.y * 0.5 + 0.5) * innerHeight, 100, innerHeight - 200) : innerHeight - 210;
    el.style.left = "0px";
    el.style.top = "0px";
    el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -50%)`;
    setText("waypointLabel", "text", (ahead ? "" : "↶ ") + name);
    setText("waypointDistance", "dist", distance + (ahead ? "" : " · behind you"));
}
