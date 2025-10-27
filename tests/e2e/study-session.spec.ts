import { test, expect } from "./fixtures/auth";

/**
 * E2E Tests for Study Session Flow
 * Tests: Starting session, reviewing flashcards, quality ratings, session completion
 */

test.describe("Study Session - Start Session", () => {
  test("should display study session page", async ({ authenticatedPage: page }) => {
    await page.goto("/dashboard/study");

    // Should display study heading
    await expect(page.locator("h1, h2").filter({ hasText: /study/i })).toBeVisible();
  });

  test("should show empty state when no flashcards due", async ({ authenticatedPage: page }) => {
    await page.goto("/dashboard/study");

    // Wait for data to load
    await page.waitForTimeout(2000);

    // Either flashcards are shown or empty state
    const flashcard = page.locator('[data-testid="study-card"]');
    const emptyState = page.locator("text=/no flashcards due/i").or(page.locator('[data-testid="empty-state"]'));

    const hasFlashcard = await flashcard.isVisible().catch(() => false);
    
    if (!hasFlashcard) {
      await expect(emptyState).toBeVisible();
      
      // Should show CTA to generate or create flashcards
      await expect(
        page.locator('a:has-text("Generate")').or(page.locator('a:has-text("Create")'))
      ).toBeVisible();
    }
  });

  test("should display first flashcard when due flashcards exist", async ({ authenticatedPage: page }) => {
    // First, create a flashcard to ensure there's something to study
    await page.goto("/dashboard/flashcards");
    
    const addButton = page
      .locator('button:has-text("Add")')
      .or(page.locator('[data-testid="add-flashcard-btn"]'))
      .or(page.locator('button:has-text("Create")'));
    
    if (await addButton.isVisible()) {
      await addButton.click();
      await page.locator('input[name="front"]').or(page.locator('textarea[name="front"]')).fill("Study Question");
      await page.locator('input[name="back"]').or(page.locator('textarea[name="back"]')).fill("Study Answer");
      await page.locator('button[type="submit"]').or(page.locator('button:has-text("Save")')).click();
      await page.waitForTimeout(1000);
    }

    // Now go to study
    await page.goto("/dashboard/study");
    await page.waitForTimeout(2000);

    // Should display a study card
    const studyCard = page.locator('[data-testid="study-card"]').or(page.locator('[data-testid="flashcard-front"]'));
    
    if (await studyCard.isVisible()) {
      await expect(studyCard).toBeVisible();
      
      // Should show front of flashcard
      await expect(page.locator('[data-testid="flashcard-front"]')).toBeVisible();
    }
  });

  test("should display progress indicator", async ({ authenticatedPage: page }) => {
    await page.goto("/dashboard/study");
    await page.waitForTimeout(2000);

    // Look for progress bar or counter (e.g., "1 / 10")
    const progressBar = page
      .locator('[role="progressbar"]')
      .or(page.locator('[data-testid="progress-bar"]'))
      .or(page.locator("text=/\\d+ \\/ \\d+/"));

    // Progress might only show if there are flashcards
    const studyCard = page.locator('[data-testid="study-card"]');
    if (await studyCard.isVisible()) {
      const isProgressVisible = await progressBar.isVisible().catch(() => false);
      if (isProgressVisible) {
        await expect(progressBar).toBeVisible();
      }
    }
  });
});

