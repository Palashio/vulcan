export interface AgentConfig {
    systemPrompt?: string;
    onError?: (error: Error) => void;
}

export interface AgentResponse {
    success: boolean;
    message?: string;
    error?: string;
}

export interface Agent {
    start(): Promise<AgentResponse>;
    stop(): Promise<AgentResponse>;
}

export abstract class BaseAgent implements Agent {
    protected isActive: boolean = false;
    protected config: AgentConfig;

    constructor(config: AgentConfig) {
        this.config = config;
    }

    protected handleError(error: Error | string): void {
        const errorObj = error instanceof Error ? error : new Error(error);
        console.error('❌', errorObj);
        if (this.config.onError) {
            this.config.onError(errorObj);
        }
    }

    abstract start(): Promise<AgentResponse>;
    abstract stop(): Promise<AgentResponse>;
} 