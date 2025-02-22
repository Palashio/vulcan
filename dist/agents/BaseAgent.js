export class BaseAgent {
    isActive = false;
    config;
    constructor(config) {
        this.config = config;
    }
    handleError(error) {
        const errorObj = error instanceof Error ? error : new Error(error);
        console.error('❌', errorObj);
        if (this.config.onError) {
            this.config.onError(errorObj);
        }
    }
}
