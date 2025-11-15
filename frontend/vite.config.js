import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
	plugins: [svelte()],
	// Use relative paths for better GitHub Pages compatibility
	// Works with both custom domains and project pages
	base: process.env.BASE_PATH || "./",
});
