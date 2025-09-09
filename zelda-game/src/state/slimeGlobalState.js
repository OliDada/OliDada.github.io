export default function slimeGlobalStateManager() {
    let instance = null;
    let initialized = false;

    function createInstance() {
        let slimeHealth = [];
        return {
            setSlimeHealth(index, health) {
                if (typeof health === 'undefined') return; // Ignore undefined health updates
                console.log('Setting slimeHealth', index, health, 'before:', [...slimeHealth]);
                slimeHealth[index] = health;
                console.log('slimeHealth after:', [...slimeHealth]);
            },
            getSlimeHealth() { return slimeHealth; },
            areBothSlimesDead() {
                return slimeHealth.length >= 2 && slimeHealth[0] <= 0 && slimeHealth[1] <= 0;
            },
            isAnySlimeDead() {
                return slimeHealth.some(h => h <= 0);
            },
            isAnySlimeAlive() {
                return slimeHealth.some(h => h > 0);
            },
            isInitialized() { return initialized; },
            setInitialized(val) { initialized = val; },
            resetSlimeHealth(numSlimes) {
                if (!initialized) {
                    slimeHealth = Array(numSlimes).fill(3); // assuming max health is 3
                    initialized = true;
                }
            },
            forceResetSlimeHealth(numSlimes) {
                slimeHealth = Array(numSlimes).fill(3);
                initialized = true;
            },
        };
    }

    return {
        getInstance() {
            if (!instance) instance = createInstance();
            return instance;
        }
    };
}
