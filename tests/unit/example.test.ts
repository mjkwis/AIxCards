import { describe, it, expect } from "vitest";

/**
 * Example unit test
 * This demonstrates the basic structure of a Vitest unit test
 */
describe("Example Test Suite", () => {
  it("should pass a basic assertion", () => {
    expect(1 + 1).toBe(2);
  });

  it("should work with async operations", async () => {
    const result = await Promise.resolve("test");
    expect(result).toBe("test");
  });

  it("should handle arrays", () => {
    const arr = [1, 2, 3];
    expect(arr).toHaveLength(3);
    expect(arr).toContain(2);
  });

  it("should handle objects", () => {
    const obj = { name: "Test", value: 42 };
    expect(obj).toHaveProperty("name");
    expect(obj).toMatchObject({ value: 42 });
  });
});
