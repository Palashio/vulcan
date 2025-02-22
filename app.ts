import 'dotenv/config';
import { VoiceAgent } from './src/agents/VoiceAgent.js';

async function main() {
    // Create the agent with minimal config
    const agent = new VoiceAgent({
        systemPrompt: "You are a helpful AI assistant. Keep responses concise and natural.",
        onTranscript: (text) => {
            console.log('\n👤 You said:', text);
        },
        onResponse: (text) => {
            process.stdout.write(text);
        },
        onError: (error) => {
            console.error('\n❌ Error:', error.message);
        },
        onRecordingStart: () => {
            console.log('🎙️ Recording started! Speak into your microphone...');
        }
    });

    console.log('🚀 Initializing voice agent...');
    
    // Start the agent
    const result = await agent.start();
    if (result.success) {
        console.log('\n✨ Agent is ready!');
        console.log('💡 Start speaking, and I will respond.');
        console.log('⌨️  Press Ctrl+C to stop');
    } else {
        console.error('\n❌ Failed to start agent:', result.error);
        process.exit(1);
    }

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
        console.log('\n\n👋 Stopping agent...');
        await agent.stop();
        console.log('✅ Agent stopped successfully');
        process.exit(0);
    });
}

main().catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
}); 