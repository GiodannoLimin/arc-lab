import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  // A project Pages deployment lives below /<repository>/; local previews use /.
  base: process.env.BASE_PATH || "/",
});
