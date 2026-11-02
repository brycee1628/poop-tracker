import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import pkg from "./package.json";

// https://vitejs.dev/config/
export default defineConfig({
    base: "/poop-tracker/",
    plugins: [vue()],
    define: {
        __APP_VERSION__: JSON.stringify(pkg.version),
    },
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

