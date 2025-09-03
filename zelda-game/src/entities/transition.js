export function generateTransitionComponents(k, pos) {
    return [
        k.area({ shape: new k.Rect(k.vec2(0, 0), 16, 16) }),
        k.pos(pos),
        k.offscreen(),
        "transition",
    ];
}