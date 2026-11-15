import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  {
    files: ["src/components/**/*.tsx"],
    rules: { "@next/next/no-img-element": "off" },
  },
  {
    files: ["src/app/layout.tsx"],
    // This Pages Router rule does not recognize the shared App Router root layout.
    rules: { "@next/next/no-page-custom-font": "off" },
  },
  globalIgnores([
    ".next/**",
    "next-env.d.ts",
    ".local/**",
    "playwright-report/**",
    "test-results/**",
  ]),
]);
