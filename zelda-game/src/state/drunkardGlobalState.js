export default function drunkardGlobalStateManager() {
    let instance = null;

    function createInstance() {
        let nbTimesTalkedDrunkard = 0;

        return {
            setNbTimesTalkedDrunkard(value) {
                nbTimesTalkedDrunkard = value;
            },
            getNbTimesTalkedDrunkard() {
                return nbTimesTalkedDrunkard;
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