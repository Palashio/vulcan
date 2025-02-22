import { createClient, LiveTranscriptionEvents } from "@deepgram/sdk";
import OpenAI from 'openai';
import CartesiaClient from "@cartesia/cartesia-js";
import mic from 'node-microphone';
import playSound from 'play-sound';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { BaseAgent, AgentResponse } from './BaseAgent.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface VoiceAgentConfig {
    deepgramApiKey?: string;
    openaiApiKey?: string;
    cartesiaApiKey?: string;
    systemPrompt?: string;
    onTranscript?: (text: string) => void;
    onResponse?: (text: string) => void;
    onError?: (error: Error) => void;
    onRecordingStart?: () => void;
}

export interface VoiceAgentResponse {
    success: boolean;
    message?: string;
    error?: string;
}

export interface VoiceAgent {
    start(): Promise<VoiceAgentResponse>;
    stop(): Promise<VoiceAgentResponse>;
}

export class VoiceAgent extends BaseAgent {
    private microphone: any = null;
    private deepgramLive: any = null;
    private readonly player = playSound({});
    private readonly deepgram: any;
    private readonly openai: OpenAI;
    private readonly cartesia: CartesiaClient;
    private readonly config: VoiceAgentConfig;
    protected isActive: boolean = false;

    constructor(config: VoiceAgentConfig = {}) {
        super({
            systemPrompt: config.systemPrompt,
            onError: config.onError
        });
        this.config = config;
        
        console.log('🔍 Initializing clients...');
        this.deepgram = createClient(config.deepgramApiKey || process.env.DEEPGRAM_API_KEY || '');
        this.openai = new OpenAI({ apiKey: config.openaiApiKey || process.env.OPENAI_API_KEY });
        this.cartesia = new CartesiaClient({ apiKey: config.cartesiaApiKey || process.env.CARTESIA_API_KEY || '' });
        console.log('✅ Clients initialized');
    }

    async start(): Promise<VoiceAgentResponse> {
        try {
            if (this.isActive) {
                return { success: false, error: 'Agent is already active' };
            }

            console.log('🎙️ Initializing microphone...');
            try {
                this.microphone = new mic();
                console.log('✅ Microphone initialized');
            } catch (error) {
                const errorMsg = 'Failed to initialize microphone. Make sure your microphone is connected and accessible.';
                console.error('❌', errorMsg, error);
                if (this.config.onError) this.config.onError(new Error(errorMsg));
                return { success: false, error: errorMsg };
            }
            
            console.log('🌐 Connecting to Deepgram...');
            try {
                this.deepgramLive = await this.deepgram.listen.live({
                    model: "nova-3",
                    punctuate: true,
                    language: 'en-US',
                    encoding: 'linear16',
                    sample_rate: 16000,
                });
                console.log('✅ Deepgram connection established');
            } catch (error) {
                const errorMsg = 'Failed to connect to Deepgram. Check your API key and internet connection.';
                console.error('❌', errorMsg, error);
                if (this.config.onError) this.config.onError(new Error(errorMsg));
                return { success: false, error: errorMsg };
            }

            this.deepgramLive.on(LiveTranscriptionEvents.Open, () => {
                console.log('🎤 Deepgram WebSocket opened and ready for audio');
            });

            this.deepgramLive.on(LiveTranscriptionEvents.Close, () => {
                console.log('🔴 Deepgram WebSocket closed');
            });

            this.deepgramLive.on(LiveTranscriptionEvents.Transcript, async (data: any) => {
                console.log('📥 Raw transcription:', JSON.stringify(data));
                try {
                    if (data.channel?.alternatives?.[0]) {
                        const transcript = data.channel.alternatives[0].transcript;
                        if (transcript.trim()) {
                            console.log('\n👤 You said:', transcript);
                            if (this.config.onTranscript) {
                                this.config.onTranscript(transcript);
                            }
                            await this.handleTranscript(transcript);
                        }
                    }
                } catch (error) {
                    console.error('❌ Failed to parse transcription:', error);
                }
            });

            this.deepgramLive.on(LiveTranscriptionEvents.Error, (error: Error) => {
                console.error('❌ Deepgram error:', error);
                if (this.config.onError) this.config.onError(error);
            });

            console.log('🎙️ Starting audio recording...');
            const audioStream = this.microphone.startRecording();
            console.log('✅ Audio recording started');
            
            if (this.config.onRecordingStart) {
                this.config.onRecordingStart();
            }

            let lastKeepAliveTime = Date.now();
            audioStream.on('data', (data: Buffer) => {
                if (this.deepgramLive.getReadyState() === 1) {
                    this.deepgramLive.send(data);
                    
                    // Send keep-alive every 10 seconds to prevent timeout
                    const now = Date.now();
                    if (now - lastKeepAliveTime > 10000) {
                        this.deepgramLive.keepAlive();
                        lastKeepAliveTime = now;
                    }
                } else {
                    console.log('⚠️ Deepgram not ready, WebSocket state:', this.deepgramLive.getReadyState());
                }
            });

            audioStream.on('error', (error: Error) => {
                console.error('❌ Microphone error:', error);
                if (this.config.onError) this.config.onError(error);
            });

            this.isActive = true;
            return { success: true, message: 'Agent started and recording' };
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Failed to start agent';
            console.error('❌ Unexpected error:', errorMsg);
            if (this.config.onError) this.config.onError(new Error(errorMsg));
            return { success: false, error: errorMsg };
        }
    }

    async stop(): Promise<VoiceAgentResponse> {
        try {
            if (!this.isActive) {
                return { success: false, error: 'Agent is not active' };
            }

            console.log('🛑 Stopping recording...');
            if (this.microphone) {
                this.microphone.stopRecording();
            }
            
            console.log('👋 Closing Deepgram connection...');
            if (this.deepgramLive) {
                this.deepgramLive.finish();
                this.deepgramLive = null;
            }

            this.isActive = false;
            return { success: true, message: 'Agent stopped successfully' };
        } catch (error) {
            console.error('❌ Error while stopping:', error);
            return { success: false, error: 'Failed to stop agent' };
        }
    }

    async handleTranscript(transcript: string): Promise<void> {
        console.log('📝 Processing transcript:', transcript);
        try {
            const stream = await this.openai.chat.completions.create({
                model: "gpt-3.5-turbo",
                messages: [
                    {
                        role: "system",
                        content: this.config.systemPrompt || "You are a helpful assistant engaging in real-time conversation. Keep responses concise and natural."
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
                    if (this.config.onResponse) {
                        this.config.onResponse(content);
                    }
                    fullResponse += content;
                }
            }

            if (fullResponse) {
                console.log('🔊 Converting response to speech...');
                const audioBytes = await this.cartesia.tts.bytes({
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
                this.player.play(tempFile, (err?: Error) => {
                    if (err) {
                        console.error('❌ Error playing audio:', err);
                        if (this.config.onError) this.config.onError(err);
                    }
                    // Delete the temporary file after playing
                    fs.unlink(tempFile).catch(err => {
                        console.error('❌ Error deleting temp file:', err);
                    });
                });
            }
        } catch (error) {
            console.error('❌ Failed to handle transcript:', error);
            if (this.config.onError) this.config.onError(error as Error);
        }
    }
} 