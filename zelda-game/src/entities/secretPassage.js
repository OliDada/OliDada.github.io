export function generateSecretPassageComponents(k, pos, isFreed = false) {
    return [
        k.sprite("sprites", { anim: "secret-passage" }),
        k.area({ shape: new k.Rect(k.vec2(0, 0), 16, 16) }),
        k.body({ isStatic: !isFreed }), // Not static if freed
        k.pos(pos),
        k.offscreen(),
        "secret-passage",
    ];
}