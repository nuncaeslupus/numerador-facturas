import js from "@eslint/js";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";
import globals from "globals";

export default tseslint.config(
  {
    ignores: [
      "dist",
      "mcp/dist",
      "node_modules",
      "public/pdfjs",
      "claude-arsenal",
      ".claude",
      "data",
      "tmp",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { languageOptions: { globals: { ...globals.browser, ...globals.es2022 } } },
  {
    files: ["tests/**", "mcp/**", "scripts/**", "vite.config.ts", "vite.mcp.config.ts"],
    languageOptions: { globals: { ...globals.node } },
  },
  prettier,
);
