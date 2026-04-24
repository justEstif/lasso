import js from "@eslint/js";
import sonarjs from "eslint-plugin-sonarjs";
import unicorn from "eslint-plugin-unicorn";
import perfectionist from "eslint-plugin-perfectionist";
import tseslint from 'typescript-eslint';

export default tseslint.config(
  js.configs.recommended,
  sonarjs.configs.recommended,
  unicorn.configs.recommended,
  perfectionist.configs["recommended-natural"],
  ...tseslint.configs.recommended,
  {
    rules: {
      "complexity": ["error", 10],
      "max-depth": ["error", 3],
      "max-lines-per-function": ["error", 40],
      "max-params": ["error", 4],
      "max-statements": ["error", 20],
      "no-console": "off",
      "unicorn/prevent-abbreviations": "off",
      "unicorn/no-null": "off"
    }
  }
);