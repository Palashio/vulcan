export interface TranscriptionConfig {
    language?: string;
    model?: string;
    punctuate?: boolean;
    encoding?: string;
    sampleRate?: number;
}

export interface TranscriptionEvents {
    onTranscript: (text: string) => void;
    onError?: (error: Error) => void;
    onClose?: () => void;
    onReady?: () => void;
}

export interface TranscriptionService {
    start(config: TranscriptionConfig): Promise<void>;
    stop(): Promise<void>;
    sendAudio(data: Buffer): void;
    isReady(): boolean;
    setEventHandlers(events: TranscriptionEvents): void;
} 