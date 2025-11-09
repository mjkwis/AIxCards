import type { User } from "@supabase/supabase-js";
import type {
  FlashcardDTO,
  GenerationRequestDTO,
  CreateGenerationRequestResponse,
  FlashcardStatus,
  FlashcardSource,
} from "../../src/types";

/**
 * Mock user data for testing
 */
export const mockUser: User = {
  id: "test-user-id",
  app_metadata: {},
  user_metadata: {},
  aud: "authenticated",
  created_at: "2024-01-01T00:00:00.000Z",
  email: "test@example.com",
};

/**
 * Mock flashcard data for testing
 * Updated to match FlashcardDTO structure
 */
export const mockFlashcard: FlashcardDTO = {
  id: "test-flashcard-id",
  user_id: "test-user-id",
  generation_request_id: null,
  front: "What is React?",
  back: "A JavaScript library for building user interfaces",
  source: "manual" as const,
  status: "active" as const,
  next_review_at: "2024-01-15T10:00:00.000Z",
  interval: 1,
  ease_factor: 2.5,
  created_at: "2024-01-01T00:00:00.000Z",
  updated_at: "2024-01-01T00:00:00.000Z",
};

/**
 * Mock generation request data for testing
 */
export const mockGenerationRequest: GenerationRequestDTO = {
  id: "test-request-id",
  user_id: "test-user-id",
  source_text: "Generate flashcards about React hooks, components, and state management.",
  created_at: "2024-01-01T00:00:00.000Z",
  updated_at: "2024-01-01T00:00:00.000Z",
};

/**
 * Create an array of mock flashcards
 */
export function createMockFlashcards(count: number): FlashcardDTO[] {
  return Array.from({ length: count }, (_, i) => ({
    ...mockFlashcard,
    id: `flashcard-${i + 1}`,
    front: `Question ${i + 1}?`,
    back: `Answer ${i + 1}`,
  }));
}

/**
 * Factory function to create flashcard with custom properties
 */
export function createFlashcard(overrides?: Partial<FlashcardDTO>): FlashcardDTO {
  return {
    ...mockFlashcard,
    ...overrides,
  };
}

// ============================================================================
// E2E Test Mock Data
// ============================================================================

/**
 * Mock OpenRouter API response for flashcard generation
 */
export const mockOpenRouterResponse = {
  flashcards: [
    {
      front: "What is a React Hook?",
      back: "A special function that lets you use React features like state and lifecycle methods in functional components",
    },
    {
      front: "What is useState?",
      back: "A Hook that lets you add state to functional components. Returns a state variable and a function to update it",
    },
    {
      front: "What is useEffect?",
      back: "A Hook that lets you perform side effects in functional components, like data fetching or subscriptions",
    },
    {
      front: "What is the purpose of the dependency array in useEffect?",
      back: "It controls when the effect runs. The effect only re-runs if one of the dependencies has changed",
    },
    {
      front: "What is useContext?",
      back: "A Hook that lets you subscribe to React context without introducing nesting, allowing you to access context values",
    },
  ],
};

/**
 * Generate realistic mock flashcards for E2E tests
 */
export function generateMockFlashcardsFromAI(userId: string, generationRequestId: string, count = 5): FlashcardDTO[] {
  const baseFlashcards = [
    {
      front: "What is a React Hook?",
      back: "A special function that lets you use React features like state and lifecycle methods in functional components",
    },
    {
      front: "What is useState?",
      back: "A Hook that lets you add state to functional components. Returns a state variable and a function to update it",
    },
    {
      front: "What is useEffect?",
      back: "A Hook that lets you perform side effects in functional components, like data fetching or subscriptions",
    },
    {
      front: "What is the purpose of the dependency array in useEffect?",
      back: "It controls when the effect runs. The effect only re-runs if one of the dependencies has changed",
    },
    {
      front: "What is useContext?",
      back: "A Hook that lets you subscribe to React context without introducing nesting, allowing you to access context values",
    },
    {
      front: "What is useReducer?",
      back: "A Hook that is an alternative to useState for managing complex state logic. Takes a reducer function and initial state",
    },
    {
      front: "What is useMemo?",
      back: "A Hook that memoizes a computed value, only recalculating when dependencies change, useful for expensive calculations",
    },
    {
      front: "What is useCallback?",
      back: "A Hook that returns a memoized callback function, preventing unnecessary re-renders of child components",
    },
  ];

  return baseFlashcards.slice(0, count).map((card, i) => ({
    id: `generated-flashcard-${i + 1}`,
    user_id: userId,
    generation_request_id: generationRequestId,
    front: card.front,
    back: card.back,
    source: "ai_generated" as FlashcardSource,
    status: "pending_review" as FlashcardStatus,
    next_review_at: null,
    interval: 0,
    ease_factor: 2.5,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));
}

/**
 * Create mock generation request response
 */
export function createMockGenerationRequestResponse(
  userId: string,
  sourceText: string
): CreateGenerationRequestResponse {
  const generationRequest: GenerationRequestDTO = {
    id: `gen-request-${Date.now()}`,
    user_id: userId,
    source_text: sourceText,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const flashcards = generateMockFlashcardsFromAI(userId, generationRequest.id, 5);

  return {
    generation_request: generationRequest,
    flashcards,
  };
}

/**
 * Sample text for generation requests (valid length: 1000-10000 chars)
 */
export const sampleGenerationText = {
  valid: `
React Hooks are functions that let you use state and other React features without writing a class. 
They were introduced in React 16.8 to solve several problems with class components.

The most commonly used Hook is useState, which adds state to functional components. When you call useState, 
it returns a pair: the current state value and a function that lets you update it. You can call this function 
from an event handler or somewhere else.

useEffect is another essential Hook that lets you perform side effects in function components. It serves the 
same purpose as componentDidMount, componentDidUpdate, and componentWillUnmount in React classes, but unified 
into a single API. By using this Hook, you tell React that your component needs to do something after render.

The dependency array in useEffect is crucial for performance optimization. If you pass an empty array, the 
effect will only run once after the initial render. If you pass specific values, the effect will only re-run 
when those values change. This prevents unnecessary executions of the effect.

useContext is a Hook that lets you subscribe to React context without introducing nesting. Context provides 
a way to pass data through the component tree without having to pass props down manually at every level. 
This is especially useful for themes, user authentication, or any global state.

Additional important Hooks include useReducer for complex state logic, useMemo for expensive calculations, 
and useCallback for memoizing callback functions. These optimization Hooks help prevent unnecessary re-renders 
and improve application performance.`.trim(),
  tooShort: "This text is too short for generation.",
  tooLong: "A".repeat(10001),
};
