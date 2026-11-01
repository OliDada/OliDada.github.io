// The flight/foot HUD: mode, readouts, contextual buttons and the waypoint marker.
// g exposes the live game state through getters (see hudState in game.js).
import * as THREE from "./vendor/three.module.js";
const $ = (id) => document.getElementById(id);
const clamp = THREE.MathUtils.clamp;
const vec = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

export function updateHUD(g) {
    const { mode, autoApproach, stage, discovered, selectedBody, activeBody, system, shipPosition, playerNormal,
        speed, verticalSpeed, camera, signalNormal, worldOrigin, shipShadow } = g;
    const { surfacePoint, distanceToSignal, altitude, openMap, act, approach, positionOf } = g;
    const isWalking = mode === "walk",
        maneuvering = mode === "landing" || mode === "takeoff";
    const inSpace = mode === "space" || mode === "transit";
    const destination = positionOf(selectedBody).sub(worldOrigin);
    $("worldName").textContent = inSpace
        ? system.name.toUpperCase()
        : activeBody.name.toUpperCase();
    $("worldType").textContent = inSpace
        ? `Destination: ${selectedBody.name} · ${selectedBody.type}`
        : activeBody.type + " · " + system.name + " system";
    shipShadow.visible = !inSpace;
    $("modeLabel").textContent = inSpace
        ? mode === "transit"
            ? "CRUISE / INTERPLANETARY"
            : "FREE FLIGHT / INTERPLANETARY"
        : isWalking
          ? "SURFACE EXPEDITION"
          : mode === "landed"
            ? "LANDED / KEStREL".toUpperCase()
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
          ? stage === 2
              ? "TO SHIP"
              : "TO SIGNAL"
          : "ALTITUDE";
    $("altitude").innerHTML =
        `${Math.max(0, Math.round(inSpace ? shipPosition.distanceTo(destination) : isWalking ? (stage === 2 ? surfacePoint(playerNormal).distanceTo(shipPosition) : distanceToSignal()) : altitude()))} <small>m</small>`;
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
        mode === "landed" ? "LANDED" : isWalking ? "ON FOOT" : "KESTREL";
    $("approachBtn").hidden = mode === "walk";
    $("approachBtn").textContent = inSpace
        ? "◉ System map [M]"
        : mode === "landed"
          ? "↑ Take off [L]"
          : autoApproach
            ? "× Cancel approach"
            : "◎ Approach signal";
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
                : `Cruise to ${selectedBody.name} <kbd>T</kbd>`;
    else if (maneuvering)
        label =
            mode === "landing"
                ? "Settling onto surface…"
                : "Lift engines engaged…";
    else if (mode === "landed") label = "Leave ship <kbd>E</kbd>";
    else if (isWalking) {
        const nearShip =
            surfacePoint(playerNormal).distanceTo(shipPosition) < 9;
        label = nearShip
            ? "Board Kestrel <kbd>E</kbd>"
            : distanceToSignal() < 9
              ? "Investigate <kbd>E</kbd>"
              : "Follow the marker <kbd>E</kbd>";
    } else
        label =
            altitude() > 32
                ? "Descend to land <kbd>L</kbd>"
                : Math.abs(speed) > 18
                  ? "Slow to land <kbd>L</kbd>"
                  : `Land on ${activeBody.name} <kbd>L</kbd>`;
    $("actionBtn").innerHTML = label;
        $("crosshair").style.display = isWalking ? "block" : "none";
    document.body.classList.toggle("walking", isWalking);
    $("controlHint").innerHTML = isWalking
        ? "<kbd>W A S D</kbd> walk <kbd>SPACE</kbd> jump <kbd>E</kbd> interact <span>Click: mouse look · M map · H controls</span>"
        : "<kbd>W S</kbd> thrust <kbd>A D</kbd> steer <kbd>R F</kbd> lift <kbd>↑ ↓</kbd> pitch <kbd>SHIFT</kbd> boost <span>Click: mouse look · M map · H controls</span>";
    const target = inSpace
        ? destination
        : stage === 2
          ? shipPosition.clone()
          : surfacePoint(signalNormal, 9);
    const projected = target.clone().project(camera);
    const ahead =
        target
            .clone()
            .sub(camera.position)
            .dot(camera.getWorldDirection(vec())) > 0;
    const x = clamp(
        (projected.x * 0.5 + 0.5) * innerWidth,
        55,
        innerWidth - 55,
    );
    const y = clamp(
        (-projected.y * 0.5 + 0.5) * innerHeight,
        100,
        innerHeight - 200,
    );
    $("waypoint").style.left = `${ahead ? x : innerWidth / 2}px`;
    $("waypoint").style.top = `${ahead ? y : innerHeight - 210}px`;
    $("waypointLabel").textContent =
        (ahead ? "" : "↶ ") +
        (inSpace
            ? selectedBody.name.toUpperCase()
            : stage === 2
              ? "KESTREL"
              : discovered
                ? "SIGNAL RECORDED"
                : "UNKNOWN SIGNAL");
    const origin = isWalking ? surfacePoint(playerNormal) : shipPosition;
    $("waypointDistance").textContent =
        `${Math.round(origin.distanceTo(target))} m${ahead ? "" : " · behind you"}`;
}
