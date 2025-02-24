declare module 'node-vad' {
    enum Mode {
        NORMAL,
        LOW_BITRATE,
        AGGRESSIVE,
        VERY_AGGRESSIVE
    }

    enum Event {
        SILENCE,
        VOICE,
        ERROR
    }

    class VAD {
        constructor(mode: Mode);
        processAudio(buffer: Buffer, sampleRate: number): Event;
    }

    namespace VAD {
        export { Mode, Event };
    }

    export = VAD;
} 