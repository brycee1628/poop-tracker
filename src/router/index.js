import { createRouter, createWebHashHistory } from "vue-router";
import Home from "../pages/Home.vue";
import History from "../pages/History.vue";

const routes = [
    {
        path: "/",
        component: Home,
    },
    {
        path: '/history',
        component: History,
    }
];

const router = createRouter({
    history: createWebHashHistory(),
    routes,
});

export default router;
