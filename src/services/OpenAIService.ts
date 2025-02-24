import OpenAI from 'openai';
import { LLMService, LLMConfig, LLMResponse, FunctionTool } from './Pipeline.js';
import { Message } from './ContextManager.js';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

export class OpenAIService implements LLMService {
    private client: OpenAI;
    private config: LLMConfig;
    public tools: FunctionTool[] = [];
    private functionHandlers: Record<string, (args: any) => void> = {};

    constructor(apiKey: string, config: LLMConfig = {}) {
        this.client = new OpenAI({ apiKey });
        this.config = config;
        this.tools = config.tools || [];
        this.functionHandlers = config.functionHandlers || {};
    }

    async *processText(text: string): AsyncGenerator<LLMResponse> {
        let messages: ChatCompletionMessageParam[];
        try {
            // Try to parse the input as a message array
            const parsedMessages = JSON.parse(text);
            messages = [
                {
                    role: "system",
                    content: this.config.systemPrompt || "You are a helpful assistant engaging in real-time conversation. Keep responses concise and natural."
                },
                ...parsedMessages.map((msg: Message) => ({
                    role: msg.role,
                    content: msg.content
                }))
            ];
        } catch {
            // If parsing fails, treat it as a single message
            messages = [
                {
                    role: "system",
                    content: this.config.systemPrompt || "You are a helpful assistant engaging in real-time conversation. Keep responses concise and natural."
                },
                {
                    role: "user",
                    content: text
                }
            ];
        }

        const stream = await this.client.chat.completions.create({
            model: this.config.model || "gpt-3.5-turbo",
            messages,
            tools: this.tools.map(tool => ({
                type: 'function' as const,
                function: {
                    name: tool.name,
                    description: tool.description,
                    parameters: tool.parameters
                }
            })),
            tool_choice: "auto",
            max_tokens: this.config.maxTokens || 100,
            stream: true as const
        });

        let accumulatedFunctionCall: {
            name?: string;
            arguments: string;
        } | null = null;

        for await (const chunk of stream) {
            if (chunk.choices[0]?.delta?.tool_calls?.[0]) {
                const toolCall = chunk.choices[0].delta.tool_calls[0];
                
                // Initialize or update accumulated function call
                if (!accumulatedFunctionCall && toolCall.function?.name) {
                    accumulatedFunctionCall = {
                        name: toolCall.function.name,
                        arguments: toolCall.function?.arguments || ''
                    };
                } else if (accumulatedFunctionCall && toolCall.function?.arguments) {
                    accumulatedFunctionCall.arguments += toolCall.function.arguments;
                }

                // If we get a finish_reason of "tool_calls", execute the accumulated function
                if (chunk.choices[0].finish_reason === 'tool_calls' && accumulatedFunctionCall?.name) {
                    const handler = this.functionHandlers[accumulatedFunctionCall.name];
                    if (handler) {
                        try {
                            const args = JSON.parse(accumulatedFunctionCall.arguments);
                            handler(args);
                        } catch (error) {
                            console.error('Error executing function:', error);
                        }
                    }
                    
                    yield {
                        functionCall: {
                            name: accumulatedFunctionCall.name,
                            arguments: accumulatedFunctionCall.arguments
                        }
                    };
                    accumulatedFunctionCall = null;
                }
            } else {
                const content = chunk.choices[0]?.delta?.content || '';
                if (content) {
                    yield { content };
                }
            }

            // Check finish_reason at the end of each chunk
            if (chunk.choices[0]?.finish_reason === 'tool_calls' && accumulatedFunctionCall?.name) {
                const handler = this.functionHandlers[accumulatedFunctionCall.name];
                if (handler) {
                    try {
                        const args = JSON.parse(accumulatedFunctionCall.arguments);
                        handler(args);
                    } catch (error) {
                        console.error('Error executing function:', error);
                    }
                }
                yield {
                    functionCall: {
                        name: accumulatedFunctionCall.name,
                        arguments: accumulatedFunctionCall.arguments
                    }
                };
                accumulatedFunctionCall = null;
            }
        }
    }
} 