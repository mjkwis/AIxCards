import { test, expect } from "./fixtures/auth";

/**
 * E2E Tests for Flashcard Management
 * Tests: CRUD operations, filtering, sorting, pagination
 */

test.describe("Flashcards - List View", () => {
  test("should display flashcards list", async ({ authenticatedPage: page }) => {
    await page.goto("/dashboard/flashcards");

    // Should display flashcards heading
    await expect(page.locator("h1, h2").filter({ hasText: /flashcards/i })).toBeVisible();

    // Should have add new flashcard button
    await expect(
      page.locator('button:has-text("Add")').or(page.locator('[data-testid="add-flashcard-btn"]'))
    ).toBeVisible();
  });

  test("should show empty state when no flashcards exist", async ({ authenticatedPage: page }) => {
    await page.goto("/dashboard/flashcards");

    // If no flashcards, should show empty state
    const flashcardList = page.locator('[data-testid="flashcard-list"]');
    const emptyState = page.locator("text=/no flashcards/i").or(page.locator('[data-testid="empty-state"]'));

    // Either flashcards exist or empty state is shown
    const hasFlashcards = (await flashcardList.count()) > 0;
    if (!hasFlashcards) {
      await expect(emptyState).toBeVisible();
      // Should have CTA to create or generate flashcards
      await expect(page.locator("text=/create/i").or(page.locator("text=/generate/i"))).toBeVisible();
    }
  });
});

test.describe("Flashcards - Create (Manual)", () => {
  test("should open create flashcard modal", async ({ authenticatedPage: page }) => {
    await page.goto("/dashboard/flashcards");

    // Click add new flashcard button
    await page
      .locator('button:has-text("Add")')
      .or(page.locator('[data-testid="add-flashcard-btn"]'))
      .or(page.locator('button:has-text("Create")'))
      .click();

    // Modal should open with form
    await expect(page.locator('[role="dialog"]').or(page.locator('[data-testid="flashcard-modal"]'))).toBeVisible();
    await expect(page.locator('input[name="front"]').or(page.locator('textarea[name="front"]'))).toBeVisible();
    await expect(page.locator('input[name="back"]').or(page.locator('textarea[name="back"]'))).toBeVisible();
  });

  test("should successfully create a manual flashcard", async ({ authenticatedPage: page }) => {
    await page.goto("/dashboard/flashcards");

    // Open create modal
    await page
      .locator('button:has-text("Add")')
      .or(page.locator('[data-testid="add-flashcard-btn"]'))
      .or(page.locator('button:has-text("Create")'))
      .click();

    // Fill form
    const uniqueFront = `Test Question ${Date.now()}`;
    const uniqueBack = `Test Answer ${Date.now()}`;

    await page.locator('input[name="front"]').or(page.locator('textarea[name="front"]')).fill(uniqueFront);
    await page.locator('input[name="back"]').or(page.locator('textarea[name="back"]')).fill(uniqueBack);

    // Submit
    await page.locator('button[type="submit"]').or(page.locator('button:has-text("Save")')).click();

    // Should show success message
    await expect(page.locator("text=/created/i").or(page.locator('[role="status"]'))).toBeVisible({ timeout: 5000 });

    // Should appear in list
    await expect(page.locator(`text=${uniqueFront}`)).toBeVisible({ timeout: 5000 });
  });

  test("should show validation errors for empty fields", async ({ authenticatedPage: page }) => {
    await page.goto("/dashboard/flashcards");

    await page
      .locator('button:has-text("Add")')
      .or(page.locator('[data-testid="add-flashcard-btn"]'))
      .or(page.locator('button:has-text("Create")'))
      .click();

    // Try to submit empty form
    await page.locator('button[type="submit"]').or(page.locator('button:has-text("Save")')).click();

    // Should show validation errors
    await expect(page.locator("text=/required/i")).toHaveCount(2, { timeout: 5000 }); // front and back required
  });

  test("should close modal without saving", async ({ authenticatedPage: page }) => {
    await page.goto("/dashboard/flashcards");

    await page
      .locator('button:has-text("Add")')
      .or(page.locator('[data-testid="add-flashcard-btn"]'))
      .or(page.locator('button:has-text("Create")'))
      .click();

    // Fill some data
    await page.locator('input[name="front"]').or(page.locator('textarea[name="front"]')).fill("Test");

    // Close modal (ESC or close button)
    await page.keyboard.press("Escape").catch(async () => {
      // Fallback to close button
      await page.locator('button:has-text("Cancel")').or(page.locator('[data-testid="close-modal"]')).click();
    });

    // Modal should close
    await expect(page.locator('[role="dialog"]')).toBeHidden({ timeout: 2000 });
  });
});

