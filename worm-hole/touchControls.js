// Floating joystick. Capture touch events before OrbitControls can orbit the camera.
export function createTouchControls(surface, onStart) {
    const input = { x: 0, y: 0 };
    const radius = 48;
    let pointerId = null;
    let originX = 0;
    let originY = 0;
    const joystick = document.createElement('div');
    joystick.className = 'touch-joystick';
    joystick.setAttribute('aria-hidden', 'true');
    const thumb = document.createElement('div');
    thumb.className = 'touch-joystick-thumb';
    joystick.appendChild(thumb);
    document.body.appendChild(joystick);
    surface.style.touchAction = 'none';

    function reset() {
        const previousPointer = pointerId;
        pointerId = null;
        input.x = input.y = 0;
        joystick.classList.remove('active');
        if (previousPointer !== null && surface.hasPointerCapture(previousPointer)) {
            surface.releasePointerCapture(previousPointer);
        }
    }

    function update(event) {
        const dx = event.clientX - originX;
        const dy = event.clientY - originY;
        const distance = Math.hypot(dx, dy);
        const scale = distance > radius ? radius / distance : 1;
        const x = dx * scale;
        const y = dy * scale;
        // Match the existing keyboard's screen-relative axes.
        input.x = -x / radius;
        input.y = -y / radius;
        thumb.style.transform = `translate(${x}px, ${y}px)`;
    }

    for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel']) {
        surface.addEventListener(type, (event) => {
            if (event.pointerType !== 'touch' && event.pointerType !== 'pen') return;
            event.preventDefault();
            event.stopImmediatePropagation();
            if (type === 'pointerdown' && pointerId === null) {
                pointerId = event.pointerId;
                originX = event.clientX;
                originY = event.clientY;
                joystick.style.left = `${originX}px`;
                joystick.style.top = `${originY}px`;
                joystick.classList.add('active');
                surface.setPointerCapture(pointerId);
                onStart();
                update(event);
            } else if (event.pointerId === pointerId) {
                if (type === 'pointermove') update(event);
                else if (type === 'pointerup' || type === 'pointercancel') reset();
            }
        }, { capture: true, passive: false });
    }
    surface.addEventListener('lostpointercapture', (event) => {
        if (event.pointerId === pointerId) reset();
    });
    window.addEventListener('blur', reset);
    window.addEventListener('resize', reset);
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) reset();
    });
    return { input, reset };
}
