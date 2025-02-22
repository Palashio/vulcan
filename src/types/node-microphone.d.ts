declare module 'node-microphone' {
    import { EventEmitter } from 'events';
    
    class Microphone {
        constructor(options?: Record<string, any>);
        startRecording(): EventEmitter;
        stopRecording(): void;
    }

    export = Microphone;
} 