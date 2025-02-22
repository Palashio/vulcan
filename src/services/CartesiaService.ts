import CartesiaClient from "@cartesia/cartesia-js";
import { TTSService, TTSConfig } from './Pipeline.js';

export class CartesiaService implements TTSService {
    private client: CartesiaClient;
    private config: TTSConfig;

    constructor(apiKey: string, config: TTSConfig = {}) {
        this.client = new CartesiaClient({ apiKey });
        this.config = config;
    }

    async textToSpeech(text: string): Promise<Buffer> {
        const audioBytes = await this.client.tts.bytes({
            model_id: this.config.model || "sonic-english",
            transcript: text,
            voice: this.config.voice || {
                mode: "id" as const,
                id: "a0e99841-438c-4a64-b679-ae501e7d6091",
            },
            language: this.config.language || "en",
            output_format: this.config.outputFormat || {
                container: "wav",
                sample_rate: 44100,
                encoding: "pcm_f32le",
            },
        });

        return Buffer.from(audioBytes);
    }
} 