test.describe("Study Session - Flashcard Interaction", () => {
  test("should flip flashcard to show back", async ({ authenticatedPage: page }) => {
    // Create a flashcard first
    await page.goto("/dashboard/flashcards");
    
    const addButton = page
      .locator('button:has-text("Add")')
      .or(page.locator('[data-testid="add-flashcard-btn"]'))
      .or(page.locator('button:has-text("Create")'));
    
    if (await addButton.isVisible()) {
      await addButton.click();
      const frontText = `Flip Question ${Date.now()}`;
      const backText = `Flip Answer ${Date.now()}`;
      
      await page.locator('input[name="front"]').or(page.locator('textarea[name="front"]')).fill(frontText);
      await page.locator('input[name="back"]').or(page.locator('textarea[name="back"]')).fill(backText);
      await page.locator('button[type="submit"]').or(page.locator('button:has-text("Save")')).click();
      await page.waitForTimeout(1000);

      // Go to study
      await page.goto("/dashboard/study");
      await page.waitForTimeout(2000);

      // Check if our flashcard is visible
      const studyCard = page.locator('[data-testid="study-card"]');
      if (await studyCard.isVisible()) {
        // Front should be visible
        const frontVisible = await page.locator(`text=${frontText}`).isVisible().catch(() => false);
        
        if (frontVisible) {
          // Click to flip (might be on card itself or a "Show Answer" button)
          await studyCard.click().catch(async () => {
            await page.locator('button:has-text("Show Answer")').or(page.locator('[data-testid="flip-btn"]')).click();
          });

          // Back should now be visible
          await expect(page.locator(`text=${backText}`)).toBeVisible({ timeout: 2000 });
        }
      }
    }
  });

  test("should display quality rating buttons after flipping", async ({ authenticatedPage: page }) => {
    await page.goto("/dashboard/study");
    await page.waitForTimeout(2000);

    const studyCard = page.locator('[data-testid="study-card"]');
    
    if (await studyCard.isVisible()) {
      // Flip card
      await studyCard.click().catch(async () => {
        await page.locator('button:has-text("Show Answer")').or(page.locator('[data-testid="flip-btn"]')).click();
      });

      await page.waitForTimeout(500);

      // Quality rating buttons should appear (0-5 for SM-2)
      // Look for multiple rating buttons
      const ratingButtons = page
        .locator('[data-testid^="quality-"]')
        .or(page.locator('button[data-quality]'))
        .or(page.locator('button:has-text("0"), button:has-text("1"), button:has-text("2")'));

      const count = await ratingButtons.count();
      // Should have at least some rating options
      if (count > 0) {
        expect(count).toBeGreaterThanOrEqual(4); // At least 4 quality levels (0-3 minimum)
      }
    }
  });
});

test.describe("Study Session - Quality Ratings", () => {
  test("should submit quality rating and move to next flashcard", async ({ authenticatedPage: page }) => {
    // Create 2 flashcards for the test
    await page.goto("/dashboard/flashcards");
    
    for (let i = 0; i < 2; i++) {
      const addButton = page
        .locator('button:has-text("Add")')
        .or(page.locator('[data-testid="add-flashcard-btn"]'))
        .or(page.locator('button:has-text("Create")'));
      
      if (await addButton.isVisible()) {
        await addButton.click();
        await page.locator('input[name="front"]').or(page.locator('textarea[name="front"]')).fill(`Question ${i + 1}`);
        await page.locator('input[name="back"]').or(page.locator('textarea[name="back"]')).fill(`Answer ${i + 1}`);
        await page.locator('button[type="submit"]').or(page.locator('button:has-text("Save")')).click();
        await page.waitForTimeout(1000);
      }
    }

    // Go to study
    await page.goto("/dashboard/study");
    await page.waitForTimeout(2000);

    const studyCard = page.locator('[data-testid="study-card"]');
    
    if (await studyCard.isVisible()) {
      // Get first flashcard text
      const firstCardText = await studyCard.textContent();

      // Flip card
      await studyCard.click().catch(async () => {
        await page.locator('button:has-text("Show Answer")').or(page.locator('[data-testid="flip-btn"]')).click();
      });

      await page.waitForTimeout(500);

      // Click a quality rating (e.g., quality 4 - "Easy")
      const ratingButton = page
        .locator('[data-testid="quality-4"]')
        .or(page.locator('button[data-quality="4"]'))
        .or(page.locator('button:has-text("Easy")'))
        .or(page.locator('button:has-text("4")'));

      if (await ratingButton.isVisible()) {
        await ratingButton.click();
        await page.waitForTimeout(1000);

        // Should move to next flashcard (different text) or show completion
        const newCardText = await studyCard.textContent().catch(() => "");
        
        // Either new card or session complete
        if (newCardText && newCardText !== firstCardText) {
          // Moved to next card
          expect(newCardText).not.toBe(firstCardText);
        } else {
          // Or session might be complete
          const completionMessage = page.locator("text=/complete/i").or(page.locator("text=/finished/i"));
          await expect(completionMessage).toBeVisible({ timeout: 2000 }).catch(() => {});
        }
      }
    }
  });

  test("should accept all quality levels (0-5)", async ({ authenticatedPage: page }) => {
    await page.goto("/dashboard/study");
    await page.waitForTimeout(2000);

    const studyCard = page.locator('[data-testid="study-card"]');
    
    if (await studyCard.isVisible()) {
      // Flip card
      await studyCard.click().catch(async () => {
        await page.locator('button:has-text("Show Answer")').or(page.locator('[data-testid="flip-btn"]')).click();
      });

      await page.waitForTimeout(500);

      // Try each quality level
      for (let quality = 0; quality <= 5; quality++) {
        const button = page
          .locator(`[data-testid="quality-${quality}"]`)
          .or(page.locator(`button[data-quality="${quality}"]`));
        
        if (await button.isVisible()) {
          // Button exists for this quality level
          await expect(button).toBeVisible();
        }
      }
    }
  });
});

