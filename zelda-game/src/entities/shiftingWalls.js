export function generateShiftingWallComponents(k, pos) {
    return [
        k.sprite("shifting-walls", { anim: "wall-1" }),
        k.area({ shape: new k.Rect(k.vec2(0, 0), 64, 52) }),
        k.body({ isStatic: true }),
        k.pos(pos),
        k.offscreen(),
        "shifting-wall",
    ];
}