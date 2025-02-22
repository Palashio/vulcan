import { Deepgram } from '@deepgram/sdk';
import OpenAI from 'openai';
import CartesiaClient from "@cartesia/cartesia-js";
import mic from 'node-microphone';

export interface AgentConfig {
    deepgramApiKey: string;
    openaiApiKey: string;
    cartesiaApiKey: string;
    systemPrompt?: string;
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
    message?: string;
    error?: string;
}

export interface IAgent {
    initialize(): Promise<AgentResponse>;
    start(): Promise<AgentResponse>;
    stop(): Promise<AgentResponse>;
    handleTranscript(transcript: string): Promise<void>;
} 