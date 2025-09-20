import { createOpenAI } from "@ai-sdk/openai";
import { createDMR } from "./dmr";


import {
  customProvider,
  wrapLanguageModel,
  extractReasoningMiddleware
} from "ai";

export interface ModelInfo {
  provider: string;
  name: string;
  description: string;
  apiVersion: string;
  capabilities: string[];
}

const middleware = extractReasoningMiddleware({
  tagName: 'think',
});

// Helper to get API keys from environment variables first, then localStorage
const getApiKey = (key: string): string | undefined => {
  // Check for environment variables first
  if (process.env[key]) {
    return process.env[key] || undefined;
  }

  // Fall back to localStorage if available
  if (typeof window !== 'undefined') {
    return window.localStorage.getItem(key) || undefined;
  }

  return undefined;
};

// Create provider instances with API keys from localStorage
const openaiClient = createOpenAI({
  apiKey: getApiKey('OPENAI_API_KEY'),
});

const llama32Url = process.env['LLAMA3.2_URL'] || 'http://model-runner.docker.internal/engines/llama.cpp/v1';

const dmrClient = createDMR({
  baseURL: llama32Url
});

const languageModels = {
  "gpt-4.1-mini": openaiClient("gpt-4.1-mini"),
  "llama3.2": wrapLanguageModel(
    {
      model: dmrClient("ai/llama3.2", { stream: false }),
      middleware
    }
  ),
  "qwen3:4b-F16": wrapLanguageModel(
    {
      model: dmrClient("jimclark106/qwen3:4b-F16", { stream: false }),
      middleware
    }
  ),
};

export const modelDetails: Record<keyof typeof languageModels, ModelInfo> = {
  "gpt-4.1-mini": {
    provider: "OpenAI",
    name: "GPT-4.1 Mini",
    description: "Compact version of OpenAI's GPT-4.1 with good balance of capabilities, including vision.",
    apiVersion: "gpt-4.1-mini",
    capabilities: ["Balance", "Creative", "Vision"]
  },
  "llama3.2": {
    provider: "Docker Model Runner",
    name: "Llama 3.2",
    description: "Meta's Llama 3.2 model running locally via Docker Model Runner.",
    apiVersion: "llama3.2",
    capabilities: ["Local", "Efficient", "Open Source"]
  },
  "qwen3:4b-F16": {
    provider: "Docker Model Runner",
    name: "Qwen3 4B F16",
    description: "Qwen3 4B model without quantization running via Docker Model Runner.",
    apiVersion: "qwen3:4b-F16",
    capabilities: ["Local", "Open Source"]
  },
};

// Update API keys when localStorage changes (for runtime updates)
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    // Reload the page if any API key changed to refresh the providers
    if (event.key?.includes('API_KEY')) {
      window.location.reload();
    }
  });
}

export const model = customProvider({
  languageModels,
});

export type modelID = keyof typeof languageModels;

export const MODELS = Object.keys(languageModels);

export const defaultModel: modelID = "llama3.2";
