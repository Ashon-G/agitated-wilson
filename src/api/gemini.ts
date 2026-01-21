/*
IMPORTANT NOTICE: DO NOT REMOVE
This is a custom client for the Google Gemini API.

valid model names:
gemini-2.0-flash
gemini-1.5-pro
gemini-1.5-flash
*/
import { AIMessage } from '../types/ai';

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
};

const GEMINI_API_KEY = process.env.EXPO_PUBLIC_VIBECODE_GOOGLE_API_KEY;

// Convert AIMessage format to Gemini format
const convertToGeminiMessages = (
  messages: AIMessage[],
): { contents: Array<{ role: string; parts: Array<{ text: string }> }>; systemInstruction?: { parts: Array<{ text: string }> } } => {
  const systemMessages = messages.filter(m => m.role === 'system');
  const chatMessages = messages.filter(m => m.role !== 'system');

  const contents = chatMessages.map(msg => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: msg.content }],
  }));

  // Combine system messages into system instruction
  const systemInstruction =
    systemMessages.length > 0
      ? { parts: [{ text: systemMessages.map(m => m.content).join('\n\n') }] }
      : undefined;

  return { contents, systemInstruction };
};

export const getGeminiClient = () => {
  return {
    chat: {
      completions: {
        create: async (params: {
          model: string;
          messages: AIMessage[];
          max_tokens?: number;
          temperature?: number;
        }): Promise<{
          choices: Array<{ message?: { content?: string } }>;
          usage?: {
            prompt_tokens?: number;
            completion_tokens?: number;
            total_tokens?: number;
          };
        }> => {
          if (!GEMINI_API_KEY) {
            throw new Error('Gemini API key not configured');
          }

          const { contents, systemInstruction } = convertToGeminiMessages(params.messages);

          const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${params.model}:generateContent?key=${GEMINI_API_KEY}`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                contents,
                ...(systemInstruction && { systemInstruction }),
                generationConfig: {
                  maxOutputTokens: params.max_tokens || 2048,
                  temperature: params.temperature ?? 0.7,
                },
              }),
            },
          );

          if (!response.ok) {
            const errorText = await response.text();
            console.log('Gemini API error:', response.status, errorText);
            throw new Error(`Gemini API error ${response.status}: ${errorText}`);
          }

          const data: GeminiResponse = await response.json();

          // Extract text from response
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

          // Return in OpenAI-compatible format
          return {
            choices: [{ message: { content: text } }],
            usage: {
              prompt_tokens: data.usageMetadata?.promptTokenCount || 0,
              completion_tokens: data.usageMetadata?.candidatesTokenCount || 0,
              total_tokens: data.usageMetadata?.totalTokenCount || 0,
            },
          };
        },
      },
    },
  };
};

/**
 * Get a text response from Gemini
 */
export const getGeminiTextResponse = async (
  messages: AIMessage[],
  options?: {
    model?: string;
    maxTokens?: number;
    temperature?: number;
  },
): Promise<{
  content: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}> => {
  const client = getGeminiClient();
  const defaultModel = 'gemini-2.0-flash';

  const response = await client.chat.completions.create({
    model: options?.model || defaultModel,
    messages,
    max_tokens: options?.maxTokens || 2048,
    temperature: options?.temperature ?? 0.7,
  });

  return {
    content: response.choices[0]?.message?.content || '',
    usage: {
      promptTokens: response.usage?.prompt_tokens || 0,
      completionTokens: response.usage?.completion_tokens || 0,
      totalTokens: response.usage?.total_tokens || 0,
    },
  };
};

/**
 * Get a simple chat response from Gemini
 */
export const getGeminiChatResponse = async (prompt: string): Promise<{ content: string }> => {
  return await getGeminiTextResponse([{ role: 'user', content: prompt }]);
};
