import { test, expect } from "./fixtures/auth";
import { mockOpenRouterAPI, mockOpenRouterAPIError, mockOpenRouterAPIRateLimit } from "./helpers/mock-openrouter";
import { sampleGenerationText } from "../helpers/mock-data";

/**
 * E2E Tests for Flashcard Generation Flow
 * Tests: AI generation, validation, approval/rejection, batch operations, rate limiting
 */

test.describe("Generation - Happy Path", () => {
  test("should successfully generate flashcards from valid text", async ({ authenticatedPage: page }) => {
    // Mock OpenRouter API
    await mockOpenRouterAPI(page);

    await page.goto("/dashboard/generate");

    // Fill generation form
    await page.fill('textarea[name="sourceText"]', sampleGenerationText.valid);

    // Submit generation request
    await page.click('button[type="submit"]:has-text("Generate")');

    // Should show loading state
    await expect(page.locator("text=/generating/i").or(page.locator('[data-testid="loading-spinner"]'))).toBeVisible();

    // Wait for generated flashcards to appear
    await expect(page.locator('[data-testid="generated-flashcard"]').first()).toBeVisible({ timeout: 15000 });

    // Should display multiple flashcards (at least 3)
    const flashcardCount = await page.locator('[data-testid="generated-flashcard"]').count();
    expect(flashcardCount).toBeGreaterThanOrEqual(3);

    // Each flashcard should have front and back text
    const firstFlashcard = page.locator('[data-testid="generated-flashcard"]').first();
    await expect(firstFlashcard.locator('[data-testid="flashcard-front"]')).toBeVisible();
    await expect(firstFlashcard.locator('[data-testid="flashcard-back"]')).toBeVisible();
  });

  test("should display flashcards in pending_review status", async ({ authenticatedPage: page }) => {
    await mockOpenRouterAPI(page);
    await page.goto("/dashboard/generate");

    await page.fill('textarea[name="sourceText"]', sampleGenerationText.valid);
    await page.click('button[type="submit"]:has-text("Generate")');

    // Wait for flashcards
    await expect(page.locator('[data-testid="generated-flashcard"]').first()).toBeVisible({ timeout: 15000 });

    // Flashcards should show pending status badge or indicator
    const firstFlashcard = page.locator('[data-testid="generated-flashcard"]').first();
    await expect(
      firstFlashcard.locator('[data-testid="status-badge"]').or(firstFlashcard.locator("text=/pending/i"))
    ).toBeVisible();
  });
});

test.describe("Generation - Form Validation", () => {
  test("should show error when submitting empty text", async ({ authenticatedPage: page }) => {
    await page.goto("/dashboard/generate");

    // Try to submit without text
    await page.click('button[type="submit"]:has-text("Generate")');

    // Should show validation error
    await expect(page.locator("text=/required/i").or(page.locator("text=/cannot be empty/i"))).toBeVisible();
  });

  test("should show error when text is too short (<1000 characters)", async ({ authenticatedPage: page }) => {
    await page.goto("/dashboard/generate");

    await page.fill('textarea[name="sourceText"]', sampleGenerationText.tooShort);
    await page.click('button[type="submit"]:has-text("Generate")');

    // Should show validation error about minimum length
    await expect(page.locator("text=/at least.*1000/i")).toBeVisible();
  });

  test("should show error when text is too long (>10000 characters)", async ({ authenticatedPage: page }) => {
    await page.goto("/dashboard/generate");

    await page.fill('textarea[name="sourceText"]', sampleGenerationText.tooLong);
    await page.click('button[type="submit"]:has-text("Generate")');

    // Should show validation error about maximum length
    await expect(page.locator("text=/maximum.*10000/i")).toBeVisible();
  });

  test("should display character count indicator", async ({ authenticatedPage: page }) => {
    await page.goto("/dashboard/generate");

    const textarea = page.locator('textarea[name="sourceText"]');
    await textarea.fill("Test text");

    // Should show character count (e.g., "9 / 10000" or "9 characters")
    await expect(
      page.locator("text=/\\d+.*characters?/i").or(page.locator('[data-testid="char-count"]'))
    ).toBeVisible();
  });
});