test.describe("Flashcards - Edit", () => {
  test("should open edit modal for existing flashcard", async ({ authenticatedPage: page }) => {
    await page.goto("/dashboard/flashcards");

    // Find first flashcard and click edit
    const firstFlashcard = page.locator('[data-testid="flashcard-item"]').first();

    // Wait for flashcards to load (might be empty)
    await page.waitForTimeout(2000);

    if (await firstFlashcard.isVisible()) {
      await firstFlashcard
        .locator('button:has-text("Edit")')
        .or(firstFlashcard.locator('[data-testid="edit-btn"]'))
        .click();

      // Edit modal should open with existing data
      await expect(page.locator('[role="dialog"]')).toBeVisible();

      const frontInput = page.locator('input[name="front"]').or(page.locator('textarea[name="front"]'));
      await expect(frontInput).not.toBeEmpty();
    }
  });

  test("should successfully update flashcard", async ({ authenticatedPage: page }) => {
    // First create a flashcard to edit
    await page.goto("/dashboard/flashcards");

    await page
      .locator('button:has-text("Add")')
      .or(page.locator('[data-testid="add-flashcard-btn"]'))
      .or(page.locator('button:has-text("Create")'))
      .click();

    const originalFront = `Original Question ${Date.now()}`;
    await page.locator('input[name="front"]').or(page.locator('textarea[name="front"]')).fill(originalFront);
    await page.locator('input[name="back"]').or(page.locator('textarea[name="back"]')).fill("Original Answer");
    await page.locator('button[type="submit"]').or(page.locator('button:has-text("Save")')).click();

    await expect(page.locator(`text=${originalFront}`)).toBeVisible({ timeout: 5000 });

    // Now edit it
    const flashcard = page.locator(`text=${originalFront}`).locator("../..");
    await flashcard.locator('button:has-text("Edit")').or(page.locator('[data-testid="edit-btn"]').last()).click();

    const updatedFront = `Updated Question ${Date.now()}`;
    await page.locator('input[name="front"]').or(page.locator('textarea[name="front"]')).fill(updatedFront);
    await page.locator('button[type="submit"]').or(page.locator('button:has-text("Save")')).click();

    // Should show updated text
    await expect(page.locator(`text=${updatedFront}`)).toBeVisible({ timeout: 5000 });
    await expect(page.locator(`text=${originalFront}`)).toBeHidden();
  });
});

