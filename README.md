# Vulcan

[![npm version](https://badge.fury.io/js/vulcan.svg)](https://badge.fury.io/js/vulcan)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)

A real-time voice agent framework with streaming support for text and voice interactions. Built with modular services architecture for speech-to-text, language models, and text-to-speech synthesis. Features conversation context management for maintaining state and history across interactions.

## Supported Services

| Component | Supported Services |
|-----------|-------------------|
| Speech-to-Text | [Deepgram](https://deepgram.com/) |
| Language Models | [OpenAI](https://openai.com/), [Anthropic](https://anthropic.com/) |
| Text-to-Speech | [Cartesia](https://cartesia.io/), [ElevenLabs](https://elevenlabs.io/) |

## Quick Start

```typescript
import { DeepgramService, AnthropicService, CartesiaService, Pipeline, ContextManager } from 'vulcan';

// Initialize context manager and services
const contextManager = new ContextManager({
    metadata: { sessionId: 'user-123' },
    messages: [{ role: 'system', content: 'You are a helpful voice assistant.', timestamp: Date.now() }]
});

// Initialize services with your API keys
const pipeline = new Pipeline(
    new DeepgramService(process.env.DEEPGRAM_API_KEY),
    new AnthropicService(process.env.ANTHROPIC_API_KEY),
    new CartesiaService(process.env.CARTESIA_API_KEY),
    {
        contextManager, // Pass the context manager to maintain conversation state
        onTranscript: (text) => console.log('User:', text),
        onResponse: (text) => console.log('AI:', text),
        onError: (error) => console.error('Error:', error.message)
    }
);

await pipeline.start();

// Access conversation history
console.log('Recent messages:', contextManager.getRecentMessages());
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
