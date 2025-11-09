import { Page } from "@playwright/test";
import { mockOpenRouterResponse } from "../../helpers/mock-data";

/**
 * Mock OpenRouter API responses in E2E tests
 * This intercepts the OpenRouter API calls and returns predefined mock data
 */
export async function mockOpenRouterAPI(page: Page) {
  // Intercept OpenRouter API calls
  await page.route("https://openrouter.ai/api/v1/chat/completions", async (route) => {
    // Simulate a realistic API delay (500-1500ms)
    const delay = Math.floor(Math.random() * 1000) + 500;
    await new Promise((resolve) => setTimeout(resolve, delay));

    // Return mock response
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: `chatcmpl-${Date.now()}`,
        object: "chat.completion",
        created: Date.now(),
        model: "meta-llama/llama-3.1-8b-instruct:free",
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content: JSON.stringify(mockOpenRouterResponse),
            },
            finish_reason: "stop",
          },
        ],
        usage: {
          prompt_tokens: 150,
          completion_tokens: 450,
          total_tokens: 600,
        },
      }),
    });
  });
}

/**
 * Mock OpenRouter API with custom response
 */
export async function mockOpenRouterAPIWithResponse(
  page: Page,
  response: { flashcards: { front: string; back: string }[] }
) {
  await page.route("https://openrouter.ai/api/v1/chat/completions", async (route) => {
    const delay = Math.floor(Math.random() * 1000) + 500;
    await new Promise((resolve) => setTimeout(resolve, delay));

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: `chatcmpl-${Date.now()}`,
        object: "chat.completion",
        created: Date.now(),
        model: "meta-llama/llama-3.1-8b-instruct:free",
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content: JSON.stringify(response),
            },
            finish_reason: "stop",
          },
        ],
        usage: {
          prompt_tokens: 150,
          completion_tokens: 450,
          total_tokens: 600,
        },
      }),
    });
  });
}

/**
 * Mock OpenRouter API with error response
 */
export async function mockOpenRouterAPIError(page: Page, statusCode = 500) {
  await page.route("https://openrouter.ai/api/v1/chat/completions", async (route) => {
    await route.fulfill({
      status: statusCode,
      contentType: "application/json",
      body: JSON.stringify({
        error: {
          message: "Internal server error",
          type: "server_error",
          code: statusCode,
        },
      }),
    });
  });
}

/**
 * Mock OpenRouter API with rate limit error (429)
 */
export async function mockOpenRouterAPIRateLimit(page: Page) {
  await page.route("https://openrouter.ai/api/v1/chat/completions", async (route) => {
    await route.fulfill({
      status: 429,
      contentType: "application/json",
      headers: {
        "Retry-After": "60",
      },
      body: JSON.stringify({
        error: {
          message: "Rate limit exceeded",
          type: "rate_limit_error",
          code: 429,
        },
      }),
    });
  });
}

/**
 * Mock OpenRouter API with timeout
 */
export async function mockOpenRouterAPITimeout(page: Page) {
  await page.route("https://openrouter.ai/api/v1/chat/completions", async (route) => {
    // Simulate timeout by never fulfilling the request
    await new Promise((resolve) => setTimeout(resolve, 60000));
    await route.abort("timedout");
  });
}
