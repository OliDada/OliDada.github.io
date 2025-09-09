export default function shopkeeperGlobalStateManager() {
    let instance = null;

    function createInstance() {
        let nbTimesTalkedShopkeeper = 0;

        return {
            setNbOfTimesTalkedShopkeeper(value) {
                nbTimesTalkedShopkeeper = value;
            },
            getNbOfTimesTalkedShopkeeper() {
                return nbTimesTalkedShopkeeper;
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
