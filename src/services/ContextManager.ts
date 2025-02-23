import { LLMService } from './Pipeline.js';

export interface Message {
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: number;
}

export interface Context {
    messages: Message[];
    metadata: Record<string, any>;
}

export class ContextManager {
    private context: Context;
    private llmService?: LLMService;

    constructor(initialContext?: Partial<Context>) {
        this.context = {
            messages: initialContext?.messages || [],
            metadata: initialContext?.metadata || {}
        };
    }

    public setLLMService(service: LLMService) {
        this.llmService = service;
    }

    public addMessage(role: Message['role'], content: string) {
        const message: Message = {
            role,
            content,
            timestamp: Date.now()
        };
        this.context.messages.push(message);
        console.log('\n📝 Context Manager - Added message:', { role, content });
        console.log('Current context:', this.getRecentMessages());
        return message;
    }

    public getContext(): Context {
        return this.context;
    }

    public getRecentMessages(count: number = 10): Message[] {
        return this.context.messages.slice(-count);
    }

    public setMetadata(key: string, value: any) {
        this.context.metadata[key] = value;
    }

    public getMetadata(key: string): any {
        return this.context.metadata[key];
    }

    public clear() {
        this.context.messages = [];
        this.context.metadata = {};
    }

    public async *processWithContext(text: string): AsyncGenerator<string> {
        if (!this.llmService) {
            throw new Error('LLM service not set');
        }

        // Get recent conversation history and add current message
        const recentMessages = [...this.getRecentMessages(), { role: 'user' as const, content: text, timestamp: Date.now() }];
        console.log('\n📝 Context Manager - Processing with context:', recentMessages);
        const contextualizedText = JSON.stringify(recentMessages);

        // Process with LLM service
        let fullResponse = '';
        for await (const chunk of this.llmService.processText(contextualizedText)) {
            fullResponse += chunk;
            yield chunk;
        }
    }
} 