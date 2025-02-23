import Anthropic from '@anthropic-ai/sdk';
import { LLMService, LLMConfig } from './Pipeline.js';

export class AnthropicService implements LLMService {
    private client: Anthropic;
    private config: LLMConfig;

    constructor(apiKey: string, config: LLMConfig = {}) {
        this.client = new Anthropic({ apiKey });
        this.config = config;
    }

    async *processText(text: string): AsyncGenerator<string> {
        const stream = await this.client.messages.create({
            model: this.config.model || "claude-3-sonnet-20240229",
            max_tokens: this.config.maxTokens || 1024,
            messages: [
                {
                    role: "user",
                    content: text
                }
            ],
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