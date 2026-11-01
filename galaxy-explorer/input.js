// Keyboard, mouse look, the touch joystick and on-screen hold buttons.
// Held keys go into `keys` (KeyboardEvent.code values); everything else is a
// callback into game.js:
//   on.map(), on.galaxy(), on.cruise(), on.help(), on.act(), on.interact(),
//   on.look(dx, dy, k), on.manualControl() (any manual input cancels assists), on.toast(text)
const $ = (id) => document.getElementById(id);

export function setupInput({ keys, canvas, started, mode, modalOpen, on }) {
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
        dragging = false;
    });
    document.addEventListener("visibilitychange", () => keys.clear());
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
            on.toast("Mouse look on. Press Esc to free the cursor.");
        }
    });
    canvas.addEventListener("pointerdown", (e) => {
        if (!started() || modalOpen()) return;
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
        lastPointer = { x: e.clientX, y: e.clientY };
        look(dx, dy);
    });
    canvas.addEventListener("pointerup", () => (dragging = false));
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
    return {
        mouseLocked,
        // True while dragging to look, or within a moment of the last mouse look.
        lookingAround: (ms) => dragging || performance.now() - lastMouseLook < ms,
    };
}
