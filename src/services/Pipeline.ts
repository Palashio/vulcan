import { TranscriptionService, TranscriptionConfig } from './TranscriptionService.js';
import mic from 'node-microphone';

export interface LLMConfig {
    model?: string;
    maxTokens?: number;
    systemPrompt?: string;
}

export interface LLMService {
    processText(text: string): AsyncGenerator<string>;
}

export interface TTSConfig {
    model?: string;
    voice?: {
        mode: "id";
        id: string;
    };
    language?: string;
    outputFormat?: {
        container: string;
        sample_rate: number;
        encoding: string;
    };
}

export interface TTSService {
    textToSpeech(text: string): Promise<Buffer>;
}

export interface PipelineConfig {
    transcriptionConfig?: TranscriptionConfig;
    llmConfig?: LLMConfig;
    ttsConfig?: TTSConfig;
    onTranscript?: (text: string) => void;
    onResponse?: (text: string) => void;
    onError?: (error: Error) => void;
    onAudioReady?: (audio: Buffer) => void;
}

export class Pipeline {
    private transcriptionService: TranscriptionService;
    private llmService: LLMService;
    private ttsService: TTSService;
    private config: PipelineConfig;
    private isActive: boolean = false;
    private microphone: any = null;

    constructor(
        transcriptionService: TranscriptionService,
        llmService: LLMService,
        ttsService: TTSService,
        config: PipelineConfig
    ) {
        this.transcriptionService = transcriptionService;
        this.llmService = llmService;
        this.ttsService = ttsService;
        this.config = config;

        // Set up transcription service event handlers
        this.transcriptionService.setEventHandlers({
            onTranscript: async (text) => {
                await this.processTranscript(text);
            },
            onError: (error) => this.handleError(error),
            onReady: () => console.log('🎤 Transcription service ready'),
            onClose: () => console.log('🔴 Transcription service closed')
        });
    }

    async start(): Promise<void> {
        if (this.isActive) {
            throw new Error('Pipeline is already active');
        }

        try {
            // Initialize microphone
            console.log('🎙️ Initializing microphone...');
            try {
                this.microphone = new mic();
                console.log('✅ Microphone initialized');
            } catch (error) {
                const errorMsg = 'Failed to initialize microphone. Make sure your microphone is connected and accessible.';
                console.error('❌', errorMsg, error);
                throw new Error(errorMsg);
            }

            // Start transcription service
            console.log('🌐 Starting transcription service...');
            await this.transcriptionService.start(this.config.transcriptionConfig || {
                model: "nova-3",
                punctuate: true,
                language: 'en-US',
                encoding: 'linear16',
                sampleRate: 16000,
            });

            // Start recording
            console.log('🎙️ Starting audio recording...');
            const audioStream = this.microphone.startRecording();
            console.log('✅ Audio recording started');

            audioStream.on('data', (data: Buffer) => {
                if (this.transcriptionService.isReady()) {
                    this.transcriptionService.sendAudio(data);
                }
            });

            audioStream.on('error', (error: Error) => {
                this.handleError(error);
            });

            this.isActive = true;
        } catch (error) {
            this.handleError(error as Error);
            throw error;
        }
    }

    async stop(): Promise<void> {
        if (!this.isActive) {
            return;
        }

        try {
            if (this.microphone) {
                console.log('🛑 Stopping recording...');
                this.microphone.stopRecording();
            }
            
            console.log('👋 Stopping transcription service...');
            await this.transcriptionService.stop();

            this.isActive = false;
        } catch (error) {
            this.handleError(error as Error);
            throw error;
        }
    }

    async processTranscript(text: string): Promise<void> {
        try {
            // Notify about received transcript
            if (this.config.onTranscript) {
                this.config.onTranscript(text);
            }

            // Process through LLM
            let fullResponse = '';
            for await (const chunk of this.llmService.processText(text)) {
                if (this.config.onResponse) {
                    this.config.onResponse(chunk);
                }
                fullResponse += chunk;
            }

            if (fullResponse) {
                // Convert to speech
                const audio = await this.ttsService.textToSpeech(fullResponse);
                if (this.config.onAudioReady) {
                    this.config.onAudioReady(audio);
                }
            }
        } catch (error) {
            this.handleError(error as Error);
        }
    }

    private handleError(error: Error): void {
        console.error('Pipeline error:', error);
        if (this.config.onError) {
            this.config.onError(error);
        }
    }
} 