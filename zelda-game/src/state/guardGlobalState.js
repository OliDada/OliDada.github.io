export default function guardGlobalStateManager() {
    let instance = null;

    function createInstance() {
        let nbTimesTalkedGuard = 0;

        return {
            setNbTimesTalkedGuard(value) {
                nbTimesTalkedGuard = value;
            },
            getNbTimesTalkedGuard() {
                return nbTimesTalkedGuard;
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