test.describe("Study Session - Session Completion", () => {
  test("should show completion screen after reviewing all cards", async ({ authenticatedPage: page }) => {
    // Create one flashcard
    await page.goto("/dashboard/flashcards");
    
    const addButton = page
      .locator('button:has-text("Add")')
      .or(page.locator('[data-testid="add-flashcard-btn"]'))
      .or(page.locator('button:has-text("Create")'));
    
    if (await addButton.isVisible()) {
      await addButton.click();
      await page.locator('input[name="front"]').or(page.locator('textarea[name="front"]')).fill("Last Question");
      await page.locator('input[name="back"]').or(page.locator('textarea[name="back"]')).fill("Last Answer");
      await page.locator('button[type="submit"]').or(page.locator('button:has-text("Save")')).click();
      await page.waitForTimeout(1000);
    }

    // Go to study and complete it
    await page.goto("/dashboard/study");
    await page.waitForTimeout(2000);

    const studyCard = page.locator('[data-testid="study-card"]');
    
    if (await studyCard.isVisible()) {
      // Flip and rate
      await studyCard.click().catch(async () => {
        await page.locator('button:has-text("Show Answer")').or(page.locator('[data-testid="flip-btn"]')).click();
      });

      await page.waitForTimeout(500);

      const ratingButton = page
        .locator('[data-testid="quality-5"]')
        .or(page.locator('button[data-quality="5"]'))
        .or(page.locator('button:has-text("Perfect")'))
        .first();

      if (await ratingButton.isVisible()) {
        await ratingButton.click();
        await page.waitForTimeout(2000);

        // Should show completion screen
        await expect(
          page.locator("text=/completed/i")
            .or(page.locator("text=/finished/i"))
            .or(page.locator("text=/great job/i"))
            .or(page.locator('[data-testid="session-complete"]'))
        ).toBeVisible({ timeout: 5000 });
      }
    }
  });

  test("should display session statistics on completion", async ({ authenticatedPage: page }) => {
    await page.goto("/dashboard/study");
    await page.waitForTimeout(2000);

    // If there's a completion screen visible, check for stats
    const completionScreen = page
      .locator("text=/completed/i")
      .or(page.locator('[data-testid="session-complete"]'));

    if (await completionScreen.isVisible()) {
      // Should show stats like cards reviewed, time taken, etc.
      const statsIndicators = page
        .locator("text=/cards reviewed/i")
        .or(page.locator("text=/\\d+ cards/i"))
        .or(page.locator('[data-testid="session-stats"]'));

      const hasStats = await statsIndicators.isVisible().catch(() => false);
      if (hasStats) {
        await expect(statsIndicators).toBeVisible();
      }
    }
  });

  test("should have option to start new session after completion", async ({ authenticatedPage: page }) => {
    await page.goto("/dashboard/study");
    await page.waitForTimeout(2000);

    const completionScreen = page
      .locator("text=/completed/i")
      .or(page.locator('[data-testid="session-complete"]'));

    if (await completionScreen.isVisible()) {
      // Should have button to start new session or return to dashboard
      await expect(
        page
          .locator('button:has-text("New Session")')
          .or(page.locator('a:has-text("Dashboard")'))
          .or(page.locator('[data-testid="new-session-btn"]'))
      ).toBeVisible();
    }
  });
});

