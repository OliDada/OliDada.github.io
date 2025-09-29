export default function prisonerGlobalStateManager() {
    let instance = null;

    function createInstance() {
        let nbTimesTalkedPrisoner = 0;

        return {
            setNbTimesTalkedPrisoner(value) {
                nbTimesTalkedPrisoner = value;
            },
            getNbTimesTalkedPrisoner() {
                return nbTimesTalkedPrisoner;
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
