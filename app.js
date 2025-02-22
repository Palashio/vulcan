import 'dotenv/config';
import http from 'http';
import mic from 'node-microphone';
import pkg from '@deepgram/sdk';
const { Deepgram } = pkg;
import OpenAI from 'openai';
import { CartesiaClient } from "@cartesia/cartesia-js";
import playSound from 'play-sound';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const port = 3000;
const player = playSound({});

let microphone = null;
let deepgramLive = null;

// Initialize Deepgram
const deepgram = new Deepgram(process.env.DEEPGRAM_API_KEY);

// Initialize OpenAI
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

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
        console.log('\n'); // New line after response is complete
        
        // Create responses directory if it doesn't exist
        const responsesDir = path.join(__dirname, 'responses');
        await fs.mkdir(responsesDir, { recursive: true });
        
        // Generate unique filename
        const filename = path.join(responsesDir, `response-${Date.now()}.mp3`);
        
        try {
            // Use OpenAI TTS to convert the response to speech
            const mp3 = await openai.audio.speech.create({
                model: "tts-1",
                voice: "alloy",
                input: fullResponse,
            });
            
            // Convert the response to buffer and save it
            const buffer = Buffer.from(await mp3.arrayBuffer());
            await fs.writeFile(filename, buffer);
            
            // Play the audio response
            console.log('Playing response...');
            player.play(filename, (err) => {
                if (err) {
                    console.error('Error playing audio:', err);
                }
                // Delete the file after playing
                fs.unlink(filename).catch(err => {
                    console.error('Error deleting audio file:', err);
                });
            });
        } catch (error) {
            console.error('TTS or playback error:', error);
        }

    } catch (error) {
        console.error('API error:', error);
        console.log('Assistant: Sorry, I had trouble processing that.');
    }
}

async function startRecording() {
    try {
        // Create a new microphone instance
        microphone = new mic();
        
        // Create Deepgram live transcription connection
        deepgramLive = await deepgram.transcription.live({
            punctuate: true,
            language: 'en-US',
            encoding: 'linear16',
            sample_rate: 16000,
        });

        // Handle Deepgram events
        deepgramLive.addListener('transcriptReceived', async (transcription) => {
            const transcriptData = JSON.parse(transcription);
            if (transcriptData.channel && transcriptData.channel.alternatives && transcriptData.channel.alternatives[0]) {
                const transcript = transcriptData.channel.alternatives[0].transcript;
                if (transcript.trim()) {
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
        
        // Start recording
        const audioStream = microphone.startRecording();
        
        console.log('Started recording... Speak something and I will respond!');
        
        // Listen for data from the microphone and send to Deepgram
        audioStream.on('data', (data) => {
            if (deepgramLive.getReadyState() === 1) {
                deepgramLive.send(data);
            }
        });

        // Handle errors
        audioStream.on('error', (error) => {
            console.error('Error recording:', error);
        });

        return { success: true, message: 'Recording and conversation started successfully' };
    } catch (error) {
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
    } catch (error) {
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
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === 'GET') {
        switch (url.pathname) {
            case '/start':
                const startResult = await startRecording();
                res.writeHead(startResult.success ? 200 : 500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(startResult));
                break;

            case '/stop':
                const stopResult = await stopRecording();
                res.writeHead(stopResult.success ? 200 : 500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(stopResult));
                break;

            default:
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Not found' }));
        }
    } else {
        res.writeHead(405, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Method not allowed' }));
    }
});

// Start the server
server.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
}); 