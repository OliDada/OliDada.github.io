let instance = null; 

export default function globalStateManager() {
    function createInstance() {
        let previousScene = null;
        let currentScene = null;
        let freezePlayer = false;
        let language = "english";
        let fontSize = 30;
        let openedChests = {};
        let prisonDoorOpen = false;
        let currentSong = null;
        return {
            setPreviousScene(scene) { previousScene = scene; },
            getPreviousScene() { return previousScene; },
            setCurrentScene(scene) { currentScene = scene; },
            getCurrentScene() { return currentScene; },
            setFreezePlayer(value) { freezePlayer = value; },
            getFreezePlayer() { return freezePlayer; },
            setFontSize(value) { fontSize = value; },
            getFontSize() { return fontSize; },
            setLanguage(lang) { language = lang; },
            getLanguage() { return language; },
            setChestOpened(key) { openedChests[key] = true; },
            getChestOpened(key) { return !!openedChests[key]; },
            getOpenedChests() { return openedChests; },
            setPrisonDoorOpened(value) { prisonDoorOpen = value; },
            getPrisonDoorOpened() { return prisonDoorOpen; },
            setCurrentSong(song) { currentSong = song; },
            getCurrentSong() { return currentSong; },
            pauseCurrentSong() {
                if (currentSong && typeof currentSong.pause === "function") {
                    currentSong.pause();
                    currentSong = null;
                }
            }
        };
    }

    return {
        getInstance() {
            if (!instance) {
                instance = createInstance();
            }
            return instance;
        }
    };
}
