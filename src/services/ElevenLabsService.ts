import { TTSService, TTSConfig } from './Pipeline.js';

export interface ElevenLabsConfig extends TTSConfig {
    modelId?: string;
    voiceId?: string;
    stability?: number;
    similarityBoost?: number;
}

export class ElevenLabsService implements TTSService {
    private apiKey: string;
    private config: ElevenLabsConfig;
    private baseUrl = 'https://api.elevenlabs.io/v1';

    constructor(apiKey: string, config: ElevenLabsConfig = {}) {
        this.apiKey = apiKey;
        this.config = {
            modelId: config.modelId || 'eleven_monolingual_v1',
            voiceId: config.voiceId || '21m00Tcm4TlvDq8ikWAM', // Rachel voice
            stability: config.stability || 0.5,
            similarityBoost: config.similarityBoost || 0.75,
            ...config
        };
    }

    async textToSpeech(text: string): Promise<Buffer> {
        const url = `${this.baseUrl}/text-to-speech/${this.config.voiceId}/stream`;
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Accept': 'audio/mpeg',
                'Content-Type': 'application/json',
                'xi-api-key': this.apiKey
            },
            body: JSON.stringify({
                text,
                model_id: this.config.modelId,
                voice_settings: {
                    stability: this.config.stability,
                    similarity_boost: this.config.similarityBoost
                }
            })
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`ElevenLabs API error: ${error}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        return Buffer.from(arrayBuffer);
    }
} 