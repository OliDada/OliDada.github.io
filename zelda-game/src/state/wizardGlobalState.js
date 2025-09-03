export default function wizardGlobalStateManager() {
    let instance = null;

    function createInstance() {
        let nbTimesTalkedWizard = 0;

        return {
            setNbOfTimesTalkedWizard(value) {
                nbTimesTalkedWizard = value;
            },
            getNbOfTimesTalkedWizard() {
                return nbTimesTalkedWizard;
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
