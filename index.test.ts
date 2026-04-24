import { test, expect } from "bun:test";
import fc from "fast-check";

test("property-based example: reverse reverse is original", () => {
  fc.assert(
    fc.property(fc.string(), (text) => {
      expect(text.split('').reverse().reverse().join('')).toBe(text);
    })
  );
});