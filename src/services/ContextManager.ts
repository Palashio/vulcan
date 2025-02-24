import { LLMService, FunctionTool, LLMResponse } from './Pipeline.js';

export interface Message {
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: number;
    functionCall?: {
        name: string;
        arguments: string;
    } | undefined;
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

    public addMessage(role: Message['role'], content: string, functionCall?: Message['functionCall']): Message {
        const message: Message = {
            role,
            content,
            timestamp: Date.now(),
            functionCall: functionCall
        };
        this.context.messages.push(message);
        console.log('\n📝 Context Manager - Added message:', { role, content, functionCall });
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

    public async *processWithContext(text: string, tools?: FunctionTool[]): AsyncGenerator<LLMResponse> {
        if (!this.llmService) {
            throw new Error('LLM service not set');
        }

        // Add the current message to context
        this.addMessage('user', text);

        // Get recent conversation history
        const recentMessages = this.getRecentMessages();
        console.log('\n📝 Context Manager - Processing with context:', recentMessages);
        const contextualizedText = JSON.stringify(recentMessages);

        // Process with LLM service
        let accumulatedContent = '';
        for await (const response of this.llmService.processText(contextualizedText, tools)) {
            if (response.functionCall) {
                // Store function calls in context immediately
                this.addMessage('assistant', '', response.functionCall);
                console.log('\n[FUNCTION CALL]:', response.functionCall);
            } else if (response.content) {
                // Accumulate content chunks
                accumulatedContent += response.content;
            }
            yield response;
        }

        // Store the complete message if there was any content
        if (accumulatedContent) {
            this.addMessage('assistant', accumulatedContent);
        }
    }
} 