/**
 * OpenRouter Service for LLM API communication
 *
 * Provides a unified interface for interacting with OpenRouter API,
 * including structured JSON responses, error handling, and comprehensive logging.
 */

import { Logger } from "./logger.service";
import {
  OpenRouterError,
  OpenRouterConfigError,
  OpenRouterAuthError,
  OpenRouterValidationError,
  OpenRouterRateLimitError,
  OpenRouterServerError,
  OpenRouterTimeoutError,
  OpenRouterInvalidResponseError,
} from "../errors/openrouter.error";

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Model parameters for controlling LLM behavior
 */
export interface ModelParameters {
  /** Temperature (0.0 - 2.0): controls randomness */
  temperature?: number;
  /** Maximum tokens in response */
  max_tokens?: number;
  /** Top-p sampling (0.0 - 1.0) */
  top_p?: number;
  /** Frequency penalty (-2.0 - 2.0): reduces repetition */
  frequency_penalty?: number;
  /** Presence penalty (-2.0 - 2.0): encourages new topics */
  presence_penalty?: number;
}

/**
 * Configuration options for OpenRouter Service
 */
export interface OpenRouterServiceOptions {
  /** OpenRouter API key */
  apiKey?: string;
  /** LLM model name */
  model?: string;
  /** API base URL */
  apiUrl?: string;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** HTTP Referer for OpenRouter statistics */
  httpReferer?: string;
  /** Application title for OpenRouter statistics */
  appTitle?: string;
  /** Default model parameters */
  defaultParams?: ModelParameters;
}

// ============================================================================
// Request Types
// ============================================================================

/**
 * Chat message
 */
export interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * JSON Schema for structured responses
 */
export interface JsonSchema<T = unknown> {
  /** Schema name */
  name: string;
  /** Schema description */
  description?: string;
  /** JSON Schema Draft 7 compliant schema */
  schema: {
    type: "object" | "array";
    properties?: Record<string, unknown>;
    items?: unknown;
    required?: string[];
    additionalProperties?: boolean;
    [key: string]: unknown;
  };
  /** Strict mode (model must follow schema exactly) */
  strict?: boolean;
}

/**
 * Chat request parameters
 */
export interface ChatRequest<T = unknown> {
  /** System message defining assistant behavior */
  systemMessage: string;
  /** User message with prompt or question */
  userMessage: string;
  /** Optional JSON schema for structured response */
  responseSchema?: JsonSchema<T>;
  /** Optional model override */
  model?: string;
  /** Optional parameter overrides */
  params?: Partial<ModelParameters>;
  /** Optional conversation history */
  conversationHistory?: Message[];
}

/**
 * Options for generateStructured method
 */
export interface GenerateOptions {
  /** Optional model override */
  model?: string;
  /** Optional parameter overrides */
  params?: Partial<ModelParameters>;
}

// ============================================================================
// Response Types
// ============================================================================

/**
 * Response metadata
 */
export interface ResponseMetadata {
  /** Model used for generation */
  model: string;
  /** Prompt tokens count */
  promptTokens: number;
  /** Completion tokens count */
  completionTokens: number;
  /** Total tokens count */
  totalTokens: number;
  /** Request duration in milliseconds */
  duration: number;
  /** Finish reason */
  finishReason: string;
}

/**
 * Chat response
 */
export interface ChatResponse<T = unknown> {
  /** Parsed response content */
  content: T;
  /** Raw API response */
  raw: OpenRouterApiResponse;
  /** Response metadata */
  metadata: ResponseMetadata;
}

// ============================================================================
// OpenRouter API Types
// ============================================================================

/**
 * OpenRouter API request payload
 */
interface OpenRouterRequestPayload {
  model: string;
  messages: {
    role: "system" | "user" | "assistant";
    content: string;
  }[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  response_format?: {
    type: "json_schema";
    json_schema: {
      name: string;
      description?: string;
      strict: boolean;
      schema: Record<string, unknown>;
    };
  };
}

/**
 * OpenRouter API response
 */
interface OpenRouterApiResponse {
  id: string;
  model: string;
  created: number;
  object: string;
  choices: {
    index: number;
    message: {
      role: "assistant";
      content: string;
    };
    finish_reason: "stop" | "length" | "content_filter" | "tool_calls";
  }[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  error?: {
    message: string;
    type: string;
    code: string;
  };
}

// ============================================================================
// OpenRouter Service Implementation
// ============================================================================

/**
 * OpenRouter Service
 *
 * Provides methods for communicating with OpenRouter API with support for
 * structured JSON responses, comprehensive error handling, and logging.
 */
export class OpenRouterService {
  private readonly apiKey: string;
  private readonly apiUrl: string;
  private currentModel: string;
  private readonly timeout: number;
  private readonly httpReferer: string;
  private readonly appTitle: string;
  private readonly defaultParams: ModelParameters;
  private readonly logger: Logger;

