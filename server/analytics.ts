import { MODEL_PRICING } from '../src/constants.js';

export interface UsageLog {
  userId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cacheHit: boolean;
  endpoint: string;
  timestamp: number;
  cost: number;
}

export function calculateCost(model: string, inputTokens: number, outputTokens: number): number {
  // Normalize model name for pricing lookup
  let priceKey = model;
  if (model.includes('gpt-4o-mini')) priceKey = 'gpt-4o-mini';
  else if (model.includes('gpt-4o')) priceKey = 'gpt-4o';
  else if (model.includes('gemini-3.1-pro')) priceKey = 'gemini-3.1-pro-preview';
  else if (model.includes('gemini')) priceKey = 'gemini-3.1-flash-lite-preview';

  const pricing = MODEL_PRICING[priceKey] || { input: 0, output: 0 };
  
  // Pricing is usually per 1M tokens
  const inputCost = (inputTokens / 1_000_000) * pricing.input;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;
  
  return inputCost + outputCost;
}
