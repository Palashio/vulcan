import Anthropic from '@anthropic-ai/sdk';
import { LLMService, LLMConfig } from './Pipeline.js';
import { Message } from './ContextManager.js';

interface AnthropicMessage {
    role: 'user' | 'assistant';
    content: string;
}

export class AnthropicService implements LLMService {
    private client: Anthropic;
    private config: LLMConfig;

    constructor(apiKey: string, config: LLMConfig = {}) {
        this.client = new Anthropic({ apiKey });
        this.config = config;
    }

    async *processText(text: string): AsyncGenerator<string> {
        let messages;
        try {
            // Try to parse the input as a message array
            messages = JSON.parse(text) as Message[];
        } catch {
            // If parsing fails, treat it as a single message
            messages = [{ role: 'user', content: text, timestamp: Date.now() }];
        }

        // Convert messages to Anthropic format
        const anthropicMessages: AnthropicMessage[] = messages.map(msg => {
            // Handle system messages as user messages with a special prefix
            if (msg.role === 'system') {
                return {
                    role: 'user',
                    content: `[System Message]: ${msg.content}`
                };
            }
            return {
                role: msg.role === 'assistant' ? 'assistant' : 'user',
                content: msg.content
            };
        });

        const stream = await this.client.messages.create({
            model: this.config.model || "claude-3-sonnet-20240229",
            max_tokens: this.config.maxTokens || 1024,
            messages: anthropicMessages,
            system: this.config.systemPrompt || "You are a helpful assistant engaging in real-time conversation. Keep responses concise and natural.",
            stream: true
        });

        for await (const chunk of stream) {
            if (chunk.type === 'content_block_delta' && 'text' in chunk.delta) {
                const content = chunk.delta.text;
                if (content) {
                    yield content;
                }
            }
        }
    }
} 