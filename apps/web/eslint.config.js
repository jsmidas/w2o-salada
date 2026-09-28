import { nextJsConfig } from "@repo/eslint-config/next-js";

/**
 * 공용 설정에 이 앱의 사정을 덧붙인다.
 * 아래 세 가지는 규칙이 App Router·styled-jsx 를 모르고 내는 오탐이라 꺼 둔다.
 *
 * @type {import("eslint").Linter.Config[]}
 */
export default [
  ...nextJsConfig,
  {
    // <style jsx global> 은 Next 가 기본 제공하는 styled-jsx 문법인데
    // React 규칙이 모르는 DOM 속성으로 본다
    files: ["**/*.tsx"],
    rules: {
      "react/no-unknown-property": ["warn", { ignore: ["jsx", "global"] }],
    },
  },
  {
    // App Router 에는 pages/_document.js 자체가 없다 (Pages Router 전용 규칙)
    files: ["app/**/*.tsx"],
    rules: {
      "@next/next/no-page-custom-font": "off",
    },
  },
  {
    // 설정 파일은 Node 에서 실행된다 — process·module 은 전역으로 존재한다
    files: ["*.config.js", "*.config.mjs", "*.config.ts"],
    languageOptions: {
      globals: { process: "readonly", module: "writable", require: "readonly", __dirname: "readonly" },
    },
  },
];
