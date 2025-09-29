let instance = null;

export default function globalStateManager() {
    function createInstance() {
        let previousScene = null;
        let currentScene = null;
        let freezePlayer = false;
        let language = 'english';
        let fontSize = 30;
        let openedChests = {};
        let prisonDoorOpen = false;
        let currentSong = null;
        let deadSlimes = [];
        let hasDefeatedGhost = false;
        let prisonerFreed = false;
        let isFenceDoorOpened = false;
        let trollDinnerHad = false;
        let plantedBeans = false;
        let wolfEncountered = false;

        return {
            setPreviousScene(scene) {
                previousScene = scene;
            },
            getPreviousScene() {
                return previousScene;
            },
            setCurrentScene(scene) {
                currentScene = scene;
            },
            getCurrentScene() {
                return currentScene;
            },
            setFreezePlayer(value) {
                freezePlayer = value;
            },
            getFreezePlayer() {
                return freezePlayer;
            },
            setFontSize(value) {
                fontSize = value;
            },
            getFontSize() {
                return fontSize;
            },
            setLanguage(lang) {
                language = lang;
            },
            getLanguage() {
                return language;
            },
            setChestOpened(key) {
                openedChests[key] = true;
            },
            getChestOpened(key) {
                return !!openedChests[key];
            },
            getOpenedChests() {
                return openedChests;
            },
            setPrisonDoorOpened(value) {
                prisonDoorOpen = value;
            },
            getPrisonDoorOpened() {
                return prisonDoorOpen;
            },
            setCurrentSong(song) {
                currentSong = song;
            },
            getCurrentSong() {
                return currentSong;
            },
            pauseCurrentSong() {
                if (currentSong) {
                    if (typeof currentSong.pause === 'function') {
                        currentSong.pause();
                    } else if (typeof currentSong.stop === 'function') {
                        currentSong.stop();
                    } else if (typeof currentSong.volume === 'number') {
                        currentSong.volume = 0;
                    }
                    currentSong = null;
                }
            },
            getDeadSlimes() {
                return deadSlimes;
            },
            addDeadSlime(key) {
                if (!deadSlimes.includes(key)) {
                    deadSlimes.push(key);
                }
            },
            setHasDefeatedGhost(value) {
                hasDefeatedGhost = value;
            },
            getHasDefeatedGhost() {
                return hasDefeatedGhost;
            },
            setPrisonerFreed(value) {
                prisonerFreed = value;
            },
            getPrisonerFreed() {
                return prisonerFreed;
            },
            setIsFenceDoorOpened(value) {
                isFenceDoorOpened = value;
            },
            getIsFenceDoorOpened() {
                return isFenceDoorOpened;
            },
            setTrollDinnerHad(value) {
                trollDinnerHad = value;
            },
            getTrollDinnerHad() {
                return trollDinnerHad;
            },
            setPlantedBeans(value) {
                plantedBeans = value;
            },
            getPlantedBeans() {
                return plantedBeans;
            },
            setWolfEncountered(value) {
                wolfEncountered = value;
            },
            getWolfEncountered() {
                return wolfEncountered;
            },
        };
    }

    return {
        getInstance() {
            if (!instance) {
                instance = createInstance();
            }
            return instance;
        },
    };
}
