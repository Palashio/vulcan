import { createClient, LiveTranscriptionEvents } from "@deepgram/sdk";
import OpenAI from 'openai';
import CartesiaClient from "@cartesia/cartesia-js";
import mic from 'node-microphone';
import playSound from 'play-sound';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export function VoiceAgent(config) {
    let isActive = false;
    let microphone = null;
    let deepgramLive = null;
    const player = playSound({});
    console.log('🔍 Initializing clients...');
    const deepgram = createClient(config.deepgramApiKey);
    const openai = new OpenAI({ apiKey: config.openaiApiKey });
    const cartesia = new CartesiaClient({ apiKey: config.cartesiaApiKey });
    console.log('✅ Clients initialized');
    async function handleTranscript(transcript) {
        console.log('📝 Processing transcript:', transcript);
        try {
            const stream = await openai.chat.completions.create({
                model: "gpt-3.5-turbo",
                messages: [
                    {
                        role: "system",
                        content: config.systemPrompt || "You are a helpful assistant engaging in real-time conversation. Keep responses concise and natural."
                    },
                    {
                        role: "user",
                        content: transcript
                    }
                ],
                max_tokens: 100,
                stream: true
            });
            let fullResponse = '';
            for await (const chunk of stream) {
                const content = chunk.choices[0]?.delta?.content || '';
                if (content) {
                    if (config.onResponse) {
                        config.onResponse(content);
                    }
                    fullResponse += content;
                }
            }
            if (fullResponse) {
                console.log('🔊 Converting response to speech...');
                const audioBytes = await cartesia.tts.bytes({
                    model_id: "sonic-english",
                    transcript: fullResponse,
                    voice: {
                        mode: "id",
                        id: "a0e99841-438c-4a64-b679-ae501e7d6091",
                    },
                    language: "en",
                    output_format: {
                        container: "wav",
                        sample_rate: 44100,
                        encoding: "pcm_f32le",
                    },
                });
                // Create a temporary file to store the audio
                const tempFile = path.join(__dirname, `temp-${Date.now()}.wav`);
                await fs.writeFile(tempFile, new Uint8Array(audioBytes));
                console.log('🔈 Playing audio response...');
                // Play the audio file
                player.play(tempFile, (err) => {
                    if (err) {
                        console.error('❌ Error playing audio:', err);
                        if (config.onError)
                            config.onError(err);
                    }
                    // Delete the temporary file after playing
                    fs.unlink(tempFile).catch(err => {
                        console.error('❌ Error deleting temp file:', err);
                    });
                });
            }
        }
        catch (error) {
            console.error('❌ Failed to handle transcript:', error);
            if (config.onError)
                config.onError(error);
        }
    }
    return {
        async start() {
            try {
                if (isActive) {
                    return { success: false, error: 'Agent is already active' };
                }
                console.log('🎙️ Initializing microphone...');
                try {
                    microphone = new mic();
                    console.log('✅ Microphone initialized');
                }
                catch (error) {
                    const errorMsg = 'Failed to initialize microphone. Make sure your microphone is connected and accessible.';
                    console.error('❌', errorMsg, error);
                    if (config.onError)
                        config.onError(new Error(errorMsg));
                    return { success: false, error: errorMsg };
                }
                console.log('🌐 Connecting to Deepgram...');
                try {
                    deepgramLive = await deepgram.listen.live({
                        model: "nova-3",
                        punctuate: true,
                        language: 'en-US',
                        encoding: 'linear16',
                        sample_rate: 16000,
                    });
                    console.log('✅ Deepgram connection established');
                }
                catch (error) {
                    const errorMsg = 'Failed to connect to Deepgram. Check your API key and internet connection.';
                    console.error('❌', errorMsg, error);
                    if (config.onError)
                        config.onError(new Error(errorMsg));
                    return { success: false, error: errorMsg };
                }
                deepgramLive.on(LiveTranscriptionEvents.Open, () => {
                    console.log('🎤 Deepgram WebSocket opened and ready for audio');
                });
                deepgramLive.on(LiveTranscriptionEvents.Close, () => {
                    console.log('🔴 Deepgram WebSocket closed');
                });
                deepgramLive.on(LiveTranscriptionEvents.Transcript, async (data) => {
                    console.log('📥 Raw transcription:', JSON.stringify(data));
                    try {
                        if (data.channel?.alternatives?.[0]) {
                            const transcript = data.channel.alternatives[0].transcript;
                            if (transcript.trim()) {
                                console.log('\n👤 You said:', transcript);
                                if (config.onTranscript) {
                                    config.onTranscript(transcript);
                                }
                                await handleTranscript(transcript);
                            }
                        }
                    }
                    catch (error) {
                        console.error('❌ Failed to parse transcription:', error);
                    }
                });
                deepgramLive.on(LiveTranscriptionEvents.Error, (error) => {
                    console.error('❌ Deepgram error:', error);
                    if (config.onError)
                        config.onError(error);
                });
                console.log('🎙️ Starting audio recording...');
                const audioStream = microphone.startRecording();
                console.log('✅ Audio recording started');
                if (config.onRecordingStart) {
                    config.onRecordingStart();
                }
                let lastKeepAliveTime = Date.now();
                audioStream.on('data', (data) => {
                    if (deepgramLive.getReadyState() === 1) {
                        deepgramLive.send(data);
                        // Send keep-alive every 10 seconds to prevent timeout
                        const now = Date.now();
                        if (now - lastKeepAliveTime > 10000) {
                            deepgramLive.keepAlive();
                            lastKeepAliveTime = now;
                        }
                    }
                    else {
                        console.log('⚠️ Deepgram not ready, WebSocket state:', deepgramLive.getReadyState());
                    }
                });
                audioStream.on('error', (error) => {
                    console.error('❌ Microphone error:', error);
                    if (config.onError)
                        config.onError(error);
                });
                isActive = true;
                return { success: true, message: 'Agent started and recording' };
            }
            catch (error) {
                const errorMsg = error instanceof Error ? error.message : 'Failed to start agent';
                console.error('❌ Unexpected error:', errorMsg);
                if (config.onError)
                    config.onError(new Error(errorMsg));
                return { success: false, error: errorMsg };
            }
        },
        async stop() {
            try {
                if (!isActive) {
                    return { success: false, error: 'Agent is not active' };
                }
                console.log('🛑 Stopping recording...');
                if (microphone) {
                    microphone.stopRecording();
                }
                console.log('👋 Closing Deepgram connection...');
                if (deepgramLive) {
                    deepgramLive.finish();
                    deepgramLive = null;
                }
                isActive = false;
                return { success: true, message: 'Agent stopped successfully' };
            }
            catch (error) {
                console.error('❌ Error while stopping:', error);
                return { success: false, error: 'Failed to stop agent' };
            }
        }
    };
}
