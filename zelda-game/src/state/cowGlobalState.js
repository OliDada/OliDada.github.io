export default function cowGlobalStateManager() {
    let instance = null;
    
    function createInstance() {
        let isFollowingPlayer = false;
        let cowQuestComplete = false;
        let nbTimesTalkedCow = 0;

        return {
            setIsFollowingPlayer(value) {
                isFollowingPlayer = value;
            },
            getIsFollowingPlayer() {
                return isFollowingPlayer;
            },
            setCowQuestComplete(value) {
                cowQuestComplete = value;
            },
            getCowQuestComplete() {
                return cowQuestComplete;
            },
            setNbTimesTalkedCow(value) {
                nbTimesTalkedCow = value;
            },
            getNbTimesTalkedCow() {
                return nbTimesTalkedCow;
            },
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