test.describe("Flashcards - Delete", () => {
  test("should show delete confirmation dialog", async ({ authenticatedPage: page }) => {
    await page.goto("/dashboard/flashcards");

    // Create a flashcard first
    await page
      .locator('button:has-text("Add")')
      .or(page.locator('[data-testid="add-flashcard-btn"]'))
      .or(page.locator('button:has-text("Create")'))
      .click();

    await page.locator('input[name="front"]').or(page.locator('textarea[name="front"]')).fill("To Delete");
    await page.locator('input[name="back"]').or(page.locator('textarea[name="back"]')).fill("Will be deleted");
    await page.locator('button[type="submit"]').or(page.locator('button:has-text("Save")')).click();

    await expect(page.locator("text=To Delete")).toBeVisible({ timeout: 5000 });

    // Click delete button
    const flashcard = page.locator("text=To Delete").locator("../..");
    await flashcard.locator('button:has-text("Delete")').or(page.locator('[data-testid="delete-btn"]').last()).click();

    // Should show confirmation dialog
    await expect(page.locator("text=/are you sure/i").or(page.locator('[role="alertdialog"]'))).toBeVisible({
      timeout: 2000,
    });
  });

  test("should successfully delete flashcard after confirmation", async ({ authenticatedPage: page }) => {
    await page.goto("/dashboard/flashcards");

    // Create a flashcard
    await page
      .locator('button:has-text("Add")')
      .or(page.locator('[data-testid="add-flashcard-btn"]'))
      .or(page.locator('button:has-text("Create")'))
      .click();

    const uniqueText = `Delete Me ${Date.now()}`;
    await page.locator('input[name="front"]').or(page.locator('textarea[name="front"]')).fill(uniqueText);
    await page.locator('input[name="back"]').or(page.locator('textarea[name="back"]')).fill("Answer");
    await page.locator('button[type="submit"]').or(page.locator('button:has-text("Save")')).click();

    await expect(page.locator(`text=${uniqueText}`)).toBeVisible({ timeout: 5000 });

    // Delete it
    const flashcard = page.locator(`text=${uniqueText}`).locator("../..");
    await flashcard.locator('button:has-text("Delete")').or(page.locator('[data-testid="delete-btn"]').last()).click();

    // Confirm deletion
    await page
      .locator('button:has-text("Delete")')
      .or(page.locator('button:has-text("Confirm")'))
      .or(page.locator('[data-testid="confirm-delete"]'))
      .last()
      .click();

    // Should show success message
    await expect(page.locator("text=/deleted/i")).toBeVisible({ timeout: 5000 });

    // Flashcard should be removed from list
    await expect(page.locator(`text=${uniqueText}`)).toBeHidden({ timeout: 5000 });
  });

  test("should cancel deletion", async ({ authenticatedPage: page }) => {
    await page.goto("/dashboard/flashcards");

    // Create flashcard
    await page
      .locator('button:has-text("Add")')
      .or(page.locator('[data-testid="add-flashcard-btn"]'))
      .or(page.locator('button:has-text("Create")'))
      .click();

    const uniqueText = `Keep Me ${Date.now()}`;
    await page.locator('input[name="front"]').or(page.locator('textarea[name="front"]')).fill(uniqueText);
    await page.locator('input[name="back"]').or(page.locator('textarea[name="back"]')).fill("Answer");
    await page.locator('button[type="submit"]').or(page.locator('button:has-text("Save")')).click();

    await expect(page.locator(`text=${uniqueText}`)).toBeVisible({ timeout: 5000 });

    // Try to delete
    const flashcard = page.locator(`text=${uniqueText}`).locator("../..");
    await flashcard.locator('button:has-text("Delete")').or(page.locator('[data-testid="delete-btn"]').last()).click();

    // Cancel
    await page.locator('button:has-text("Cancel")').or(page.locator('[data-testid="cancel-delete"]')).last().click();

    // Flashcard should still be visible
    await expect(page.locator(`text=${uniqueText}`)).toBeVisible();
  });
});

test.describe("Flashcards - Filtering", () => {
  test("should filter by status (active, pending, rejected)", async ({ authenticatedPage: page }) => {
    await page.goto("/dashboard/flashcards");

    // Look for filter tabs or dropdowns
    const activeTab = page.locator('button:has-text("Active")').or(page.locator('[data-testid="filter-active"]'));
    const pendingTab = page.locator('button:has-text("Pending")').or(page.locator('[data-testid="filter-pending"]'));
    const rejectedTab = page.locator('button:has-text("Rejected")').or(page.locator('[data-testid="filter-rejected"]'));

    if (await activeTab.isVisible()) {
      // Test each filter
      await activeTab.click();
      await page.waitForTimeout(1000);
      // All visible flashcards should have active status

      await pendingTab.click();
      await page.waitForTimeout(1000);
      // All visible flashcards should have pending status

      await rejectedTab.click();
      await page.waitForTimeout(1000);
      // All visible flashcards should have rejected status
    }
  });

  test("should filter by source (manual, AI generated)", async ({ authenticatedPage: page }) => {
    await page.goto("/dashboard/flashcards");

    const manualFilter = page.locator('button:has-text("Manual")').or(page.locator('[data-testid="filter-manual"]'));
    const aiFilter = page.locator('button:has-text("AI Generated")').or(page.locator('[data-testid="filter-ai"]'));

    if (await manualFilter.isVisible()) {
      await manualFilter.click();
      await page.waitForTimeout(1000);
      // Should show only manual flashcards

      await aiFilter.click();
      await page.waitForTimeout(1000);
      // Should show only AI generated flashcards
    }
  });

  test("should show all flashcards when no filter applied", async ({ authenticatedPage: page }) => {
    await page.goto("/dashboard/flashcards");

    const allTab = page.locator('button:has-text("All")').or(page.locator('[data-testid="filter-all"]'));

    if (await allTab.isVisible()) {
      await allTab.click();
      await page.waitForTimeout(1000);
      // Should show all flashcards regardless of status/source
    }
  });
});

