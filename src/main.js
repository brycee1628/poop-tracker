import { createApp } from "vue";
import "./style.css";
import "./mixins.scss";
import App from "./App.vue";
import router from "./router";
import DevUI from "vue-devui";
import "vue-devui/style.css";
import "@devui-design/icons/icomoon/devui-icon.css";
import { ThemeServiceInit, infinityTheme } from "devui-theme";

const APP_VERSION = typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "dev";

// 瀏覽器控制台輸入 ver 即可確認前端版號
window.ver = APP_VERSION;
console.info(`[屎記] v${APP_VERSION}（控制台輸入 ver 可再查）`);

ThemeServiceInit({ infinityTheme }, "infinityTheme");
createApp(App).use(router).use(DevUI).mount("#app");

