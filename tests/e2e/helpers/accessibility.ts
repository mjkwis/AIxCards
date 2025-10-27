import { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Run accessibility checks on a page
 * Follows WCAG 2.1 AA standards
 */
export async function checkAccessibility(
  page: Page,
  options?: {
    detailedReport?: boolean;
    includedRules?: string[];
    excludedRules?: string[];
  }
) {
  const builder = new AxeBuilder({ page });

  // Configure rules if provided
  if (options?.includedRules) {
    builder.withRules(options.includedRules);
  }
  if (options?.excludedRules) {
    builder.disableRules(options.excludedRules);
  }

  // Run the accessibility scan
  const results = await builder.analyze();

  // Return detailed report if requested
  if (options?.detailedReport) {
    return results;
  }

  // Otherwise, just return violations
  return results.violations;
}

/**
 * Assert that a page has no accessibility violations
 */
export async function assertNoAccessibilityViolations(
  page: Page,
  options?: {
    excludedRules?: string[];
  }
) {
  const violations = await checkAccessibility(page, {
    excludedRules: options?.excludedRules,
  });

  if (violations.length > 0) {
    console.error('Accessibility violations found:');
    violations.forEach((violation) => {
      console.error(`- ${violation.id}: ${violation.description}`);
      console.error(`  Impact: ${violation.impact}`);
      console.error(`  Help: ${violation.helpUrl}`);
    });
  }

  return violations;
}

