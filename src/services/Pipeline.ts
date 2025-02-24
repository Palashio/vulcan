import { TranscriptionService, TranscriptionConfig } from './TranscriptionService.js';
import { ContextManager } from './ContextManager.js';
import { VADService, VADConfig } from './VADService.js';
export { ContextManager };
import readline from 'readline';

export interface LLMConfig {
    model?: string;
    maxTokens?: number;
    systemPrompt?: string;
    tools?: FunctionTool[];
    functionHandlers?: Record<string, (args: any) => void>;
}

export interface FunctionTool {
    name: string;
    description: string;
    parameters: Record<string, any>;
}

export interface LLMResponse {
    content?: string;
    functionCall?: {
        name: string;
        arguments: string;
    };
}

export interface LLMService {
    processText(text: string, tools?: FunctionTool[]): AsyncGenerator<LLMResponse>;
    tools?: FunctionTool[];
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

export interface TextChatOptions {
    prompt?: string;
    exitCommand?: string;
    startMessage?: string;
}

export interface PipelineConfig {
    transcriptionConfig?: TranscriptionConfig;
    llmConfig?: LLMConfig;
    ttsConfig?: TTSConfig;
    vadConfig?: VADConfig;
    textOnly?: boolean;
    textChatOptions?: TextChatOptions;
    contextManager?: ContextManager;
    onTranscript?: (text: string) => void;
    onResponse?: (text: string) => void;
    onError?: (error: Error) => void;
    onAudioReady?: (audio: Buffer) => void;
}

export class Pipeline {
    private transcriptionService: TranscriptionService;
    private llmService: LLMService;
    private ttsService: TTSService;
    public vadService: VADService;
    private config: PipelineConfig;
    private contextManager: ContextManager | undefined;
    private isActive: boolean = false;
    private rl: readline.Interface | null = null;

    constructor(
        transcriptionService: TranscriptionService,
        llmService: LLMService,
        ttsService: TTSService,
        config: PipelineConfig,
        contextManager?: ContextManager
    ) {
        this.transcriptionService = transcriptionService;
        this.llmService = llmService;
        this.ttsService = ttsService;
        this.config = config;
        
        // Initialize VAD service
        this.vadService = new VADService({
            onSpeechStart: () => {
                console.log('[PIPELINE] Speech detected, starting transcription...');
            },
            onSpeechEnd: async (audio: Float32Array) => {
                console.log('[PIPELINE] Speech ended, processing audio...');
                // Convert Float32Array to Buffer for transcription
                const buffer = Buffer.from(audio.buffer);
                if (this.transcriptionService.isReady()) {
                    await this.transcriptionService.sendAudio(buffer);
                }
            },
            ...config.vadConfig
        });
        
        // Initialize context manager from either source
        this.contextManager = contextManager || config.contextManager;
        if (this.contextManager) {
            console.log('[INIT] Initializing context manager');
            this.contextManager.setLLMService(llmService);
        }

        // Set default handlers for text-only mode
        if (config.textOnly) {
            config = {
                ...config,
                onResponse: config.onResponse || ((text) => process.stdout.write(text)),
                textChatOptions: {
                    prompt: '> ',
                    exitCommand: 'exit',
                    startMessage: '[SYSTEM] Interactive chat session started\n[SYSTEM] Type your messages and press Enter\n[SYSTEM] Type "exit" to quit\n',
                    ...config.textChatOptions
                }
            };
        }
        
        // Set up transcription service event handlers if not in text-only mode
        if (!config.textOnly) {
            this.transcriptionService.setEventHandlers({
                onTranscript: async (text) => {
                    await this.processTranscript(text);
                },
                onError: (error) => this.handleError(error),
                onReady: () => console.log('[STT] Transcription service ready'),
                onClose: () => console.log('[STT] Transcription service closed')
            });
        }
    }

    async start(): Promise<void> {
        if (this.isActive) {
            throw new Error('Pipeline is already active');
        }

        try {
            if (!this.config.textOnly) {
                // Start VAD service
                console.log('[INIT] Starting voice activity detection');
                await this.vadService.start();

                // Start transcription service
                console.log('[STT] Starting transcription service');
                await this.transcriptionService.start(this.config.transcriptionConfig || {
                    model: "nova-3",
                    punctuate: true,
                    language: 'en-US',
                    encoding: 'linear16',
                    sampleRate: 16000,
                });
            } else {
                console.log('\n[INIT] Starting pipeline in text-only mode');
                console.log('[SYSTEM] ----------------------------------------\n');
            }

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
            if (!this.config.textOnly) {
                console.log('👋 Stopping VAD service...');
                await this.vadService.stop();
                
                console.log('👋 Stopping transcription service...');
                await this.transcriptionService.stop();
            }

            if (this.rl) {
                this.rl.close();
                this.rl = null;
            }

            this.isActive = false;
        } catch (error) {
            this.handleError(error as Error);
            throw error;
        }
    }

