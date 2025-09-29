
import menuText from "../content/menuText.js";
import globalStateManager from "../state/globalState.js";
import { colorizeBackground } from "../utils";
import { chickenState } from "../state/stateManagers.js";

const gameState = globalStateManager().getInstance();

export default function mainMenu(k) {
    const currentLanguage = gameState.getLanguage();

    colorizeBackground(k, 27, 29, 52);

    k.add([
        k.text(menuText[currentLanguage].title, { size: 32, font: "gameboy" }),
        k.area(),
        k.anchor("center"),
        k.pos(k.center().x, k.center().y - 100),
    ]);

    k.add([
        k.text(menuText[currentLanguage].languageIndication, { 
            size: 16, 
            font: "gameboy" 
        }),
        k.area(),
        k.anchor("center"),
        k.pos(k.center().x, k.center().y + 100),
    ]);

    k.add([
        k.text(menuText[currentLanguage].playIndication, { 
            size: 24, 
            font: "gameboy" 
        }),
        k.area(),
        k.anchor("center"),
        k.pos(k.center().x, k.center().y + 200),
    ]);

    k.onKeyPress("f", () => {
        const currentLanguage = gameState.getLanguage();
        gameState.setLanguage(currentLanguage === "english" ? "icelandic" : "english");
        k.go("mainMenu");
    });

    k.onKeyPress("enter", () => {
        chickenState.initIfNeeded(3);
        gameState.pauseCurrentSong();
        const newSong = k.play("soundtrack", { loop: true });
        gameState.setCurrentSong(newSong);
        k.go("world");
    });
}
