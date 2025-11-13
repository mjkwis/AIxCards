import { test, expect } from "@playwright/test";
import { generateTestUser } from "./fixtures/auth";

/**
 * E2E Tests for Authentication Flow
 * Tests: Registration, Login, Logout, Password Reset, Account Deletion
 */

test.describe("Authentication - Registration", () => {
  test("should successfully register a new user", async ({ page }) => {
    const user = generateTestUser();
    await page.goto("/register");

    // Fill registration form using accessible labels
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Hasło", { exact: true }).fill(user.password);
    await page.getByLabel("Powtórz hasło").fill(user.password);

    // Wait for all password requirements to be met (green checkmarks)
    await expect(page.locator('text="✓ Co najmniej 8 znaków"')).toBeVisible();
    await expect(page.locator('text="✓ Jedna wielka litera"')).toBeVisible();
    await expect(page.locator('text="✓ Jedna cyfra"')).toBeVisible();

    // Submit form using role-based selector
    await page.getByRole("button", { name: "Zarejestruj się" }).click();

    // Wait for navigation to complete
    await page.waitForURL(/\/dashboard\/generate/, { timeout: 10000 });

    // Verify user is logged in
    // On desktop: user dropdown should be visible
    // On mobile: hamburger menu should be visible
    const userDropdown = page.locator('[data-testid="user-dropdown-trigger"]');
    const mobileMenu = page.locator('[data-testid="mobile-menu-trigger"]');

    // At least one of them should be visible (depending on viewport)
    const isUserDropdownVisible = await userDropdown.isVisible();
    const isMobileMenuVisible = await mobileMenu.isVisible();

    expect(isUserDropdownVisible || isMobileMenuVisible).toBeTruthy();
  });

  test("should show validation error for short password", async ({ page }) => {
    await page.goto("/register");

    const user = generateTestUser();
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Hasło", { exact: true }).fill("short");
    await page.getByLabel("Powtórz hasło").fill("short");

    // Password requirements should still show red circles (not met)
    await expect(page.locator('text="○ Co najmniej 8 znaków"')).toBeVisible();

    // Try to submit
    await page.getByRole("button", { name: "Zarejestruj się" }).click();

    // Should show password length error
    await expect(page.getByText(/hasło.*co najmniej.*8.*znaków/i)).toBeVisible({ timeout: 5000 });
  });
});
