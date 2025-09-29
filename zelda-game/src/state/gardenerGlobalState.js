export default function gardenerGlobalStateManager() {
    let instance = null;
    

    function createInstance() {

        let nbTimesTalkedGardenerHeight1 = 0;
        let nbTimesTalkedGardenerHeight2 = 0;
        let nbTimesTalkedGardenerHeight3 = 0;
        let nbTimesTalkedGardenerHeight4 = 0;
        let nbTimesTalkedGardenerHeight5 = 0;

        return {
            setNbTimesTalkedGardenerHeight1(value) {
                nbTimesTalkedGardenerHeight1 = value;
            },
            getNbTimesTalkedGardenerHeight1() {
                return nbTimesTalkedGardenerHeight1;
            },
            setNbTimesTalkedGardenerHeight2(value) {
                nbTimesTalkedGardenerHeight2 = value;
            },
            getNbTimesTalkedGardenerHeight2() {
                return nbTimesTalkedGardenerHeight2;
            },
            setNbTimesTalkedGardenerHeight3(value) {
                nbTimesTalkedGardenerHeight3 = value;
            },
            getNbTimesTalkedGardenerHeight3() {
                return nbTimesTalkedGardenerHeight3;
            },
            setNbTimesTalkedGardenerHeight4(value) {
                nbTimesTalkedGardenerHeight4 = value;
            },
            getNbTimesTalkedGardenerHeight4() {
                return nbTimesTalkedGardenerHeight4;
            },
            setNbTimesTalkedGardenerHeight5(value) {
                nbTimesTalkedGardenerHeight5 = value;
            },
            getNbTimesTalkedGardenerHeight5() {
                return nbTimesTalkedGardenerHeight5;
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