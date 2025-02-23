export class BaseAgent {
    constructor(config) {
        this.isActive = false;
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
//# sourceMappingURL=BaseAgent.js.map