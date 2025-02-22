import OpenAI from 'openai';
import { LLMService, LLMConfig } from './Pipeline.js';

export class OpenAIService implements LLMService {
    private client: OpenAI;
    private config: LLMConfig;

    constructor(apiKey: string, config: LLMConfig = {}) {
        this.client = new OpenAI({ apiKey });
        this.config = config;
    }

    async *processText(text: string): AsyncGenerator<string> {
        const stream = await this.client.chat.completions.create({
            model: this.config.model || "gpt-3.5-turbo",
            messages: [
                {
                    role: "system",
                    content: this.config.systemPrompt || "You are a helpful assistant engaging in real-time conversation. Keep responses concise and natural."
                },
                {
                    role: "user",
                    content: text
                }
            ],
            max_tokens: this.config.maxTokens || 100,
            stream: true
        });

        for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || '';
            if (content) {
                yield content;
            }
        }
    }
} 