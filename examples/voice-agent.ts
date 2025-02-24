import 'dotenv/config';
import {
    DeepgramService,
    OpenAIService,
    CartesiaService,
    Pipeline,
    ContextManager
} from '../src/index.js';
import playSound from 'play-sound';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Track current audio playback
let currentAudio: any = null;

// Define our function tools
const functionTools = [{
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
}];

// Define our function handlers
const functionHandlers = {
    log_banana_mention: (args: { message: string }) => {
        console.log('🍌 [BANANA MENTION]:', args.message);
    },
    log_apple_mention: (args: { message: string }) => {
        console.log('🍎 [APPLE MENTION]:', args.message);
    }
};

async function main() {
    const player = playSound({});
    const contextManager = new ContextManager();
    
    // Initialize services
    const sttService = new DeepgramService(process.env.DEEPGRAM_API_KEY || '');

    const llmService = new OpenAIService(process.env.OPENAI_API_KEY || '', {
        model: "gpt-4",
        maxTokens: 100,
        systemPrompt: "You are a helpful AI assistant. When users mention bananas, use the log_banana_mention function. When users mention apples, use the log_apple_mention function.",
        tools: functionTools,
        functionHandlers: functionHandlers
    });

    const ttsService = new CartesiaService(process.env.CARTESIA_API_KEY || '', {
        model: "sonic-english"
    });

    // Create the pipeline
    const pipeline = new Pipeline(
        sttService,
        llmService,
        ttsService,
        {
            contextManager,
            vadConfig: {
                onSpeechStart: () => {
                    console.log('\n🎤 Started speaking...');
                },
                onSpeechEnd: () => {
                    console.log('🎤 Finished speaking');
                },
                onVADMisfire: () => {
                    console.log('⚠️  False trigger detected');
                },
                onInterrupt: () => {
                    console.log('🤚 Interrupting response...');
                    // Stop any currently playing audio
                    if (currentAudio) {
                        currentAudio.kill();
                        currentAudio = null;
                    }
                }
            },
            onTranscript: (text) => {
                console.log('\n👤 You said:', text);
            },
            onResponse: (text) => {
                process.stdout.write(text);
            },
            onError: (error) => {
                console.error('\n❌ Error:', error.message);
            },
            onAudioReady: async (audio) => {
                try {
                    const tempFile = path.join(__dirname, `temp-${Date.now()}.wav`);
                    await fs.writeFile(tempFile, audio);

                    console.log('\n🔈 Playing audio response...');
                    pipeline.setAudioPlayingState(true);
                    currentAudio = player.play(tempFile, (err?: Error) => {
                        pipeline.setAudioPlayingState(false);
                        if (err && err.message !== 'Killed') {
                            console.error('\n❌ Error playing audio:', err);
                        }
                        fs.unlink(tempFile).catch(err => {
                            console.error('\n❌ Error deleting temp file:', err);
                        });
                    });
                } catch (error) {
                    console.error('\n❌ Error handling audio:', error);
                    pipeline.setAudioPlayingState(false);
                }
            }
        }
    );

    console.log('🚀 Initializing voice agent...');
    
    try {
        await pipeline.startVoiceChat();
        console.log('\n✨ Voice agent is ready!');
        console.log('💡 Start speaking, and I will respond.');
        console.log('🍎 Try mentioning apples or bananas! 🍌');
        console.log('⌨️  Press Ctrl+C to stop');
    } catch (error) {
        console.error('\n❌ Failed to start voice agent:', error);
        process.exit(1);
    }
}

main().catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
}); 