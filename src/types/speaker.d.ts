declare module 'speaker' {
    interface SpeakerOptions {
        channels?: number;
        bitDepth?: number;
        sampleRate?: number;
        signed?: boolean;
        float?: boolean;
        samplesPerFrame?: number;
        device?: string;
        format?: string;
    }

    class Speaker {
        constructor(options?: SpeakerOptions);
        write(chunk: Buffer): boolean;
        end(): void;
    }

    export = Speaker;
} 