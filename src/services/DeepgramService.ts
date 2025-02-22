import { createClient, LiveTranscriptionEvents } from "@deepgram/sdk";
import { TranscriptionService, TranscriptionConfig, TranscriptionEvents } from './TranscriptionService.js';

export class DeepgramService implements TranscriptionService {
    private client: any;
    private liveTranscription: any = null;
    private events: TranscriptionEvents;

    constructor(apiKey: string, events: TranscriptionEvents) {
        this.client = createClient(apiKey);
        this.events = events;
    }

    setEventHandlers(events: TranscriptionEvents): void {
        this.events = events;
        
        // If we already have a live transcription, update its event handlers
        if (this.liveTranscription) {
            this.setupEventHandlers();
        }
    }

    async start(config: TranscriptionConfig): Promise<void> {
        try {
            this.liveTranscription = await this.client.listen.live({
                model: config.model || "nova-3",
                punctuate: config.punctuate ?? true,
                language: config.language || 'en-US',
                encoding: config.encoding || 'linear16',
                sample_rate: config.sampleRate || 16000,
            });

            this.setupEventHandlers();
        } catch (error) {
            if (this.events.onError) {
                this.events.onError(error as Error);
            }
            throw error;
        }
    }

    private setupEventHandlers(): void {
        this.liveTranscription.on(LiveTranscriptionEvents.Open, () => {
            if (this.events.onReady) {
                this.events.onReady();
            }
        });

        this.liveTranscription.on(LiveTranscriptionEvents.Close, () => {
            if (this.events.onClose) {
                this.events.onClose();
            }
        });

        this.liveTranscription.on(LiveTranscriptionEvents.Transcript, (data: any) => {
            try {
                if (data.channel?.alternatives?.[0]) {
                    const transcript = data.channel.alternatives[0].transcript;
                    if (transcript.trim()) {
                        this.events.onTranscript(transcript);
                    }
                }
            } catch (error) {
                console.error('Failed to parse transcription:', error);
                if (this.events.onError) {
                    this.events.onError(error as Error);
                }
            }
        });

        this.liveTranscription.on(LiveTranscriptionEvents.Error, (error: Error) => {
            if (this.events.onError) {
                this.events.onError(error);
            }
        });
    }

    async stop(): Promise<void> {
        if (this.liveTranscription) {
            this.liveTranscription.finish();
            this.liveTranscription = null;
        }
    }

    sendAudio(data: Buffer): void {
        if (this.isReady()) {
            this.liveTranscription.send(data);
        }
    }

    isReady(): boolean {
        return this.liveTranscription?.getReadyState() === 1;
    }
} 