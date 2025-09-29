import { gameState } from "../state/stateManagers.js";

async function displayLine(k, textContainer, line, speed = 10, skipFlag) {
    k.play("dialogue", { volume: 1 });
    textContainer.text = "";

    // Instantly show the line if speed is 0
    if (speed === 0) {
        textContainer.text = line;
        return;
    }

    let resolveSkip;
    const skipPromise = new Promise((resolve) => {
        resolveSkip = resolve;
    });

    // Listen for skipFlag changes
    const skipListener = () => {
        if (skipFlag.skip) resolveSkip();
    };

    // Attach a polling interval to check skipFlag
    const interval = setInterval(skipListener, 5);

    for (let i = 0; i < line.length; i++) {
        if (skipFlag.skip) {
            textContainer.text = line;
            clearInterval(interval);
            return;
        }
        await Promise.race([
            new Promise((resolve) =>
                setTimeout(resolve, speed)
            ),
            skipPromise,
        ]);
        if (skipFlag.skip) {
            textContainer.text = line;
            clearInterval(interval);
            return;
        }
        textContainer.text += line[i];
    }
    clearInterval(interval);
}

export async function dialog(k, pos, content, dialogOptions = {}) {
    gameState.setFreezePlayer(true);

    // Add a semi-transparent background with border and rounded corners
    const dialogBox = k.add([
        k.rect(800, 200, { radius: 24 }), // Rounded corners
        k.pos(pos),
        k.color(255, 255, 255),           // White background
        k.opacity(0.92),                  // Slight transparency
        k.outline(4, k.rgb(27, 29, 52)),  // Dark border
        k.z(100),                         // Ensure on top
        k.fixed(),
        { shadow: true },                 // Custom property for shadow (see below)
        ...(dialogOptions.tag ? [dialogOptions.tag] : []),
    ]);

    // Optional: Add a drop shadow (if your engine supports it)
    if (dialogBox.shadow) {
        dialogBox.use({
            draw() {
                k.drawRect({
                    width: 800,
                    height: 200,
                    pos: k.vec2(8, 8), // Offset for shadow
                    color: k.rgb(0, 0, 0),
                    opacity: 0.25,
                    radius: 24,
                });
            }
        });
    }

    // Add NPC portrait if provided
    if (dialogOptions.portrait) {
        dialogBox.add([
            k.sprite(dialogOptions.portrait),
            k.pos(24, 24),
            k.scale(1),
            k.z(102),
        ]);
        dialogBox.add([
            k.rect(128, 128, { radius: 16 }),
            k.color(230, 230, 230),
            k.pos(24, 24),
            k.z(101),
        ]);
    }

    // Adjust text position if portrait is present
    const textX = dialogOptions.portrait ? 168 : 32;
    const textContainer = dialogBox.add([
        k.text('', {
            font: 'gameboy',
            width: 700 - (dialogOptions.portrait ? 136 : 0),
            lineSpacing: 15,
            size: gameState.getFontSize(),
        }),
        k.color(27, 29, 52),
        k.pos(textX, 32),
        k.fixed(),
    ]);

    let index = 0;
    const speed = dialogOptions.speed ?? 10;
    let keyHandled = false;
    let typing = false;
    const skipFlag = { skip: false };

    // Helper to display a line with skip support
    async function showLine() {
        skipFlag.skip = false;
        typing = true;
        await displayLine(k, textContainer, content[index], speed, skipFlag);
        typing = false;
    }

    // Call onLine callback for the first line
    if (dialogOptions.onLine) {
        dialogOptions.onLine(index);
    }

    // Return a promise that resolves when dialog is finished
    return new Promise((resolve) => {
        const dialogKey = k.onKeyDown(["space", "enter"], async () => {
            if (keyHandled) return;
            keyHandled = true;
            setTimeout(() => { keyHandled = false; }, 150); // debounce

            if (typing) {
                skipFlag.skip = true;
                return;
            }
            index++;
            if (!content[index]) {
                k.destroy(dialogBox);
                dialogKey.cancel();
                if (!dialogOptions.keepFrozen) {
                    gameState.setFreezePlayer(false);
                }
                resolve();
                return;
            }
            textContainer.text = '';
            if (dialogOptions.onLine) {
                dialogOptions.onLine(index);
            }
            await showLine();
        });

        // Start the first line after handler is registered
        showLine();
    });
}
