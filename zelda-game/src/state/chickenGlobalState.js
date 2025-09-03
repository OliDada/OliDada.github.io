export default function chickenGlobalStateManager() {
    let instance = null;
    let initialized = false;
    let chickenHurtInteractionTriggered = false;
    let chickenDeadInteractionTriggered = false;
    let oneChickenDeadInteractionTriggered = false;

    function createInstance() {
        let chickenHealth = [];
        return {
            setChickenHealth(index, health) { chickenHealth[index] = health; },
            getChickenHealth() { return chickenHealth; },
            isAnyChickenHurt() {
                return this.getChickenHealth().reduce((sum, h) => sum + (h || 0), 0) < 6;
            }, // assuming max health is 2
            isAnyChickenDead() { return chickenHealth.some(h => h <= 0); },
            isAnyChickenAlive() { return chickenHealth.some(h => h > 0); },
            isInitialized() { return initialized; },
            setInitialized(val) { initialized = val; },
            resetChickenHealth(numChickens) {
                chickenHealth = Array(numChickens).fill(2); // or whatever your max health is
                initialized = true;
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