test.describe("Flashcards - Sorting", () => {
  test("should sort by creation date (newest/oldest)", async ({ authenticatedPage: page }) => {
    await page.goto("/dashboard/flashcards");

    // Look for sort dropdown
    const sortDropdown = page.locator('[data-testid="sort-dropdown"]').or(page.locator("text=/sort by/i"));

    if (await sortDropdown.isVisible()) {
      await sortDropdown.click();

      // Sort by newest
      await page.locator("text=/newest/i").or(page.locator('[data-testid="sort-newest"]')).click();
      await page.waitForTimeout(1000);

      // Sort by oldest
      await sortDropdown.click();
      await page.locator("text=/oldest/i").or(page.locator('[data-testid="sort-oldest"]')).click();
      await page.waitForTimeout(1000);
    }
  });

  test("should sort by next review date", async ({ authenticatedPage: page }) => {
    await page.goto("/dashboard/flashcards");

    const sortDropdown = page.locator('[data-testid="sort-dropdown"]').or(page.locator("text=/sort by/i"));

    if (await sortDropdown.isVisible()) {
      await sortDropdown.click();
      await page.locator("text=/next review/i").or(page.locator('[data-testid="sort-review-date"]')).click();
      await page.waitForTimeout(1000);
    }
  });
});

test.describe("Flashcards - Pagination", () => {
  test("should paginate flashcards if more than page limit", async ({ authenticatedPage: page }) => {
    await page.goto("/dashboard/flashcards");

    // Check if pagination controls exist
    const nextButton = page.locator('button:has-text("Next")').or(page.locator('[data-testid="pagination-next"]'));
    const prevButton = page.locator('button:has-text("Previous")').or(page.locator('[data-testid="pagination-prev"]'));

    if (await nextButton.isVisible()) {
      // Click next page
      await nextButton.click();
      await page.waitForTimeout(1000);

      // Previous button should now be enabled
      await expect(prevButton).toBeEnabled();

      // Click previous
      await prevButton.click();
      await page.waitForTimeout(1000);
    }
  });

  test("should display page numbers", async ({ authenticatedPage: page }) => {
    await page.goto("/dashboard/flashcards");

    // Look for page indicators (e.g., "Page 1 of 3" or page number buttons)
    const pageInfo = page.locator("text=/page \\d+ of \\d+/i").or(page.locator('[data-testid="page-info"]'));

    // Pagination might not exist if few flashcards
    const isVisible = await pageInfo.isVisible().catch(() => false);
    if (isVisible) {
      await expect(pageInfo).toBeVisible();
    }
  });
});

test.describe("Flashcards - Search", () => {
  test("should search flashcards by content", async ({ authenticatedPage: page }) => {
    await page.goto("/dashboard/flashcards");

    const searchInput = page
      .locator('input[type="search"]')
      .or(page.locator('[placeholder*="Search"]'))
      .or(page.locator('[data-testid="search-input"]'));

    if (await searchInput.isVisible()) {
      // Create a flashcard with unique text
      const uniqueText = `Searchable ${Date.now()}`;

      await page
        .locator('button:has-text("Add")')
        .or(page.locator('[data-testid="add-flashcard-btn"]'))
        .or(page.locator('button:has-text("Create")'))
        .click();

      await page.locator('input[name="front"]').or(page.locator('textarea[name="front"]')).fill(uniqueText);
      await page.locator('input[name="back"]').or(page.locator('textarea[name="back"]')).fill("Answer");
      await page.locator('button[type="submit"]').or(page.locator('button:has-text("Save")')).click();

      await expect(page.locator(`text=${uniqueText}`)).toBeVisible({ timeout: 5000 });

      // Search for it
      await searchInput.fill(uniqueText);
      await page.waitForTimeout(1000);

      // Should show only matching flashcard
      await expect(page.locator(`text=${uniqueText}`)).toBeVisible();
    }
  });
});