  constructor(options?: OpenRouterServiceOptions) {
    this.logger = new Logger("OpenRouterService");

    // Load configuration
    this.apiKey = options?.apiKey || import.meta.env.OPENROUTER_API_KEY || "";
    this.currentModel = options?.model || import.meta.env.OPENROUTER_MODEL || "openai/gpt-4-turbo";
    this.apiUrl = options?.apiUrl || "https://openrouter.ai/api/v1/chat/completions";
    this.timeout = options?.timeout || 30000;
    this.httpReferer = options?.httpReferer || import.meta.env.SITE_URL || "http://localhost:3000";
    this.appTitle = options?.appTitle || "10x-cards";

    // Load default parameters
    this.defaultParams = {
      temperature: 0.7,
      max_tokens: 2000,
      top_p: 1.0,
      frequency_penalty: 0.0,
      presence_penalty: 0.0,
      ...options?.defaultParams,
    };

    // Validate API key
    if (!this.apiKey) {
      throw new OpenRouterConfigError("OpenRouter API key is required. Set OPENROUTER_API_KEY environment variable.");
    }

    if (this.apiKey.length < 20) {
      this.logger.warning("API key seems unusually short");
    }

    // Validate URL in production
    if (!this.apiUrl.startsWith("https://") && import.meta.env.PROD) {
      this.logger.warning("API URL should use HTTPS in production");
    }

    // Log configuration (without API key!)
    this.logger.info("OpenRouter service initialized", {
      model: this.currentModel,
      timeout: this.timeout,
      apiUrl: this.apiUrl,
      hasApiKey: true,
      defaultParams: this.defaultParams,
    });
  }

  // ============================================================================
  // Public Methods
  // ============================================================================

  /**
   * Get current model
   */
  get model(): string {
    return this.currentModel;
  }

  /**
   * Set current model
   */
  set model(value: string) {
    this.logger.info("Changing model", { from: this.currentModel, to: value });
    this.currentModel = value;
  }

  /**
   * Execute a chat request
   *
   * @param request Chat request parameters
   * @returns Chat response with parsed content and metadata
   */
  async chat<T = unknown>(request: ChatRequest<T>): Promise<ChatResponse<T>> {
    const startTime = Date.now();

    try {
      // Validate request
      this.validateChatRequest(request);

      // Log request start
      this.logger.info("Starting chat request", {
        hasSchema: !!request.responseSchema,
        model: request.model || this.currentModel,
        hasHistory: !!request.conversationHistory,
      });

      // Build payload
      const payload = this.buildRequestPayload(request);

      // Execute request
      const apiResponse = await this.executeRequest(payload);

      // Parse response
      const content = this.parseResponse<T>(apiResponse, !!request.responseSchema);

      // Extract metadata
      const metadata = this.extractMetadata(apiResponse, startTime);

      // Log success
      this.logger.info("Chat request completed", {
        duration: metadata.duration,
        totalTokens: metadata.totalTokens,
        finishReason: metadata.finishReason,
      });

      return {
        content,
        raw: apiResponse,
        metadata,
      };
    } catch (error) {
      // Log error
      if (error instanceof OpenRouterError) {
        this.logger.error("OpenRouter error in chat", error as Error, {
          code: error.code,
          statusCode: error.statusCode,
          duration: Date.now() - startTime,
        });
        throw error;
      }

      this.logger.error("Unexpected error in chat", error as Error, {
        duration: Date.now() - startTime,
      });

      throw new OpenRouterError("Unexpected error during chat request", "OPENROUTER_UNKNOWN_ERROR", 500);
    }
  }