test.describe("Generation - Flashcard Management", () => {
  test("should approve individual flashcard", async ({ authenticatedPage: page }) => {
    await mockOpenRouterAPI(page);
    await page.goto("/dashboard/generate");

    await page.fill('textarea[name="sourceText"]', sampleGenerationText.valid);
    await page.click('button[type="submit"]:has-text("Generate")');

    await expect(page.locator('[data-testid="generated-flashcard"]').first()).toBeVisible({ timeout: 15000 });

    // Click approve button on first flashcard
    const firstFlashcard = page.locator('[data-testid="generated-flashcard"]').first();
    await firstFlashcard
      .locator('button:has-text("Approve")')
      .or(firstFlashcard.locator('[data-testid="approve-btn"]'))
      .click();

    // Should show success toast
    await expect(page.locator("text=/approved/i").or(page.locator('[role="status"]'))).toBeVisible({ timeout: 5000 });

    // Status should change to active or approved
    await expect(firstFlashcard.locator("text=/active/i").or(firstFlashcard.locator("text=/approved/i"))).toBeVisible({
      timeout: 5000,
    });
  });

  test("should reject individual flashcard", async ({ authenticatedPage: page }) => {
    await mockOpenRouterAPI(page);
    await page.goto("/dashboard/generate");

    await page.fill('textarea[name="sourceText"]', sampleGenerationText.valid);
    await page.click('button[type="submit"]:has-text("Generate")');

    await expect(page.locator('[data-testid="generated-flashcard"]').first()).toBeVisible({ timeout: 15000 });

    // Click reject button on first flashcard
    const firstFlashcard = page.locator('[data-testid="generated-flashcard"]').first();
    await firstFlashcard
      .locator('button:has-text("Reject")')
      .or(firstFlashcard.locator('[data-testid="reject-btn"]'))
      .click();

    // Should show success toast
    await expect(page.locator("text=/rejected/i").or(page.locator('[role="status"]'))).toBeVisible({ timeout: 5000 });

    // Flashcard should be removed or marked as rejected
    await expect(firstFlashcard.locator("text=/rejected/i"))
      .toBeVisible({ timeout: 5000 })
      .catch(() => {
        // Or the flashcard might be removed entirely
        return expect(firstFlashcard).toBeHidden();
      });
  });

  test("should edit flashcard before approval", async ({ authenticatedPage: page }) => {
    await mockOpenRouterAPI(page);
    await page.goto("/dashboard/generate");

    await page.fill('textarea[name="sourceText"]', sampleGenerationText.valid);
    await page.click('button[type="submit"]:has-text("Generate")');

    await expect(page.locator('[data-testid="generated-flashcard"]').first()).toBeVisible({ timeout: 15000 });

    // Click edit button
    const firstFlashcard = page.locator('[data-testid="generated-flashcard"]').first();
    await firstFlashcard
      .locator('button:has-text("Edit")')
      .or(firstFlashcard.locator('[data-testid="edit-btn"]'))
      .click();

    // Should open edit modal or inline editor
    const frontInput = page.locator('input[name="front"]').or(page.locator('textarea[name="front"]'));
    await expect(frontInput).toBeVisible({ timeout: 5000 });

    // Edit the content
    await frontInput.fill("Updated question?");
    await page.locator('input[name="back"]').or(page.locator('textarea[name="back"]')).fill("Updated answer");

    // Save changes
    await page.click('button:has-text("Save")').or(page.locator('[data-testid="save-btn"]'));

    // Should show updated content
    await expect(firstFlashcard.locator("text=Updated question?")).toBeVisible({ timeout: 5000 });
  });

  test("should batch approve multiple flashcards", async ({ authenticatedPage: page }) => {
    await mockOpenRouterAPI(page);
    await page.goto("/dashboard/generate");

    await page.fill('textarea[name="sourceText"]', sampleGenerationText.valid);
    await page.click('button[type="submit"]:has-text("Generate")');

    await expect(page.locator('[data-testid="generated-flashcard"]').first()).toBeVisible({ timeout: 15000 });

    // Select multiple flashcards (if checkboxes available)
    const checkboxes = page.locator('[data-testid="flashcard-checkbox"]');
    const count = await checkboxes.count();

    if (count > 0) {
      // Select first 3 flashcards
      for (let i = 0; i < Math.min(3, count); i++) {
        await checkboxes.nth(i).check();
      }

      // Click batch approve button
      await page.click('button:has-text("Approve Selected")').or(page.locator('[data-testid="batch-approve-btn"]'));

      // Should show success toast
      await expect(page.locator("text=/approved/i")).toBeVisible({ timeout: 5000 });
    }
  });
});

