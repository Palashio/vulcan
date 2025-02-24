import 'dotenv/config';
import {
    DeepgramService,
    OpenAIService,
    CartesiaService,
    AnthropicService,
    Pipeline,
    ContextManager
} from '../src/index.js';
import playSound from 'play-sound';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
    const player = playSound({});

    const sttService = new DeepgramService(process.env.DEEPGRAM_API_KEY || '');
    const llmService = new OpenAIService(process.env.OPENAI_API_KEY || '', {
        model: "gpt-4",
        maxTokens: 100,
        systemPrompt: "You are a helpful AI assistant. When users mention bananas, use the log_banana_mention function. When users mention apples, use the log_apple_mention function.",
        tools: [{
            name: "log_banana_mention",
            description: "Log when someone talks about bananas",
            parameters: {
                type: "object",
                properties: {
                    message: {
                        type: "string",
                        description: "The message containing banana-related content"
                    }
                },
                required: ["message"]
            }
        },
        {
            name: "log_apple_mention",
            description: "Log when someone talks about apples",
            parameters: {
                type: "object",
                properties: {
                    message: {
                        type: "string",
                        description: "The message containing apple-related content"
                    }
                },
                required: ["message"]
            }
        }],
        functionHandlers: {
            log_banana_mention: (args: { message: string }) => {
                console.log('🍌 [BANANA MENTION]:', args.message);
            },
            log_apple_mention: (args: { message: string }) => {
                console.log('🍎 [APPLE MENTION]:', args.message);
            }
        }
    });
    // const llmService = new AnthropicService(process.env.ANTHROPIC_API_KEY || '', {
    //     model: "claude-3-sonnet-20240229",
    //     maxTokens: 100,
    //     systemPrompt: "You are a helpful AI assistant. Keep responses concise and natural."
    // });
    const ttsService = new CartesiaService(process.env.CARTESIA_API_KEY || '', {
        model: "sonic-english",
        voice: {
            mode: "id" as const,
            id: "a0e99841-438c-4a64-b679-ae501e7d6091"
        }
    });

    // Initialize ContextManager before creating the pipeline
    const contextManager = new ContextManager();
    console.log('[INIT] Context manager initialized');

    // Create the pipeline in text-only mode with context manager
    const pipeline = new Pipeline(
        sttService,
        llmService,
        ttsService,
        {
            textOnly: true,
            contextManager: contextManager,
            onTranscript: (text) => {
                console.log('\n[USER] Input:', text);
            },
            onResponse: (text) => {
                process.stdout.write(text);
            },
            onAudioReady: async (audio) => {
                try {
                    const tempFile = path.join(__dirname, `temp-${Date.now()}.wav`);
                    await fs.writeFile(tempFile, audio);

                    console.log('[TTS] Playing audio response');
                    player.play(tempFile, (err?: Error) => {
                        if (err) {
                            console.error('[ERROR] Audio playback failed:', err);
                        }
                        fs.unlink(tempFile).catch(err => {
                            console.error('[ERROR] Failed to delete temp file:', err);
                        });
                    });
                } catch (error) {
                    console.error('[ERROR] Audio handling failed:', error);
                }
            }
        }
    );

    try {
        await pipeline.startTextChat();
    } catch (error) {
        console.error('[ERROR] Failed to start text chat:', error);
        process.exit(1);
    }
}

main().catch(error => {
    console.error('[ERROR] Unhandled error:', error);
    process.exit(1);
}); 