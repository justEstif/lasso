import js from "@eslint/js";
import sonarjs from "eslint-plugin-sonarjs";
import unicorn from "eslint-plugin-unicorn";
import perfectionist from "eslint-plugin-perfectionist";

export default [
  js.configs.recommended,
  sonarjs.configs.recommended,
  unicorn.configs.recommended,
  perfectionist.configs["recommended-natural"],
  {
    rules: {
      "complexity": ["error", 10],
      "max-depth": ["error", 3],
      "max-lines-per-function": ["error", 40],
      "max-params": ["error", 4],
      "max-statements": ["error", 20],
      "no-console": "error"
    }
  }
];