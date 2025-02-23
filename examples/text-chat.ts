import 'dotenv/config';
import {
    DeepgramService,
    OpenAIService,
    CartesiaService,
    Pipeline
} from '../src/index.js';
import playSound from 'play-sound';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
    const player = playSound({});

    // Initialize services
    console.log('🚀 Initializing services...');
    const sttService = new DeepgramService(process.env.DEEPGRAM_API_KEY || '');
    const llmService = new OpenAIService(process.env.OPENAI_API_KEY || '', {
        model: "gpt-3.5-turbo",
        maxTokens: 100,
        systemPrompt: "You are a helpful AI assistant. Keep responses concise and natural."
    });
    const ttsService = new CartesiaService(process.env.CARTESIA_API_KEY || '', {
        model: "sonic-english",
        voice: {
            mode: "id" as const,
            id: "a0e99841-438c-4a64-b679-ae501e7d6091"
        }
    });

    // Create the pipeline in text-only mode
    const pipeline = new Pipeline(
        sttService,
        llmService,
        ttsService,
        {
            textOnly: true,
            onTranscript: (text) => {
                console.log(text);
            },
            onResponse: (text) => {
                process.stdout.write(text);
            },
            onError: (error) => {
                console.error(error.message);
            },
            onAudioReady: async (audio) => {
                try {
                    // Create a temporary file to store the audio
                    const tempFile = path.join(__dirname, `temp-${Date.now()}.wav`);
                    await fs.writeFile(tempFile, audio);

                    console.log('🔊 Playing response...');
                    // Play the audio file
                    player.play(tempFile, (err?: Error) => {
                        if (err) {
                            console.error('❌ Error playing audio:', err);
                        }
                        // Delete the temporary file after playing
                        fs.unlink(tempFile).catch(err => {
                            console.error('❌ Error deleting temp file:', err);
                        });
                    });
                } catch (error) {
                    console.error('❌ Error handling audio:', error);
                }
            }
        }
    );

    // Create readline interface for user input
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    try {
        // Start the pipeline
        await pipeline.start();
        console.log('✨ Interactive chat session started');
        console.log('📝 Type your messages and press Enter');
        console.log('❌ Type "exit" to quit\n');
        
        // Set the prompt
        rl.setPrompt('> ');
        rl.prompt();

        // Handle user input
        rl.on('line', async (input) => {
            if (input.toLowerCase() === 'exit') {
                console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                console.log('👋 Ending chat session...');
                await pipeline.stop();
                rl.close();
                return;
            }

            try {
                await pipeline.sendText(input);
                rl.prompt(); // Show prompt after response
            } catch (error) {
                console.error('❌ Error processing input:', error);
                rl.prompt();
            }
        });

        // Handle readline close
        rl.on('close', () => {
            console.log('✨ Chat session ended. Goodbye!\n');
            process.exit(0);
        });
    } catch (error) {
        console.error('\n❌ Failed to start pipeline:', error);
        rl.close();
        process.exit(1);
    }
}

main().catch(error => {
    console.error('❌ Unhandled error:', error);
    process.exit(1);
}); 