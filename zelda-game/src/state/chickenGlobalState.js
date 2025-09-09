export default function chickenGlobalStateManager() {
    let instance = null;
    let initialized = false;
    let chickenHurtInteractionTriggered = false;
    let chickenDeadInteractionTriggered = false;
    let oneChickenDeadInteractionTriggered = false;

    function createInstance() {
        let chickenHealth = [];
        return {
            setChickenHealth(index, health) {
                if (typeof health !== 'number' || isNaN(health)) {
                    return;
                }
                chickenHealth[index] = health;
            },
            getChickenHealth() {
                return chickenHealth;
            },
            isAnyChickenHurt() {
                const healthArr = this.getChickenHealth();
                const result = healthArr.some(h => h > 0 && h < 2);
                return result;
            },
            isAnyChickenDead() {
                const result = chickenHealth.some(h => h <= 0);
                return result;
            },
            isAnyChickenAlive() {
                const result = chickenHealth.some(h => h > 0);
                return result;
            },
            isInitialized() { return initialized; },
            setInitialized(val) { initialized = val; },
            resetChickenHealth(numChickens) {
                chickenHealth = Array(numChickens).fill(2); // or whatever your max health is
                initialized = true;
            },
            // Only initialize chicken health if not already initialized or array is empty
            initIfNeeded(numChickens) {
                if (!initialized || chickenHealth.length === 0) {
                    this.resetChickenHealth(numChickens);
                }
            },
            hasTriggeredHurtInteraction() { return chickenHurtInteractionTriggered; },
            setTriggeredHurtInteraction(val) { chickenHurtInteractionTriggered = val; },
            hasTriggeredDeadInteraction() { return chickenDeadInteractionTriggered; },
            setTriggeredDeadInteraction(val) { chickenDeadInteractionTriggered = val; },
            hasTriggeredOneDeadInteraction() { return oneChickenDeadInteractionTriggered; },
            setTriggeredOneDeadInteraction(val) { oneChickenDeadInteractionTriggered = val; },
            isSomeButNotAllDead() {
                const healthArr = this.getChickenHealth();
                const dead = healthArr.filter(h => h === 0).length;
                const total = healthArr.length;
                return dead > 0 && dead < total;
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
