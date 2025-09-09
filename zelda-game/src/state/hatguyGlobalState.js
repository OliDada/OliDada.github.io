export default function hatguyGlobalStateManager() {
    let instance = null;

    function createInstance() {
        let nbTimesTalkedHatguy = 0;

        return {
            setNbTimesTalkedHatguy(value) {
                nbTimesTalkedHatguy = value;
            },
            getNbTimesTalkedHatguy() {
                return nbTimesTalkedHatguy;
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