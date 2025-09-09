import globalStateManager from "../state/globalState.js";

export function generatePrisonDoorComponents(k, pos, contents, isOpen = false) {
    return [
        k.sprite('sprites', {
            anim: isOpen ? 'prison-door-opened' : 'prison-door-closed',
        }),
        k.area({ shape: new k.Rect(k.vec2(1, 0), 14, 10) }),
        k.body({ isStatic: true }),
        k.pos(pos),
        k.offscreen(),
        'prison-door',
        { isOpen },
    ];
}

// When prison door is opened:
export function openPrisonDoor(door) {
    const key = `${Math.round(door.pos.x)},${Math.round(door.pos.y)}`;
    const gameState = globalStateManager().getInstance();
    gameState.setPrisonDoorOpened(key);
}