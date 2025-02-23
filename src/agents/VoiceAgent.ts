import OpenAI from 'openai';
import CartesiaClient from "@cartesia/cartesia-js";
import mic from 'node-microphone';
import playSound from 'play-sound';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { BaseAgent, VoiceAgentConfig, AgentResponse } from '../types/Agent.js';
import { TranscriptionService } from '../services/TranscriptionService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class VoiceAgent extends BaseAgent {
    private openai: OpenAI;
    private cartesia: CartesiaClient;
    private isActive: boolean = false;
    private microphone: InstanceType<typeof mic> | null = null;
    private readonly config: VoiceAgentConfig;
    private readonly player = playSound({});
    private readonly transcriptionService: TranscriptionService;

    constructor(config: VoiceAgentConfig) {
        if (!config.systemPrompt) {
            throw new Error('System prompt is required');
        }

        super(config);
        this.config = config;
        this.transcriptionService = config.transcriptionService;
        
        console.log('🔍 Initializing clients...');
        this.openai = new OpenAI({ 
            apiKey: config.openaiApiKey || process.env['OPENAI_API_KEY'] || ''
        });
        this.cartesia = new CartesiaClient({ 
            apiKey: config.cartesiaApiKey || process.env['CARTESIA_API_KEY'] || ''
        });
        console.log('✅ Clients initialized');
    }

    async start(): Promise<AgentResponse> {
        if (this.isActive) {
            return { success: false, error: 'Agent is already active' };
        }

        try {
            console.log('🎙️ Initializing microphone...');
            try {
                this.microphone = new mic();
                console.log('✅ Microphone initialized');
                if (this.config.onRecordingStart) {
                    this.config.onRecordingStart();
                }
            } catch (error) {
                const errorMsg = 'Failed to initialize microphone. Make sure your microphone is connected and accessible.';
                console.error('❌', errorMsg, error);
                throw new Error(errorMsg);
            }
            
            console.log('🌐 Starting transcription service...');
            try {
                await this.transcriptionService.start({
                    model: "nova-3",
                    punctuate: true,
                    language: 'en-US',
                    encoding: 'linear16',
                    sampleRate: 16000,
                });
                console.log('✅ Transcription service started');
            } catch (error) {
                const errorMsg = 'Failed to start transcription service';
                console.error('❌', errorMsg, error);
                if (this.config.onError) this.config.onError(new Error(errorMsg));
                return { success: false, error: errorMsg };
            }

            console.log('🎙️ Starting audio recording...');
            const audioStream = this.microphone.startRecording();
            console.log('✅ Audio recording started');
            
            audioStream.on('data', async (data: Buffer) => {
                try {
                    if (this.transcriptionService.isReady()) {
                        this.transcriptionService.sendAudio(data);
                    } else {
                        console.log('⚠️ Transcription service not ready');
                    }
                } catch (error) {
                    console.error('❌ Microphone error:', error);
                    if (this.config.onError) this.config.onError(error instanceof Error ? error : new Error('Failed to process audio'));
                }
            });

            audioStream.on('error', (error: Error) => {
                console.error('❌ Microphone error:', error);
                if (this.config.onError) this.config.onError(error);
            });

            this.isActive = true;
            return { success: true, message: 'Voice agent started successfully' };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to start voice agent';
            console.error('❌ Unexpected error:', errorMessage);
            if (this.config.onError) this.config.onError(new Error(errorMessage));
            return { success: false, error: errorMessage };
        }
    }

    async stop(): Promise<AgentResponse> {
        if (!this.isActive) {
            return { success: false, error: 'Agent is not active' };
        }

        try {
            console.log('🛑 Stopping recording...');
            if (this.microphone) {
                this.microphone.stopRecording();
            }
            
            console.log('👋 Stopping transcription service...');
            await this.transcriptionService.stop();

            this.isActive = false;
            return { success: true, message: 'Voice agent stopped successfully' };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to stop voice agent';
            console.error('❌ Error while stopping:', errorMessage);
            if (this.config.onError) this.config.onError(new Error(errorMessage));
            return { success: false, error: errorMessage };
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