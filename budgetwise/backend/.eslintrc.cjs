module.exports = {
  root: true,
  ignorePatterns: ["dist/", "node_modules/"],
  env: { node: true, es2022: true },
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint"],
  extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended"],
  overrides: [
    {
      files: ["src/services/aiInsights.ts"],
      rules: { "@typescript-eslint/no-explicit-any": "off" },
    },
  ],
};
