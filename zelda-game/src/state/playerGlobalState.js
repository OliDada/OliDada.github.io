export default function playerGlobalStateManager() {
    let instance = null;

    function createInstance() {
        let isSwordEquipped = false;
        let maxHealth = 3;
        let health = maxHealth;
        let hasBasementKey = false;
        let potions = 0;
        let keys = [];
        let hasHadPotion = false;
        let hasPrisonKey = false;
        let hasCarrot = false;
        let hasMagicalBeans = false;
        let hasTavernSupplies = false;
        let hasCrown = false;

        return {
            setIsSwordEquipped(value) {
                isSwordEquipped = value;
            },
            getIsSwordEquipped() {
                return isSwordEquipped;
            },
            setMaxHealth(value) {
                maxHealth = value;
                if (health > maxHealth) {
                    health = maxHealth;
                }
            },
            getMaxHealth() {
                return maxHealth;
            },
            setHealth(value) {
                health = Math.max(0, Math.min(value, maxHealth));
            },
            getHealth() {
                return health;
            },
            setHasKey(value) {
                hasKey = value;
            },
            getHasKey() {
                return hasKey;
            },
            getMaxHealth() {
                return maxHealth;
            },
            getPotions() {
                return potions;
            },
            addPotion(amount = 1) {
                potions += amount;
                if (amount > 0) {
                    hasHadPotion = true; // Only set to true, never back to false
                }
            },
            usePotion() {
                if (potions > 0) {
                    potions--;
                    return true;
                }
                return false;
            },
            // Debug method to log current health and potion count
            debug() {
                console.log(`Health: ${health}/${maxHealth}, Potions: ${potions}`);
            },
            setHasHadPotion(value) {
                hasHadPotion = value;
            },
            getHasHadPotion() {
                return hasHadPotion;
            },
            setHasBasementKey(value) {
                hasBasementKey = value;
            },
            getHasBasementKey() {
                return hasBasementKey;
            },
            setKeys(value) {
                keys = value;
            },
            getKeys() {
                return [...keys];
            },
            addKey(key) {
                if (!keys.includes(key)) keys.push(key);
            },
            hasKey(key) {
                return keys.includes(key);
            },
            setHasPrisonKey(value) {
                hasPrisonKey = value;
            },
            getHasPrisonKey() {
                return hasPrisonKey;
            },
            setHasCarrot(value) {
                hasCarrot = value;
            },
            getHasCarrot() {
                return hasCarrot;
            },
            setHasMagicalBeans(value) {
                hasMagicalBeans = value;
            },
            getHasMagicalBeans() {
                return hasMagicalBeans;
            },
            setHasTavernSupplies(value) {
                hasTavernSupplies = value;
            },
            getHasTavernSupplies() {
                return hasTavernSupplies;
            },
            setHasCrown(value) {
                hasCrown = value;
            },
            getHasCrown() {
                return hasCrown;
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

