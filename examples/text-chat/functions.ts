import { FunctionTool } from '../../src/services/Pipeline.js';

export const functionTools: FunctionTool[] = [{
    name: "log_banana_mention",
    description: "Log when someone talks about bananas",
    parameters: {
        type: "object",
        properties: {
            message: {
                type: "string",
                description: "The message containing banana-related content"
            }
        },
        required: ["message"]
    }
},
{
    name: "log_apple_mention",
    description: "Log when someone talks about apples",
    parameters: {
        type: "object",
        properties: {
            message: {
                type: "string",
                description: "The message containing apple-related content"
            }
        },
        required: ["message"]
    }
}];

export const functionHandlers = {
    log_banana_mention: (args: { message: string }) => {
        console.log('🍌 [BANANA MENTION]:', args.message);
    },
    log_apple_mention: (args: { message: string }) => {
        console.log('🍎 [APPLE MENTION]:', args.message);
    }
}; 