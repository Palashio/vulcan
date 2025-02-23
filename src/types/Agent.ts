import type { TranscriptionService } from '../services/TranscriptionService.js';

export interface AgentConfig {
    systemPrompt: string;
    onError?: (error: Error) => void;
}

export interface VoiceAgentConfig extends AgentConfig {
    openaiApiKey?: string;
    cartesiaApiKey?: string;
    transcriptionService: TranscriptionService;
    onTranscript?: (text: string) => void;
    onResponse?: (text: string) => void;
    onRecordingStart?: () => void;
}

export interface AgentState {
    isActive: boolean;
    microphone: any;
    deepgramLive: any;
}

export interface TranscriptData {
    channel?: {
        alternatives?: Array<{
            transcript: string;
        }>;
    };
}

export interface AgentResponse {
    success: boolean;
    error?: string;
    message?: string;
}

export abstract class BaseAgent {
    protected systemPrompt: string;
    protected onError: ((error: Error) => void) | undefined;

    constructor(config: AgentConfig) {
        if (!config.systemPrompt) {
            throw new Error('System prompt is required');
        }
        this.systemPrompt = config.systemPrompt;
        this.onError = config.onError;
    }

    abstract start(): Promise<AgentResponse>;
    abstract stop(): Promise<AgentResponse>;
}

export interface IAgent {
    initialize(): Promise<AgentResponse>;
    start(): Promise<AgentResponse>;
    stop(): Promise<AgentResponse>;
    handleTranscript(transcript: string): Promise<void>;
} 