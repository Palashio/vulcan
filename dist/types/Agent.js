export class BaseAgent {
    constructor(config) {
        if (!config.systemPrompt) {
            throw new Error('System prompt is required');
        }
        this.systemPrompt = config.systemPrompt;
        this.onError = config.onError;
    }
}
//# sourceMappingURL=Agent.js.map