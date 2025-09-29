export default function lumberjackGlobalStateManager() {
    let instance = null;

    function createInstance() {
        let nbTimesTalkedLumberjack = 0;
        let hasMentionedGift = false;
        let hasMentionedSlimesDefeated = false;

        return {
            setNbTimesTalkedLumberjack(value) {
                nbTimesTalkedLumberjack = value;
            },
            getNbTimesTalkedLumberjack() {
                return nbTimesTalkedLumberjack;
            },
            getHasMentionedGift() {
                return hasMentionedGift;
            },
            setHasMentionedGift(val) {
                hasMentionedGift = val;
            },
            getHasMentionedSlimesDefeated() {
                return hasMentionedSlimesDefeated;
            },
            setHasMentionedSlimesDefeated(val) {
                hasMentionedSlimesDefeated = val;
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
