import { createRouter, createWebHistory } from "vue-router";
import Home from "../pages/Home.vue";
import History from "../pages/History.vue";
import UserDetail from "../pages/UserDetail.vue";
import GachaPage from "../pages/GachaPage.vue";
import NearbyToiletsPage from "../pages/NearbyToiletsPage.vue";

const routes = [
    {
        path: "/",
        name: "Home",
        component: Home,
    },
    {
        path: '/history',
        name: 'History',
        component: History,
    },
    {
        path: '/user/:name',
        name: 'UserDetail',
        component: UserDetail
    },
    {
        path: '/gacha',
        name: 'GachaPage',
        component: GachaPage
    },
    {
        path: '/toilets',
        name: 'NearbyToilets',
        component: NearbyToiletsPage,
    },
];

const router = createRouter({
    history: createWebHistory("/poop-tracker/"),
    routes,
});

export default router;
