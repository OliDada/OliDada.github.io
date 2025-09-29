export default function swordsmanGlobalStateManager() {
    let instance = null;

    function createInstance() {
        let nbTimesTalkedSwordsman = 0;

        return {
            setNbTimesTalkedSwordsman(value) {
                nbTimesTalkedSwordsman = value;
            },
            getNbTimesTalkedSwordsman() {
                return nbTimesTalkedSwordsman;
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