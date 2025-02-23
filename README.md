# Vulcan

[![npm version](https://badge.fury.io/js/vulcan.svg)](https://badge.fury.io/js/vulcan)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)

A real-time voice agent framework with streaming support for text and voice interactions. Built with modular services architecture for speech-to-text, language models, and text-to-speech synthesis.

## Supported Services

| Component | Supported Services |
|-----------|-------------------|
| Speech-to-Text | [Deepgram](https://deepgram.com/) |
| Language Models | [OpenAI](https://openai.com/) (GPT-3.5-turbo), [Anthropic](https://anthropic.com/) (Claude-3-Sonnet) |
| Text-to-Speech | [Cartesia](https://cartesia.io/) (sonic-english), [ElevenLabs](https://elevenlabs.io/) |

## Quick Start

```typescript
import { DeepgramService, AnthropicService, CartesiaService, Pipeline } from 'vulcan';

// Initialize services with your API keys
const pipeline = new Pipeline(
    new DeepgramService(process.env.DEEPGRAM_API_KEY),
    new AnthropicService(process.env.ANTHROPIC_API_KEY, {
        model: "claude-3-sonnet-20240229",
        systemPrompt: "You are a helpful voice assistant."
    }),
    new CartesiaService(process.env.CARTESIA_API_KEY),
    {
        onTranscript: (text) => console.log('User:', text),
        onResponse: (text) => console.log('AI:', text),
        onError: (error) => console.error('Error:', error.message)
    }
);

await pipeline.start();
```

## Environment Setup

```bash
npm install vulcan

# Create .env file with your API keys
DEEPGRAM_API_KEY=your_key
OPENAI_API_KEY=your_key
CARTESIA_API_KEY=your_key
ANTHROPIC_API_KEY=your_key
```

For detailed documentation and examples, visit our [GitHub repository](https://github.com/yourusername/vulcan).

---
Made with ❤️ using Node.js and TypeScript
