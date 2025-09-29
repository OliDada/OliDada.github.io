
export function generateBeanStalkComponents(k, pos, anim) {
    return [
        k.sprite("bean-stalk", { anim: anim }),
        k.area({ shape: new k.Rect(k.vec2(0, 240), 16, 16) }),
        k.pos(pos),
        "bean-stalk",
    ];
}

// export function startBeanStalkInteraction(k, beanStalk) {
//     // Example: beanStalk.play("bean-stalk-2");
// }