    async processTranscript(text: string): Promise<void> {
        try {
            // Print user input
            if (this.config.textOnly) {
                console.log('\n[USER] Input:', text);
            } else if (this.config.onTranscript) {
                this.config.onTranscript(text);
            }

            // Process through ContextManager or directly through LLM
            if (this.config.textOnly) {
                console.log('\n[ASSISTANT] Response:');
            }
            let fullResponse = '';
            
            const responseGenerator = this.contextManager 
                ? this.contextManager.processWithContext(text, this.llmService.tools)
                : this.llmService.processText(text);

            for await (const chunk of responseGenerator) {
                // Print response chunks
                if (chunk.content) {
                    if (this.config.textOnly) {
                        process.stdout.write(chunk.content);
                    } else if (this.config.onResponse) {
                        this.config.onResponse(chunk.content);
                    }
                    fullResponse += chunk.content;
                }
            }

            // Log the final context state if using context manager
            if (this.contextManager) {
                console.log('\n[CONTEXT] Latest messages:', this.contextManager.getRecentMessages());
                if (fullResponse) {
                    console.log('\n[ASSISTANT] Full response:', fullResponse);
                }
            }

            if (fullResponse) {
                // Convert to speech
                if (this.config.textOnly) {
                    console.log('\n'); // Add spacing before audio notification
                }
                const audio = await this.ttsService.textToSpeech(fullResponse);
                if (this.config.onAudioReady) {
                    this.config.onAudioReady(audio);
                }
            }
        } catch (error) {
            this.handleError(error as Error);
        }
    }

    async sendText(text: string): Promise<void> {
        if (!this.isActive) {
            throw new Error('Pipeline is not active. Call start() first.');
        }

        if (!this.config.textOnly) {
            throw new Error('sendText() is only available in text-only mode');
        }

        await this.processTranscript(text);
    }

    async startTextChat(): Promise<void> {
        if (!this.config.textOnly) {
            throw new Error('Text chat is only available in text-only mode');
        }

        if (this.rl) {
            throw new Error('Text chat is already active');
        }

        await this.start();

        // Create readline interface
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        const { prompt = '> ', exitCommand = 'exit', startMessage = '[SYSTEM] Interactive chat session started\n[SYSTEM] Type your messages and press Enter\n[SYSTEM] Type "exit" to quit\n' } = this.config.textChatOptions || {};

        console.log(startMessage);
        this.rl.setPrompt(prompt);
        this.rl.prompt();

        // Handle user input
        this.rl.on('line', async (input) => {
            if (input.toLowerCase() === exitCommand) {
                console.log('\n[SYSTEM] ----------------------------------------');
                console.log('[SYSTEM] Ending chat session...');
                await this.stop();
                this.rl?.close();
                return;
            }

            try {
                await this.sendText(input);
                this.rl?.prompt();
            } catch (error) {
                console.error('[ERROR] Error processing input:', error);
                this.rl?.prompt();
            }
        });

        // Handle readline close
        this.rl.on('close', () => {
            console.log('[SYSTEM] Chat session ended. Goodbye!\n');
            process.exit(0);
        });
    }

    async startVoiceChat(): Promise<void> {
        if (this.config.textOnly) {
            throw new Error('Voice chat is not available in text-only mode');
        }

        if (this.isActive) {
            throw new Error('Pipeline is already active');
        }

        try {
            console.log('\n[INIT] Starting voice chat...');
            console.log('[SYSTEM] ----------------------------------------');
            console.log('[SYSTEM] Voice chat started. Start speaking when ready.');
            console.log('[SYSTEM] Press Ctrl+C to exit.');
            
            await this.start();

            // Keep the process running
            return new Promise((resolve) => {
                process.on('SIGINT', async () => {
                    console.log('\n[SYSTEM] ----------------------------------------');
                    console.log('[SYSTEM] Stopping voice chat...');
                    await this.stop();
                    console.log('[SYSTEM] Voice chat ended. Goodbye!\n');
                    resolve();
                    process.exit(0);
                });
            });
        } catch (error) {
            this.handleError(error as Error);
            throw error;
        }
    }

    private handleError(error: Error): void {
        if (this.config.textOnly) {
            console.log('\n[SYSTEM] ----------------------------------------');
        }
        console.error('[ERROR]:', error);
        if (this.config.onError) {
            this.config.onError(error);
        }
    }

    setAudioPlayingState(isPlaying: boolean) {
        this.vadService.setAudioPlayingState(isPlaying);
    }
} 