export default function oldmanGlobalStateManager() {
    let instance = null;

    function createInstance() {
        let nbTimesTalkedOldman = 0;

        return {
            setNbTimesTalkedOldman(value) {
                nbTimesTalkedOldman = value;
            },
            getNbTimesTalkedOldman() {
                return nbTimesTalkedOldman;
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
