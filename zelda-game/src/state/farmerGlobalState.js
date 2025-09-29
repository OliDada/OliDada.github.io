export default function farmerGlobalStateManager() {
    let instance = null;

    function createInstance() {
        let nbTimesTalkedFarmer = 0;

        return {
            setNbTimesTalkedFarmer(value) {
                nbTimesTalkedFarmer = value;
            },
            getNbTimesTalkedFarmer() {
                return nbTimesTalkedFarmer;
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