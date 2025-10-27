import { http, HttpResponse } from 'msw';

/**
 * MSW handlers for mocking API calls in tests
 * Add your mock handlers here for different API endpoints
 */
export const handlers = [
  // Example: Mock OpenRouter API call
  http.post('https://openrouter.ai/api/v1/chat/completions', async () => {
    return HttpResponse.json({
      id: 'test-completion-id',
      model: 'test-model',
      choices: [
        {
          message: {
            role: 'assistant',
            content: JSON.stringify([
              {
                question: 'Test question?',
                answer: 'Test answer',
                difficulty: 'medium' as const,
              },
            ]),
          },
          finish_reason: 'stop',
        },
      ],
      usage: {
        prompt_tokens: 100,
        completion_tokens: 50,
        total_tokens: 150,
      },
    });
  }),

  // Example: Mock Supabase API calls
  http.get('https://*.supabase.co/rest/v1/*', () => {
    return HttpResponse.json([]);
  }),

  http.post('https://*.supabase.co/rest/v1/*', () => {
    return HttpResponse.json({ success: true });
  }),
];

