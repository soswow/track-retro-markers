import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["node_modules/**", "outputs/**", "dist/**", "dist-web/**"]
  },
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.ts", "src/**/*.tsx", "vite.config.ts"],
    rules: {
      curly: ["error", "all"]
    }
  }
);
