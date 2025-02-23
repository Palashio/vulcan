import 'dotenv/config';
import {
    DeepgramService,
    OpenAIService,
    ElevenLabsService,
    CartesiaService,
    Pipeline,
    ContextManager
} from 'vulcan';
import playSound from 'play-sound';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
    const player = playSound({});
    const contextManager = new ContextManager();
    // Initialize services
    const sttService = new DeepgramService(process.env.DEEPGRAM_API_KEY || '');

    const llmService = new OpenAIService(process.env.OPENAI_API_KEY || '', {
        model: "gpt-3.5-turbo",
        maxTokens: 100,
        systemPrompt: "You are a helpful AI assistant. Keep responses concise and natural."
    });

    // const ttsService = new ElevenLabsService(process.env.ELEVEN_LABS_API_KEY || '', {
    //     modelId: 'eleven_monolingual_v1',
    //     voiceId: '21m00Tcm4TlvDq8ikWAM', // Rachel voice
    //     stability: 0.5,
    //     similarityBoost: 0.75
    // });

    const ttsService = new CartesiaService(process.env.CARTESIA_API_KEY || '', {
        model: "sonic-english",
        voice: {
            mode: "id" as const,
            id: "a0e99841-438c-4a64-b679-ae501e7d6091"
        }
    });

    // Create the pipeline
    const pipeline = new Pipeline(
        sttService,
        llmService,
        ttsService,
        {
            contextManager,
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
                    // Create a temporary file to store the audio
                    const tempFile = path.join(__dirname, `temp-${Date.now()}.wav`);
                    await fs.writeFile(tempFile, audio);

                    console.log('\n🔈 Playing audio response...');
                    // Play the audio file
                    player.play(tempFile, (err?: Error) => {
                        if (err) {
                            console.error('\n❌ Error playing audio:', err);
                        }
                        // Delete the temporary file after playing
                        fs.unlink(tempFile).catch(err => {
                            console.error('\n❌ Error deleting temp file:', err);
                        });
                    });
                } catch (error) {
                    console.error('\n❌ Error handling audio:', error);
                }
            }
        }
    );

    console.log('🚀 Initializing voice pipeline...');
    
    try {
        await pipeline.start();
        console.log('\n✨ Pipeline is ready!');
        console.log('💡 Start speaking, and I will respond.');
        console.log('⌨️  Press Ctrl+C to stop');
    } catch (error) {
        console.error('\n❌ Failed to start pipeline:', error);
        process.exit(1);
    }

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
        console.log('\n\n👋 Stopping pipeline...');
        await pipeline.stop();
        console.log('✅ Pipeline stopped successfully');
        process.exit(0);
    });
}

main().catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
}); 