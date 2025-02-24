import vad from 'node-vad';
import mic from 'node-microphone';
import { EventEmitter } from 'events';

export interface VADConfig {
    onSpeechStart?: () => void;
    onSpeechEnd?: (audio: Float32Array) => void;
    onVADMisfire?: () => void;
    onInterrupt?: () => void;
}

export class VADService extends EventEmitter {
    private vadInstance: any;
    private microphone: any;
    private config: VADConfig;
    private isActive: boolean = false;
    private audioBuffer: Buffer[] = [];
    private isSpeaking: boolean = false;
    private isAudioPlaying: boolean = false;

    constructor(config: VADConfig = {}) {
        super();
        this.config = config;
        this.vadInstance = new vad(vad.Mode.NORMAL);
    }

    setAudioPlayingState(isPlaying: boolean) {
        this.isAudioPlaying = isPlaying;
    }

    async start(): Promise<void> {
        if (this.isActive) {
            throw new Error('VAD is already active');
        }

        try {
            console.log('[VAD] Initializing voice activity detection...');
            this.microphone = new mic();
            
            this.microphone.audioStream.on('data', (data: Buffer) => {
                if (!this.isActive) return;

                const vadResult = this.vadInstance.processAudio(data, 16000);
                
                if (vadResult === vad.Event.VOICE) {
                    if (!this.isSpeaking) {
                        console.log('[VAD] Speech started');
                        this.isSpeaking = true;
                        this.audioBuffer = [];
                        
                        // If audio is playing, emit interrupt event
                        if (this.isAudioPlaying) {
                            console.log('[VAD] Interrupting audio playback...');
                            this.emit('interrupt');
                            this.config.onInterrupt?.();
                        }
                        
                        this.config.onSpeechStart?.();
                    }
                    this.audioBuffer.push(data);
                } else if (vadResult === vad.Event.SILENCE) {
                    if (this.isSpeaking) {
                        console.log('[VAD] Speech ended');
                        this.isSpeaking = false;
                        // Convert buffer to Float32Array
                        const concatenatedBuffer = Buffer.concat(this.audioBuffer);
                        const float32Array = new Float32Array(concatenatedBuffer.buffer);
                        this.config.onSpeechEnd?.(float32Array);
                        this.audioBuffer = [];
                    }
                }
            });

            this.microphone.audioStream.on('error', (error: Error) => {
                console.error('[VAD] Microphone error:', error);
                this.stop();
            });

            console.log('[VAD] Starting voice activity detection');
            this.microphone.startRecording();
            this.isActive = true;
            console.log('[VAD] Voice activity detection started');
        } catch (error) {
            console.error('[VAD] Error starting voice activity detection:', error);
            throw error;
        }
    }

    async stop(): Promise<void> {
        if (!this.isActive) {
            return;
        }

        try {
            console.log('[VAD] Stopping voice activity detection');
            this.microphone.stopRecording();
            this.isActive = false;
            this.isSpeaking = false;
            this.audioBuffer = [];
            this.isAudioPlaying = false;
            console.log('[VAD] Voice activity detection stopped');
        } catch (error) {
            console.error('[VAD] Error stopping voice activity detection:', error);
            throw error;
        }
    }

    isReady(): boolean {
        return this.isActive;
    }
} 