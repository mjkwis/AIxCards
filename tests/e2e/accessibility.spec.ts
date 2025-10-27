import { test, expect } from '@playwright/test';
import { assertNoAccessibilityViolations } from './helpers/accessibility';

/**
 * Accessibility tests using axe-core
 * Ensures WCAG 2.1 AA compliance
 */
test.describe('Accessibility', () => {
  test('homepage should have no accessibility violations', async ({ page }) => {
    await page.goto('/');
    
    const violations = await assertNoAccessibilityViolations(page);
    expect(violations).toHaveLength(0);
  });

  test('login page should have no accessibility violations', async ({ page }) => {
    await page.goto('/login');
    
    const violations = await assertNoAccessibilityViolations(page);
    expect(violations).toHaveLength(0);
  });

  test('register page should have no accessibility violations', async ({ page }) => {
    await page.goto('/register');
    
    const violations = await assertNoAccessibilityViolations(page);
    expect(violations).toHaveLength(0);
  });

  test('dashboard should have no accessibility violations', async ({ page }) => {
    // This test would require authentication
    // You can extend it with the auth fixture when ready
    test.skip();
  });
});

