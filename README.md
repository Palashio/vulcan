# Vulcan

[![npm version](https://badge.fury.io/js/vulcan.svg)](https://badge.fury.io/js/vulcan)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)

## Features

- 🎙️ Real-time speech-to-text using Deepgram
- 🤖 Language processing with OpenAI GPT models
- 🗣️ Text-to-speech synthesis using Cartesia
- 📦 Modular service architecture
- 🔄 Streaming responses for better UX
- 🎯 Easy-to-use pipeline system

## Installation

```bash
npm install vulcan
```

## Quick Start

```typescript
import {
    DeepgramService,
    OpenAIService,
    CartesiaService,
    Pipeline
} from 'vulcan';

// Initialize services
const transcriptionService = new DeepgramService(process.env.DEEPGRAM_API_KEY);
const llmService = new OpenAIService(process.env.OPENAI_API_KEY);
const ttsService = new CartesiaService(process.env.CARTESIA_API_KEY);

// Create the pipeline
const pipeline = new Pipeline(
    transcriptionService,
    llmService,
    ttsService,
    {
        onTranscript: (text) => console.log('User said:', text),
        onResponse: (text) => console.log('AI responds:', text),
        onError: (error) => console.error('Error:', error.message),
        onAudioReady: (audio) => playAudio(audio)
    }
);

// Start the pipeline
await pipeline.start();
```

## API Documentation

### Pipeline

The main class that orchestrates the voice agent workflow.

```typescript
const pipeline = new Pipeline(
    transcriptionService,  // implements TranscriptionService
    llmService,           // implements LLMService
    ttsService,           // implements TTSService
    config                // PipelineConfig
);
```

#### Configuration

```typescript
interface PipelineConfig {
    transcriptionConfig?: TranscriptionConfig;
    llmConfig?: LLMConfig;
    ttsConfig?: TTSConfig;
    onTranscript?: (text: string) => void;
    onResponse?: (text: string) => void;
    onError?: (error: Error) => void;
    onAudioReady?: (audio: Buffer) => void;
}
```

### Services

#### DeepgramService

Handles real-time speech-to-text transcription.

```typescript
const transcriptionService = new DeepgramService(apiKey, {
    onTranscript: (text) => console.log(text),
    onError: (error) => console.error(error),
    onReady: () => console.log('Ready'),
    onClose: () => console.log('Closed')
});
```

#### OpenAIService

Processes text using OpenAI's GPT models.

```typescript
const llmService = new OpenAIService(apiKey, {
    model: "gpt-3.5-turbo",
    maxTokens: 100,
    systemPrompt: "You are a helpful assistant."
});
```

#### CartesiaService

Converts text to speech.

```typescript
const ttsService = new CartesiaService(apiKey, {
    model: "sonic-english",
    voice: {
        mode: "id",
        id: "your-voice-id"
    }
});
```

## Examples

Check out the [examples](./examples) directory for complete usage examples:

- `voice-agent.ts`: A complete voice agent implementation

## Environment Variables

Create a `.env` file with your API keys:

```env
DEEPGRAM_API_KEY=your_deepgram_key
OPENAI_API_KEY=your_openai_key
CARTESIA_API_KEY=your_cartesia_key
```

## Development

```bash
# Install dependencies
npm install

# Build the package
npm run build

# Run the example
npm run example

# Watch mode
npm run dev
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the ISC License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Deepgram](https://deepgram.com/) for real-time speech-to-text
- [OpenAI](https://openai.com/) for language processing
- [Cartesia](https://cartesia.io/) for text-to-speech synthesis

---

Made with ❤️ using Node.js and TypeScript