  /**
   * Generate structured response
   *
   * Convenience method that wraps chat() for structured responses
   *
   * @param systemMessage System message
   * @param userMessage User message
   * @param schema JSON schema for response
   * @param options Optional parameters
   * @returns Parsed structured response
   */
  async generateStructured<T>(
    systemMessage: string,
    userMessage: string,
    schema: JsonSchema<T>,
    options?: GenerateOptions
  ): Promise<T> {
    const response = await this.chat<T>({
      systemMessage,
      userMessage,
      responseSchema: schema,
      model: options?.model,
      params: options?.params,
    });

    return response.content;
  }

  /**
   * Validate API key
   *
   * Performs a minimal test request to verify API key validity
   *
   * @returns True if API key is valid
   * @throws OpenRouterAuthError if key is invalid
   */
  async validateApiKey(): Promise<boolean> {
    try {
      this.logger.info("Validating API key");

      await this.chat({
        systemMessage: "You are a helpful assistant.",
        userMessage: "Say 'OK' if you can read this.",
        params: {
          max_tokens: 10,
          temperature: 0,
        },
      });

      this.logger.info("API key validation successful");
      return true;
    } catch (error) {
      if (error instanceof OpenRouterAuthError) {
        this.logger.warning("API key validation failed - auth error");
        return false;
      }

      // Other errors might also indicate key problems
      this.logger.error("API key validation failed", error as Error);
      throw error;
    }
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Validate chat request parameters
   */
  private validateChatRequest<T>(request: ChatRequest<T>): void {
    // Validate systemMessage
    if (!request.systemMessage || request.systemMessage.trim().length === 0) {
      throw new OpenRouterValidationError("systemMessage cannot be empty");
    }

    if (request.systemMessage.length > 10000) {
      throw new OpenRouterValidationError("systemMessage is too long (max 10000 characters)");
    }

    // Validate userMessage
    if (!request.userMessage || request.userMessage.trim().length === 0) {
      throw new OpenRouterValidationError("userMessage cannot be empty");
    }

    if (request.userMessage.length > 50000) {
      throw new OpenRouterValidationError("userMessage is too long (max 50000 characters)");
    }

    // Validate parameters
    if (request.params?.temperature !== undefined) {
      if (request.params.temperature < 0 || request.params.temperature > 2) {
        throw new OpenRouterValidationError("temperature must be between 0 and 2");
      }
    }

    if (request.params?.max_tokens !== undefined) {
      if (request.params.max_tokens < 1 || request.params.max_tokens > 100000) {
        throw new OpenRouterValidationError("max_tokens must be between 1 and 100000");
      }
    }

    if (request.params?.top_p !== undefined) {
      if (request.params.top_p < 0 || request.params.top_p > 1) {
        throw new OpenRouterValidationError("top_p must be between 0 and 1");
      }
    }

    if (request.params?.frequency_penalty !== undefined) {
      if (request.params.frequency_penalty < -2 || request.params.frequency_penalty > 2) {
        throw new OpenRouterValidationError("frequency_penalty must be between -2 and 2");
      }
    }

    if (request.params?.presence_penalty !== undefined) {
      if (request.params.presence_penalty < -2 || request.params.presence_penalty > 2) {
        throw new OpenRouterValidationError("presence_penalty must be between -2 and 2");
      }
    }
  }

  /**
   * Build request payload for OpenRouter API
   */
  private buildRequestPayload<T>(request: ChatRequest<T>): OpenRouterRequestPayload {
    // Build messages array
    const messages: { role: "system" | "user" | "assistant"; content: string }[] = [];

    // Add system message
    messages.push({
      role: "system",
      content: request.systemMessage,
    });

    // Add conversation history if provided
    if (request.conversationHistory && request.conversationHistory.length > 0) {
      messages.push(...request.conversationHistory);
    }

    // Add user message
    messages.push({
      role: "user",
      content: request.userMessage,
    });

    // Select model
    const model = request.model || this.currentModel;

    // Merge parameters
    const params: ModelParameters = {
      ...this.defaultParams,
      ...request.params,
    };

    // Build base payload
    const payload: OpenRouterRequestPayload = {
      model,
      messages,
      temperature: params.temperature,
      max_tokens: params.max_tokens,
      top_p: params.top_p,
      frequency_penalty: params.frequency_penalty,
      presence_penalty: params.presence_penalty,
    };

    // Add response_format if schema provided
    if (request.responseSchema) {
      payload.response_format = {
        type: "json_schema",
        json_schema: {
          name: request.responseSchema.name,
          description: request.responseSchema.description,
          strict: request.responseSchema.strict ?? true,
          schema: request.responseSchema.schema as Record<string, unknown>,
        },
      };
    }

    return payload;
  }

  /**
   * Execute HTTP request to OpenRouter API
   */
  private async executeRequest(payload: OpenRouterRequestPayload): Promise<OpenRouterApiResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(this.apiUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": this.httpReferer,
          "X-Title": this.appTitle,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      // Handle HTTP errors
      if (!response.ok) {
        await this.handleHttpError(response);
      }

      const data = await response.json();

      // Check if response contains error
      if (data.error) {
        throw new OpenRouterServerError(data.error.message || "OpenRouter API returned an error", response.status);
      }

      return data as OpenRouterApiResponse;
    } catch (error) {
      // Handle timeout
      if (error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError")) {
        throw new OpenRouterTimeoutError(this.timeout);
      }

      // Pass through OpenRouter errors
      if (error instanceof OpenRouterError) {
        throw error;
      }

      // Network errors
      throw new OpenRouterError(
        `Network error: ${error instanceof Error ? error.message : "Unknown error"}`,
        "OPENROUTER_NETWORK_ERROR",
        500
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Handle HTTP error responses
   */
  private async handleHttpError(response: Response): Promise<never> {
    const errorData = await response.json().catch(() => ({}));
    const errorMessage = errorData.error?.message || response.statusText;

    // Log full error details for debugging
    this.logger.error("OpenRouter API error details", new Error(errorMessage), {
      status: response.status,
      errorData: JSON.stringify(errorData, null, 2),
      url: response.url,
    });

    switch (response.status) {
      case 400:
        throw new OpenRouterValidationError(errorMessage, errorData.error);

      case 401:
        throw new OpenRouterAuthError("Invalid API key. Please check your OPENROUTER_API_KEY.", 401);

      case 403:
        throw new OpenRouterAuthError("Access forbidden. Your API key may not have permission to use this model.", 403);

      case 429: {
        const resetAt = response.headers.get("X-RateLimit-Reset");
        const resetDate = resetAt ? new Date(parseInt(resetAt) * 1000) : undefined;
        throw new OpenRouterRateLimitError("Rate limit exceeded. Please try again later.", resetDate);
      }

      case 500:
      case 502:
      case 503:
      case 504:
        throw new OpenRouterServerError(errorMessage, response.status);

      default:
        throw new OpenRouterError(errorMessage, "OPENROUTER_HTTP_ERROR", response.status);
    }
  }

  /**
   * Parse API response
   */
  private parseResponse<T>(apiResponse: OpenRouterApiResponse, hasSchema: boolean): T | string {
    // Check if response has choices
    if (!apiResponse.choices || apiResponse.choices.length === 0) {
      throw new OpenRouterInvalidResponseError("No choices in API response", apiResponse);
    }

    // Extract content
    const content = apiResponse.choices[0]?.message?.content;

    if (!content) {
      throw new OpenRouterInvalidResponseError("Empty content in API response", apiResponse);
    }

    // If no schema, return raw string
    if (!hasSchema) {
      return content as T | string;
    }

    // Parse JSON
    try {
      const parsed = JSON.parse(content);
      return parsed as T;
    } catch (error) {
      throw new OpenRouterInvalidResponseError(
        "Failed to parse JSON response. Expected structured JSON but received invalid format.",
        content
      );
    }
  }

  /**
   * Extract metadata from API response
   */
  private extractMetadata(apiResponse: OpenRouterApiResponse, startTime: number): ResponseMetadata {
    return {
      model: apiResponse.model,
      promptTokens: apiResponse.usage?.prompt_tokens ?? 0,
      completionTokens: apiResponse.usage?.completion_tokens ?? 0,
      totalTokens: apiResponse.usage?.total_tokens ?? 0,
      duration: Date.now() - startTime,
      finishReason: apiResponse.choices?.[0]?.finish_reason ?? "unknown",
    };
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

/**
 * Singleton instance of OpenRouter Service
 * Use this for all OpenRouter operations
 */
export const openRouterService = new OpenRouterService();
