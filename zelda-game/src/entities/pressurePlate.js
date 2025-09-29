export function generatePressurePlateComponents(k, pos, isFreed = false) {
    return [
        k.sprite("sprites", { anim: "pressure-plate-up" }),
        k.area({ shape: new k.Rect(k.vec2(4, 4), 10, 10) }),
        k.pos(pos),
        k.offscreen(),
        "pressure-plate",
    ];
}