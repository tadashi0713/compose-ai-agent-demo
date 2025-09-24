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

const qwen3Url = process.env['QWEN3_URL'] || 'http://model-runner.docker.internal/engines/llama.cpp/v1';

const dmrClient = createDMR({
  baseURL: qwen3Url
});

const languageModels = {
  "gpt-4.1-mini": openaiClient("gpt-4.1-mini"),
  "qwen3": wrapLanguageModel(
    {
      model: dmrClient("ai/qwen3", { stream: false }),
      middleware
    }
  ),
  "gpt-oss": wrapLanguageModel(
    {
      model: dmrClient("ai/gpt-oss", { stream: false }),
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
  "qwen3": {
    provider: "Docker Model Runner",
    name: "Qwen3",
    description: "Qwen3 model running via Docker Model Runner.",
    apiVersion: "qwen3",
    capabilities: ["Local", "Efficient","Open Source"]
  },
  "gpt-oss": {
    provider: "Docker Model Runner",
    name: "gpt-oss",
    description: "OpenAI’s gpt-oss model running locally via Docker Model Runner.",
    apiVersion: "gpt-oss",
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

export const defaultModel: modelID = "qwen3";
