import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],

  // Make paths work inside the Chrome extension
  base: "./",

  build: {
    // Put the React build inside the extension
    outDir: "../extension/wishlist",
    emptyOutDir: true,
  },
});