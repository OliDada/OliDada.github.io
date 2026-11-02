// Keyboard, mouse look, the touch joystick and on-screen hold buttons.
// Held keys go into `keys` (KeyboardEvent.code values); everything else is a
// callback into game.js:
//   on.map(), on.galaxy(), on.cruise(), on.help(), on.act(), on.interact(),
//   on.look(dx, dy, k), on.manualControl() (any manual input cancels assists), on.toast(text),
//   on.pick(x, y) (a tap or click on the view: select what is there), on.cycle() (Tab: next target),
//   on.upgrades() (U: the upgrade screen)
const $ = (id) => document.getElementById(id);

export function setupInput({ keys, canvas, started, mode, modalOpen, on }) {
    const toggleButtons = [...document.querySelectorAll("[data-toggle]")];
    function clearToggles() {
        for (const b of toggleButtons) {
            b.classList.remove("on");
            b.setAttribute("aria-pressed", "false");
        }
    }
    // A long press on the controls or the view must not open the system menu.
    document.addEventListener("contextmenu", (e) => {
        if (e.target.closest?.("#touchControls, #world, #hud button")) e.preventDefault();
    });
    window.addEventListener("keydown", (e) => {
        if (
            ["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(
                e.code,
            ) &&
            started() &&
            !modalOpen()
        )
            e.preventDefault();
        if (e.repeat) return;
        if (e.code === "KeyM") return on.map();
        if (e.code === "KeyG") return on.galaxy();
        if (e.code === "KeyT" && !modalOpen()) return on.cruise();
        if (e.code === "KeyH") return on.help();
        if (e.code === "KeyU") return on.upgrades?.();
        if (e.code === "KeyC" && started() && !modalOpen()) return on.clear();
        if (e.code === "Tab" && started() && !modalOpen()) {
            e.preventDefault();
            return on.cycle();
        }
        if (
            !started() ||
            modalOpen() ||
                    (["BUTTON", "A"].includes(document.activeElement?.tagName) &&
                e.code === "Space" &&
                mode() !== "walk")
        )
            return;
        if (e.code === "Space" && mode() === "walk") document.activeElement?.blur?.();
        keys.add(e.code);
        if (
            [
                "KeyW",
                "KeyS",
                "KeyA",
                "KeyD",
                "KeyR",
                "KeyF",
                "KeyX",
                "ArrowUp",
                "ArrowDown",
                "ArrowLeft",
                "ArrowRight",
            ].includes(e.code)
        )
            on.manualControl();
        if (e.code === "KeyL") {
            if (mode() !== "walk") on.act();
        }
        if (e.code === "KeyE") on.interact();
    });
    window.addEventListener("keyup", (e) => keys.delete(e.code));
    window.addEventListener("blur", () => {
        keys.clear();
        clearToggles();
        dragging = false;
    });
    document.addEventListener("visibilitychange", () => {
        keys.clear();
        clearToggles();
    });
    // Mouse look: click the view to capture the mouse, so moving it turns the camera
    // without holding a button (Esc frees the cursor). Touch keeps drag-to-look.
    let lastMouseLook = -1e9,
        lockHintShown = false,
        dragging = false,
        lastPointer = { x: 0, y: 0 };
    const mouseLocked = () => document.pointerLockElement === canvas;
    function look(dx, dy, k = 1) {
        lastMouseLook = performance.now();
        on.look(dx, dy, k);
    }
    document.addEventListener("mousemove", (e) => {
        if (mouseLocked() && !modalOpen()) look(e.movementX, e.movementY, 0.55);
    });
    document.addEventListener("pointerlockchange", () => {
        if (mouseLocked() && !lockHintShown) {
            lockHintShown = true;
            on.toast(mode() === "walk"
                ? "Mouse look on. Press Esc to free the cursor."
                : "Mouse steering on. Hold Q to look around; Esc frees the cursor.");
        }
    });
    // A short tap or click without dragging selects whatever is under it. With
    // the mouse captured, a click selects what is in the middle of the view.
    let tap = null;
    canvas.addEventListener("pointerdown", (e) => {
        if (!started() || modalOpen()) return;
        if (mouseLocked()) return void on.pick(innerWidth / 2, innerHeight / 2);
        tap = { x: e.clientX, y: e.clientY, t: performance.now(), moved: 0 };
        if (e.pointerType === "mouse" && canvas.requestPointerLock) {
            try {
                const request = canvas.requestPointerLock();
                if (request?.catch) request.catch(() => {});
            } catch {}
            if (!mouseLocked()) {
                dragging = true; // until the lock takes effect, dragging still works
                lastPointer = { x: e.clientX, y: e.clientY };
            }
            return;
        }
        dragging = true;
        lastPointer = { x: e.clientX, y: e.clientY };
        canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener("pointermove", (e) => {
            if (!dragging || mouseLocked()) return;
        const dx = e.clientX - lastPointer.x,
            dy = e.clientY - lastPointer.y;
        if (tap) tap.moved += Math.abs(dx) + Math.abs(dy);
        lastPointer = { x: e.clientX, y: e.clientY };
        look(dx, dy);
    });
    canvas.addEventListener("pointerup", (e) => {
        dragging = false;
        if (tap && tap.moved < 8 && performance.now() - tap.t < 350) on.pick(tap.x, tap.y);
        tap = null;
    });
    canvas.addEventListener("pointercancel", () => (dragging = false));
    // Touch joystick: drag the knob to fly or walk (maps onto W/A/S/D).
    const stick = $("joystick");
    if (stick) {
        const knob = stick.querySelector("i");
        let stickId = null;
        const setKey = (code, on) => (on ? keys.add(code) : keys.delete(code));
        const moveStick = (e) => {
            const r = stick.getBoundingClientRect();
            let dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2),
                dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
            const len = Math.hypot(dx, dy);
            if (len > 1) {
                dx /= len;
                dy /= len;
            }
            knob.style.transform = `translate(${dx * 50}%, ${dy * 50}%)`;
            setKey("KeyW", dy < -0.3);
            setKey("KeyS", dy > 0.3);
            setKey("KeyA", dx < -0.35);
            setKey("KeyD", dx > 0.35);
        };
        const releaseStick = () => {
            stickId = null;
            knob.style.transform = "";
            for (const code of ["KeyW", "KeyS", "KeyA", "KeyD"]) keys.delete(code);
        };
        stick.addEventListener("pointerdown", (e) => {
            e.preventDefault();
            if (modalOpen()) return;
            stickId = e.pointerId;
            stick.setPointerCapture(e.pointerId);
            on.manualControl();
            moveStick(e);
        });
        stick.addEventListener("pointermove", (e) => {
            if (e.pointerId === stickId) moveStick(e);
        });
        for (const event of ["pointerup", "pointercancel", "lostpointercapture"])
            stick.addEventListener(event, releaseStick);
    }
    for (const button of document.querySelectorAll("[data-key]")) {
        const key = button.dataset.key;
        button.addEventListener("pointerdown", (e) => {
            e.preventDefault();
            if (modalOpen()) return;
            on.manualControl();
            keys.add(key);
            button.setPointerCapture(e.pointerId);
        });
        for (const event of ["pointerup", "pointercancel", "lostpointercapture"])
            button.addEventListener(event, () => keys.delete(key));
    }
    // Touch toggles (boost, look around): tap once to switch on, again to switch off.
    for (const button of toggleButtons) {
        const key = button.dataset.toggle;
        button.setAttribute("aria-pressed", "false");
        button.addEventListener("pointerdown", (e) => {
            e.preventDefault();
            if (modalOpen()) return;
            const active = !keys.has(key);
            if (active) keys.add(key);
            else keys.delete(key);
            button.classList.toggle("on", active);
            button.setAttribute("aria-pressed", String(active));
        });
    }
    return {
        mouseLocked,
        // True while dragging to look, or within a moment of the last mouse look.
        lookingAround: (ms) => dragging || performance.now() - lastMouseLook < ms,
    };
}