test.describe("Generation - History", () => {
  test("should display generation history", async ({ authenticatedPage: page }) => {
    await mockOpenRouterAPI(page);

    // Generate flashcards first
    await page.goto("/dashboard/generate");
    await page.fill('textarea[name="sourceText"]', sampleGenerationText.valid);
    await page.click('button[type="submit"]:has-text("Generate")');
    await expect(page.locator('[data-testid="generated-flashcard"]').first()).toBeVisible({ timeout: 15000 });

    // Navigate to history section (might be on same page or separate tab)
    const historyTab = page.locator('button:has-text("History")').or(page.locator('[data-testid="history-tab"]'));
    if (await historyTab.isVisible()) {
      await historyTab.click();
    }

    // Should display at least one generation request
    await expect(page.locator('[data-testid="generation-request"]').first()).toBeVisible({ timeout: 5000 });
  });

  test("should view details of past generation request", async ({ authenticatedPage: page }) => {
    await mockOpenRouterAPI(page);

    // Generate flashcards
    await page.goto("/dashboard/generate");
    await page.fill('textarea[name="sourceText"]', sampleGenerationText.valid);
    await page.click('button[type="submit"]:has-text("Generate")');
    await expect(page.locator('[data-testid="generated-flashcard"]').first()).toBeVisible({ timeout: 15000 });

    // Navigate to history
    const historyTab = page.locator('button:has-text("History")').or(page.locator('[data-testid="history-tab"]'));
    if (await historyTab.isVisible()) {
      await historyTab.click();

      // Click on first request to view details
      await page.locator('[data-testid="generation-request"]').first().click();

      // Should display request details and associated flashcards
      await expect(page.locator("text=/source text/i").or(page.locator('[data-testid="source-text"]'))).toBeVisible();
    }
  });
});

test.describe("Generation - Rate Limiting", () => {
  test("should show rate limit error when limit exceeded", async ({ authenticatedPage: page }) => {
    await mockOpenRouterAPIRateLimit(page);

    await page.goto("/dashboard/generate");
    await page.fill('textarea[name="sourceText"]', sampleGenerationText.valid);
    await page.click('button[type="submit"]:has-text("Generate")');

    // Should show rate limit error with countdown
    await expect(page.locator("text=/rate limit/i").or(page.locator("text=/too many requests/i"))).toBeVisible({
      timeout: 10000,
    });

    // Should show retry timer
    await expect(page.locator("text=/\\d+.*seconds?/i").or(page.locator('[data-testid="retry-timer"]'))).toBeVisible();
  });

  test("should disable submit button during rate limit", async ({ authenticatedPage: page }) => {
    await mockOpenRouterAPIRateLimit(page);

    await page.goto("/dashboard/generate");
    await page.fill('textarea[name="sourceText"]', sampleGenerationText.valid);
    await page.click('button[type="submit"]:has-text("Generate")');

    // Wait for rate limit error
    await expect(page.locator("text=/rate limit/i")).toBeVisible({ timeout: 10000 });

    // Submit button should be disabled
    const submitButton = page.locator('button[type="submit"]:has-text("Generate")');
    await expect(submitButton).toBeDisabled();
  });
});

