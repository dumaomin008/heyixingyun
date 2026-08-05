import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const adminApiPort = process.env.ADMIN_API_PORT || "3100";

export default defineConfig({
  optimizeDeps: {
    include: ["react", "react-dom/client"],
  },
  server: {
    proxy: {
      "/api": {
        target: `http://127.0.0.1:${adminApiPort}`,
        changeOrigin: true,
      },
    },
    warmup: {
      clientFiles: ["./src/main.jsx"],
    },
  },
  plugins: [react()],
});
