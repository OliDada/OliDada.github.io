export function generateDungeonDoorComponents(k, pos) {
    return [
        k.sprite("dungeonDoor", { anim: "dungeon-door-1" }),
        k.area({ shape: new k.Rect(k.vec2(0, 0), 48, 48) }),
        k.body({ isStatic: true }),
        k.pos(pos),
        k.offscreen(),
        "dungeon-door",
    ];
}