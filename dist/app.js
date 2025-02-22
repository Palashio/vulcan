import 'dotenv/config';
import http from 'http';
import mic from 'node-microphone';
import pkg from '@deepgram/sdk';
import OpenAI from 'openai';
import CartesiaClient from "@cartesia/cartesia-js";
import playSound from 'play-sound';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const { createClient } = pkg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const port = 3000;
const player = playSound({});
let currentAudioProcess = null; // Track current audio process
// Initialize Deepgram
const deepgram = createClient(process.env.DEEPGRAM_API_KEY || '');
// Initialize OpenAI
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});
// Initialize Cartesia
const cartesia = new CartesiaClient({
    apiKey: process.env.CARTESIA_API_KEY || ''
});
// Function to stop current audio playback
function stopCurrentAudio() {
    if (currentAudioProcess) {
        currentAudioProcess.kill();
        currentAudioProcess = null;
    }
}
let microphone = null;
let deepgramLive = null;
let websocket = null;
async function initializeCartesia() {
    try {
        websocket = cartesia.tts.websocket({
            container: "raw",
            encoding: "pcm_f32le",
            sampleRate: 44100,
        });
        await websocket.connect();
        console.log('Cartesia WebSocket connected');
    }
    catch (error) {
        console.error('Failed to connect to Cartesia:', error);
    }
}
// Function to stream response from OpenAI and play TTS
async function streamOpenAIResponse(text) {
    try {
        const stream = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
                {
                    role: "system",
                    content: "You are a helpful assistant engaging in real-time conversation. Keep responses concise and natural, as if in a real conversation."
                },
                {
                    role: "user",
                    content: text
                }
            ],
            max_tokens: 100,
            stream: true
        });
        process.stdout.write('Assistant: ');
        let fullResponse = '';
        for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || '';
            if (content) {
                process.stdout.write(content);
                fullResponse += content;
            }
        }
        console.log('\n');
        // Generate and play TTS using Cartesia
        if (fullResponse) {
            try {
                const response = await cartesia.tts.bytes({
                    model_id: "sonic-english",
                    transcript: fullResponse,
                    voice: {
                        mode: "id",
                        id: "a0e99841-438c-4a64-b679-ae501e7d6091",
                    },
                    language: "en",
                    output_format: {
                        container: "wav",
                        sample_rate: 44100,
                        encoding: "pcm_f32le",
                    },
                });
                // Create a temporary file to store the audio
                const tempFile = path.join(__dirname, `temp-${Date.now()}.wav`);
                await fs.writeFile(tempFile, new Uint8Array(response));
                // Stop any currently playing audio
                stopCurrentAudio();
                // Play the audio file and store the process
                currentAudioProcess = player.play(tempFile, async (err) => {
                    if (err)
                        console.error('Error playing audio:', err);
                    currentAudioProcess = null;
                    // Delete the temporary file after playing
                    try {
                        await fs.unlink(tempFile);
                    }
                    catch (err) {
                        console.error('Error deleting temp file:', err);
                    }
                });
            }
            catch (error) {
                console.error('TTS error:', error);
            }
        }
    }
    catch (error) {
        console.error('API error:', error);
        console.log('Assistant: Sorry, I had trouble processing that.');
    }
}
async function startRecording() {
    try {
        microphone = new mic();
        deepgramLive = await deepgram.listen.live({
            punctuate: true,
            language: 'en-US',
            encoding: 'linear16',
            sample_rate: 16000,
            vad_events: true
        });
        deepgramLive.addListener('transcriptReceived', async (transcription) => {
            const transcriptData = JSON.parse(transcription);
            if (transcriptData.channel?.alternatives?.[0]) {
                const transcript = transcriptData.channel.alternatives[0].transcript;
                if (transcript.trim()) {
                    // Stop current audio when new speech is detected
                    stopCurrentAudio();
                    console.log('\nYou said:', transcript);
                    await streamOpenAIResponse(transcript);
                }
            }
        });
        deepgramLive.addListener('error', (error) => {
            console.error('Deepgram error:', error);
        });
        deepgramLive.addListener('close', () => {
            console.log('Deepgram connection closed');
        });
        const audioStream = microphone.startRecording();
        console.log('Started recording... Speak something and I will respond!');
        audioStream.on('data', (data) => {
            if (deepgramLive.getReadyState() === 1) {
                deepgramLive.send(data);
            }
        });
        audioStream.on('error', (error) => {
            console.error('Error recording:', error);
        });
        return { success: true, message: 'Recording and conversation started successfully' };
    }
    catch (error) {
        console.error('Failed to start recording:', error);
        return { success: false, error: 'Failed to start recording' };
    }
}
async function stopRecording() {
    try {
        if (microphone) {
            microphone.stopRecording();
            console.log('Recording stopped');
        }
        if (deepgramLive) {
            deepgramLive.finish();
            deepgramLive = null;
            console.log('Deepgram connection closed');
        }
        return { success: true, message: 'Conversation ended successfully' };
    }
    catch (error) {
        console.error('Error stopping:', error);
        return { success: false, error: 'Failed to stop recording' };
    }
}
// Create HTTP server
const server = http.createServer(async (req, res) => {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    // Handle OPTIONS request for CORS
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }
    // Parse the URL
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    if (req.method === 'GET') {
        switch (url.pathname) {
            case '/start': {
                const startResult = await startRecording();
                res.writeHead(startResult.success ? 200 : 500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(startResult));
                break;
            }
            case '/stop': {
                const stopResult = await stopRecording();
                res.writeHead(stopResult.success ? 200 : 500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(stopResult));
                break;
            }
            default:
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Not found' }));
        }
    }
    else {
        res.writeHead(405, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Method not allowed' }));
    }
});
// Start the server
server.listen(port, async () => {
    console.log(`Server is running on http://localhost:${port}`);
    await initializeCartesia();
});