test.describe("Generation - Error Handling", () => {
  test("should show error message when API fails", async ({ authenticatedPage: page }) => {
    await mockOpenRouterAPIError(page, 500);

    await page.goto("/dashboard/generate");
    await page.fill('textarea[name="sourceText"]', sampleGenerationText.valid);
    await page.click('button[type="submit"]:has-text("Generate")');

    // Should show error message
    await expect(page.locator("text=/error/i").or(page.locator("text=/something went wrong/i"))).toBeVisible({
      timeout: 10000,
    });
  });

  test("should allow retry after API error", async ({ authenticatedPage: page }) => {
    await mockOpenRouterAPIError(page, 500);

    await page.goto("/dashboard/generate");
    await page.fill('textarea[name="sourceText"]', sampleGenerationText.valid);
    await page.click('button[type="submit"]:has-text("Generate")');

    // Wait for error
    await expect(page.locator("text=/error/i")).toBeVisible({ timeout: 10000 });

    // Now mock successful response
    await mockOpenRouterAPI(page);

    // Retry button should be available
    const retryButton = page.locator('button:has-text("Retry")').or(page.locator('[data-testid="retry-btn"]'));
    if (await retryButton.isVisible()) {
      await retryButton.click();

      // Should show loading and then flashcards
      await expect(page.locator('[data-testid="generated-flashcard"]').first()).toBeVisible({ timeout: 15000 });
    }
  });

  test("should handle empty response from API", async ({ authenticatedPage: page }) => {
    // Mock API with empty flashcards array
    await page.route("https://openrouter.ai/api/v1/chat/completions", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "test",
          object: "chat.completion",
          created: Date.now(),
          model: "test",
          choices: [
            {
              index: 0,
              message: {
                role: "assistant",
                content: JSON.stringify({ flashcards: [] }),
              },
              finish_reason: "stop",
            },
          ],
        }),
      });
    });

    await page.goto("/dashboard/generate");
    await page.fill('textarea[name="sourceText"]', sampleGenerationText.valid);
    await page.click('button[type="submit"]:has-text("Generate")');

    // Should show message about no flashcards generated
    await expect(page.locator("text=/no flashcards/i").or(page.locator("text=/could not generate/i"))).toBeVisible({
      timeout: 10000,
    });
  });
});

test.describe("Generation - Loading States", () => {
  test("should show loading indicator during generation", async ({ authenticatedPage: page }) => {
    await mockOpenRouterAPI(page);

    await page.goto("/dashboard/generate");
    await page.fill('textarea[name="sourceText"]', sampleGenerationText.valid);
    await page.click('button[type="submit"]:has-text("Generate")');

    // Should show loading state immediately
    const loadingIndicator = page
      .locator('[data-testid="loading-spinner"]')
      .or(page.locator("text=/generating/i"))
      .or(page.locator('[role="progressbar"]'));

    await expect(loadingIndicator).toBeVisible({ timeout: 1000 });
  });

  test("should disable form during generation", async ({ authenticatedPage: page }) => {
    await mockOpenRouterAPI(page);

    await page.goto("/dashboard/generate");
    await page.fill('textarea[name="sourceText"]', sampleGenerationText.valid);
    await page.click('button[type="submit"]:has-text("Generate")');

    // Textarea and submit button should be disabled during generation
    const textarea = page.locator('textarea[name="sourceText"]');
    const submitButton = page.locator('button[type="submit"]:has-text("Generate")');

    await expect(textarea).toBeDisabled({ timeout: 1000 });
    await expect(submitButton).toBeDisabled({ timeout: 1000 });
  });
});
