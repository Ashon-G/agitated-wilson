/*
IMPORTANT NOTICE: DO NOT REMOVE
This is a custom client for the OpenAI API. You may update this service, but you should not need to.

valid model names:
gpt-4.1-2025-04-14
o4-mini-2025-04-16
gpt-4o-2024-11-20
*/
import { AIMessage } from '../types/ai';

type OpenAIResponse = {
  choices: Array<{
    message?: {
      content?: string;
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
};

const OPENAI_API_KEY = process.env.EXPO_PUBLIC_VIBECODE_OPENAI_API_KEY;

export const getOpenAIClient = () => {
  return {
    chat: {
      completions: {
        create: async (params: {
          model: string;
          messages: AIMessage[];
          max_tokens?: number;
          temperature?: number;
          response_format?: { type: string };
        }): Promise<OpenAIResponse> => {
          if (!OPENAI_API_KEY) {
            throw new Error('OpenAI API key not configured');
          }

          const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${OPENAI_API_KEY}`,
            },
            body: JSON.stringify({
              model: params.model,
              messages: params.messages,
              max_tokens: params.max_tokens,
              temperature: params.temperature,
              ...(params.response_format && { response_format: params.response_format }),
            }),
          });

          if (!response.ok) {
            const errorData = await response.text();
            console.log('OpenAI API error:', response.status);
            throw new Error(`OpenAI API error: ${response.status}`);
          }

          return response.json();
        },
      },
    },
  };
};
