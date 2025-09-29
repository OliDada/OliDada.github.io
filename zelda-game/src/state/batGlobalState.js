export default function batGlobalStateManager() {
    let instance = null;
    let initialized = false;

    function createInstance() {
        let batHealth = [];
        return {
            setBatHealth(index, health) {
                if (typeof health === 'undefined') return; // Ignore undefined health updates
                console.log('Setting batHealth', index, health, 'before:', [...batHealth]);
                batHealth[index] = health;
                console.log('batHealth after:', [...batHealth]);
            },
            getBatHealth() { return batHealth; },
            areBothBatsDead() {
                return batHealth.length >= 2 && batHealth[0] <= 0 && batHealth[1] <= 0;
            },
            isAnyBatDead() {
                return batHealth.some(h => h <= 0);
            },
            isAnyBatAlive() {
                return batHealth.some(h => h > 0);
            },
            isInitialized() { return initialized; },
            setInitialized(val) { initialized = val; },
            resetBatHealth(numBats) {
                if (!initialized) {
                    batHealth = Array(numBats).fill(3); // assuming max health is 3
                    initialized = true;
                }
            },
            forceResetBatHealth(numBats) {
                batHealth = Array(numBats).fill(3);
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