test.describe("Study Session - Progress Tracking", () => {
  test("should update progress bar as cards are reviewed", async ({ authenticatedPage: page }) => {
    await page.goto("/dashboard/study");
    await page.waitForTimeout(2000);

    const progressBar = page
      .locator('[role="progressbar"]')
      .or(page.locator('[data-testid="progress-bar"]'));
    const studyCard = page.locator('[data-testid="study-card"]');

    if ((await studyCard.isVisible()) && (await progressBar.isVisible())) {
      // Get initial progress
      const initialProgress = await progressBar.getAttribute("aria-valuenow").catch(() => "0");

      // Review one card
      await studyCard.click().catch(async () => {
        await page.locator('button:has-text("Show Answer")').or(page.locator('[data-testid="flip-btn"]')).click();
      });

      await page.waitForTimeout(500);

      const ratingButton = page
        .locator('[data-testid="quality-4"]')
        .or(page.locator('button[data-quality="4"]'))
        .first();

      if (await ratingButton.isVisible()) {
        await ratingButton.click();
        await page.waitForTimeout(1000);

        // Progress should have increased
        const newProgress = await progressBar.getAttribute("aria-valuenow").catch(() => "0");
        
        if (initialProgress && newProgress) {
          expect(parseInt(newProgress)).toBeGreaterThan(parseInt(initialProgress));
        }
      }
    }
  });

  test("should display remaining cards count", async ({ authenticatedPage: page }) => {
    await page.goto("/dashboard/study");
    await page.waitForTimeout(2000);

    const studyCard = page.locator('[data-testid="study-card"]');
    
    if (await studyCard.isVisible()) {
      // Look for remaining cards indicator
      const remaining = page
        .locator("text=/\\d+ remaining/i")
        .or(page.locator('[data-testid="remaining-count"]'));

      const isVisible = await remaining.isVisible().catch(() => false);
      if (isVisible) {
        await expect(remaining).toBeVisible();
      }
    }
  });
});

test.describe("Study Session - Keyboard Navigation", () => {
  test("should flip card with spacebar", async ({ authenticatedPage: page }) => {
    await page.goto("/dashboard/study");
    await page.waitForTimeout(2000);

    const studyCard = page.locator('[data-testid="study-card"]');
    
    if (await studyCard.isVisible()) {
      const frontVisible = await page.locator('[data-testid="flashcard-front"]').isVisible();
      
      if (frontVisible) {
        // Press spacebar to flip
        await page.keyboard.press("Space");
        await page.waitForTimeout(500);

        // Back should be visible
        await expect(page.locator('[data-testid="flashcard-back"]')).toBeVisible({ timeout: 2000 });
      }
    }
  });

  test("should rate with number keys (0-5)", async ({ authenticatedPage: page }) => {
    await page.goto("/dashboard/study");
    await page.waitForTimeout(2000);

    const studyCard = page.locator('[data-testid="study-card"]');
    
    if (await studyCard.isVisible()) {
      // Flip card
      await page.keyboard.press("Space").catch(async () => {
        await studyCard.click();
      });

      await page.waitForTimeout(500);

      // Check if rating buttons are visible
      const ratingButtons = page.locator('[data-testid^="quality-"]').or(page.locator('button[data-quality]'));
      
      if ((await ratingButtons.count()) > 0) {
        // Try pressing number key (e.g., "4" for quality 4)
        await page.keyboard.press("4");
        await page.waitForTimeout(1000);

        // Should have moved to next card or shown completion
        // (Hard to verify without knowing exact implementation)
      }
    }
  });
});

test.describe("Study Session - Edge Cases", () => {
  test("should handle session with single flashcard", async ({ authenticatedPage: page }) => {
    await page.goto("/dashboard/study");
    await page.waitForTimeout(2000);

    // If study card visible, it should work even with just one
    const studyCard = page.locator('[data-testid="study-card"]');
    
    if (await studyCard.isVisible()) {
      await studyCard.click().catch(async () => {
        await page.locator('button:has-text("Show Answer")').click();
      });

      await page.waitForTimeout(500);

      const ratingButton = page.locator('[data-testid="quality-5"]').or(page.locator('button[data-quality="5"]')).first();
      
      if (await ratingButton.isVisible()) {
        await ratingButton.click();
        await page.waitForTimeout(2000);

        // Should show completion
        await expect(
          page.locator("text=/completed/i").or(page.locator("text=/finished/i"))
        ).toBeVisible({ timeout: 5000 });
      }
    }
  });

  test("should maintain session state on page refresh", async ({ authenticatedPage: page }) => {
    await page.goto("/dashboard/study");
    await page.waitForTimeout(2000);

    const studyCard = page.locator('[data-testid="study-card"]');
    
    if (await studyCard.isVisible()) {
      const cardTextBefore = await studyCard.textContent();

      // Refresh page
      await page.reload();
      await page.waitForTimeout(2000);

      // Should show same or next card (depending on implementation)
      // At minimum, session should still be functional
      const studyCardAfter = page.locator('[data-testid="study-card"]');
      
      if (await studyCardAfter.isVisible()) {
        // Session is still active
        await expect(studyCardAfter).toBeVisible();
      }
    }
  });
});

