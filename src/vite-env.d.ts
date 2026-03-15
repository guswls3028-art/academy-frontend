/// <reference types="vite/client" />

declare module "*.svg?raw" {
  const content: string;
  export default content;
}

declare const __BUILD_TIMESTAMP__: string;
