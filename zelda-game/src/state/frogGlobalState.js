export default function frogGlobalStateManager() {
    let instance = null;

    function createInstance() {
        let nbTimesTalkedFrog = 0;

        return {
            setNbTimesTalkedFrog(value) {
                nbTimesTalkedFrog = value;
            },
            getNbTimesTalkedFrog() {
                return nbTimesTalkedFrog;
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