import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

// https://vitejs.dev/config/
export default defineConfig({
    base: "/poop-tracker/",
    plugins: [vue()],
    server: {
        port: 3000,
        open: true,
        proxy: {
            "/api/nearby-toilets": {
                target: "https://us-central1-poop-counter-a4309.cloudfunctions.net",
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/api\/nearby-toilets/, "/nearbyToilets"),
            },
        },
    },
});
