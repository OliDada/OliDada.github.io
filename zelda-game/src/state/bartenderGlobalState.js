export default function bartenderGlobalStateManager() {
    let instance = null;

    function createInstance() {
        let nbTimesTalkedBartender = 0;

        return {
            setNbTimesTalkedBartender(value) {
                nbTimesTalkedBartender = value;
            },
            getNbTimesTalkedBartender() {
                return nbTimesTalkedBartender;
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