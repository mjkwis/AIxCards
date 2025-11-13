import type { Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import type { Result } from "axe-core";

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
  const violations = (await checkAccessibility(page, {
    excludedRules: options?.excludedRules,
  })) as Result[];

  if (violations.length > 0) {
    const violationDetails = violations
      .map(
        (violation: Result) =>
          `- ${violation.id}: ${violation.description}\n  Impact: ${violation.impact}\n  Help: ${violation.helpUrl}`
      )
      .join("\n");

    throw new Error(`Accessibility violations found:\n${violationDetails}`);
  }

  return violations;
}
