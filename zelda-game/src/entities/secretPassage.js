export function generateSecretPassageComponents(k, pos, isFreed = false) {
    const components = [
        k.sprite("sprites", { anim: "secret-passage" }),
        k.area({ shape: new k.Rect(k.vec2(0, 0), 16, 14) }), // Use (0,0) and full size for consistency
        k.body({ isStatic: !isFreed }), // Not static if freed
        k.pos(pos),
        "secret-passage",
        "solid"
    ];
    // Only add 'pullable' tag if isFreed is true
    if (isFreed) components.push("pullable");
    return components;
}