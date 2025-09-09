export default function beanStalkGlobalStateManager() {
    let instance = null;

    function createInstance() {
        let beanStalkHeight = 0;

        return {
            setBeanStalkHeight(value) {
                beanStalkHeight = value;
            },
            getBeanStalkHeight() {
                return beanStalkHeight;
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