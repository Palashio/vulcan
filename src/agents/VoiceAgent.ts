import OpenAI from 'openai';
import CartesiaClient from "@cartesia/cartesia-js";
import mic from 'node-microphone';
import playSound from 'play-sound';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { BaseAgent, AgentResponse, AgentConfig } from './BaseAgent.js';
import { TranscriptionService } from '../services/TranscriptionService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface VoiceAgentConfig extends AgentConfig {
    openaiApiKey?: string;
    cartesiaApiKey?: string;
    onTranscript?: (text: string) => void;
    onResponse?: (text: string) => void;
    onRecordingStart?: () => void;
    transcriptionService: TranscriptionService;
}

export class VoiceAgent extends BaseAgent {
    private microphone: any = null;
    private readonly player = playSound({});
    private readonly openai: OpenAI;
    private readonly cartesia: CartesiaClient;
    private readonly voiceConfig: VoiceAgentConfig;
    private readonly transcriptionService: TranscriptionService;

    constructor(config: VoiceAgentConfig) {
        super({
            systemPrompt: config.systemPrompt,
            onError: config.onError
        });
        this.voiceConfig = config;
        this.transcriptionService = config.transcriptionService;
        
        console.log('🔍 Initializing clients...');
        this.openai = new OpenAI({ apiKey: config.openaiApiKey || process.env.OPENAI_API_KEY });
        this.cartesia = new CartesiaClient({ apiKey: config.cartesiaApiKey || process.env.CARTESIA_API_KEY || '' });
        console.log('✅ Clients initialized');
    }

    async start(): Promise<AgentResponse> {
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
                if (this.voiceConfig.onError) this.voiceConfig.onError(new Error(errorMsg));
                return { success: false, error: errorMsg };
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
                if (this.voiceConfig.onError) this.voiceConfig.onError(new Error(errorMsg));
                return { success: false, error: errorMsg };
            }

            console.log('🎙️ Starting audio recording...');
            const audioStream = this.microphone.startRecording();
            console.log('✅ Audio recording started');
            
            if (this.voiceConfig.onRecordingStart) {
                this.voiceConfig.onRecordingStart();
            }

            audioStream.on('data', (data: Buffer) => {
                if (this.transcriptionService.isReady()) {
                    this.transcriptionService.sendAudio(data);
                } else {
                    console.log('⚠️ Transcription service not ready');
                }
            });

            audioStream.on('error', (error: Error) => {
                console.error('❌ Microphone error:', error);
                if (this.voiceConfig.onError) this.voiceConfig.onError(error);
            });

            this.isActive = true;
            return { success: true, message: 'Agent started and recording' };
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Failed to start agent';
            console.error('❌ Unexpected error:', errorMsg);
            if (this.voiceConfig.onError) this.voiceConfig.onError(new Error(errorMsg));
            return { success: false, error: errorMsg };
        }
    }

    async stop(): Promise<AgentResponse> {
        try {
            if (!this.isActive) {
                return { success: false, error: 'Agent is not active' };
            }

            console.log('🛑 Stopping recording...');
            if (this.microphone) {
                this.microphone.stopRecording();
            }
            
            console.log('👋 Stopping transcription service...');
            await this.transcriptionService.stop();

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
                        content: this.voiceConfig.systemPrompt || "You are a helpful assistant engaging in real-time conversation. Keep responses concise and natural."
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
                    if (this.voiceConfig.onResponse) {
                        this.voiceConfig.onResponse(content);
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
                        if (this.voiceConfig.onError) this.voiceConfig.onError(err);
                    }
                    // Delete the temporary file after playing
                    fs.unlink(tempFile).catch(err => {
                        console.error('❌ Error deleting temp file:', err);
                    });
                });
            }
        } catch (error) {
            console.error('❌ Failed to handle transcript:', error);
            if (this.voiceConfig.onError) this.voiceConfig.onError(error as Error);
        }
    }
} 