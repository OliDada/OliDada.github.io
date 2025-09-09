import { gameState } from "../state/stateManagers.js";

async function displayLine(k, textContainer, line, speed = 10) {
    // Play the dialogue sound once per line
    k.play("dialogue", { volume: 1 });
    for (const char of line) {
        await new Promise((resolve) =>
            setTimeout(() => {
                textContainer.text += char;
                resolve();
            }, speed)
        );
    }
}

export async function dialog(k, pos, content, dialogOptions = {}) {
    gameState.setFreezePlayer(true);

    const dialogBox = k.add([k.rect(800, 200), k.pos(pos), k.fixed()]);

    const textContainer = dialogBox.add([
        k.text('', {
            font: 'gameboy',
            width: 700,
            lineSpacing: 15,
            size: gameState.getFontSize(),
        }),
        k.color(27, 29, 52),
        k.pos(20, 20),
        k.fixed(),
    ]);

    let index = 0;
    const speed = dialogOptions.speed ?? 10;

    // Call onLine callback for the first line
    if (dialogOptions.onLine) {
        dialogOptions.onLine(index);
    }

    await displayLine(k, textContainer, content[index], speed);
    let lineFinishDisplayed = true;
    const dialogKey = k.onKeyPress(["space", "enter"], async () => { 
        if (!lineFinishDisplayed) {
            return;
        }
        index++;
        if (!content[index]) {
            k.destroy(dialogBox);
            dialogKey.cancel();
            gameState.setFreezePlayer(false);
            return;
        }

        textContainer.text = '';
        lineFinishDisplayed = false;

        // Call onLine callback for each new line
        if (dialogOptions.onLine) {
            dialogOptions.onLine(index);
        }

        await displayLine(k, textContainer, content[index], speed);
        lineFinishDisplayed = true;
    });
}
