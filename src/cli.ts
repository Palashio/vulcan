#!/usr/bin/env node
import 'dotenv/config';
import { VoiceAgent } from './agents/VoiceAgent.js';
import readline from 'readline';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

async function main() {
    console.log('Initializing voice agent...');
    
    const agent = new VoiceAgent({
        deepgramApiKey: process.env.DEEPGRAM_API_KEY || '',
        openaiApiKey: process.env.OPENAI_API_KEY || '',
        cartesiaApiKey: process.env.CARTESIA_API_KEY || '',
        onTranscript: (text) => {
            console.log('\nYou said:', text);
        },
        onResponse: (text) => {
            process.stdout.write(text);
        }
    });

    console.log('\nVoice agent ready! Available commands:');
    console.log('  start - Start listening');
    console.log('  stop  - Stop listening');
    console.log('  exit  - Exit the program');
    console.log('\nEnter a command:');

    rl.on('line', async (input) => {
        const command = input.trim().toLowerCase();
        
        switch (command) {
            case 'start':
                const startResult = await agent.start();
                if (startResult.success) {
                    console.log('\nListening... Speak something!');
                } else {
                    console.error('\nFailed to start:', startResult.error);
                }
                break;
                
            case 'stop':
                const stopResult = await agent.stop();
                if (stopResult.success) {
                    console.log('\nStopped listening.');
                } else {
                    console.error('\nFailed to stop:', stopResult.error);
                }
                break;
                
            case 'exit':
                await agent.stop();
                rl.close();
                process.exit(0);
                break;
                
            default:
                console.log('\nUnknown command. Available commands: start, stop, exit');
        }
        
        console.log('\nEnter a command:');
    });
}

main().catch(console.error); 