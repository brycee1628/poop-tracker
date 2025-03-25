<template>
    <div class="container">
        <h1>💩 大便次數排行榜 💩</h1>
        <p class="subtitle">讓我們一起譜寫歷屎 📖</p>
        <p class="total">經過大家的努力，總共創造了{{ totalCount }}次歷💩囉</p>
        <div v-if="topPooper" class="marquee">
            <span>榜一{{ topPooper.name }}: 吾乃歷💩名將，誰敢與我一爭？不服來戰！</span>
        </div>

        <div v-for="({ name, count }, index) in sortedPoopList" :key="name" class="card"
            :class="{ first: index === 0 }">
            <h2>
                第{{ index + 1 }}名
                <span v-if="index === 0">👑</span>
                {{ name }}
            </h2>
            <p>{{ count }} 次</p>
        </div>
    </div>
</template>


<script setup>
import { reactive, onMounted, computed } from 'vue';
import { database, ref, onValue } from '../firebase';

const poopData = reactive({});

const sortedPoopList = computed(() => {
    return Object.entries(poopData)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);
});

const totalCount = computed(() => {
    return Object.values(poopData).reduce((sum, count) => sum + count, 0);
});

const topPooper = computed(() => {
    return sortedPoopList.value.length > 0 ? sortedPoopList.value[0] : null;
});


const poopRef = ref(database, 'poopCounter');

onMounted(() => {
    onValue(poopRef, (snapshot) => {
        const data = snapshot.val() || {};
        Object.keys(poopData).forEach((key) => delete poopData[key]);
        Object.keys(data).forEach((name) => {
            poopData[name] = data[name];
        });
    });
});
</script>

<style scoped>
.subtitle {
    font-size: 1.5em;
    /* 稍微增大標題字型 */
    color: #666;
    margin-bottom: 30px;
    /* 增加下方的間距 */
    font-style: italic;
}

@keyframes fadeSlideIn {
    to {
        opacity: 1;
        transform: translateY(0) scale(1);
    }
}


.container {
    max-width: 800px;
    /* 增大容器寬度，讓畫面更寬鬆 */
    margin: auto;
    text-align: center;
    padding: 20px;
    /* 增加內邊距 */
}

.total {
    font-size: 1.2em;
    color: #444;
    margin-bottom: 20px;
    font-weight: 500;
}

.marquee {
    position: relative;
    width: 100%;
    overflow: hidden;
    height: 2em;
    margin-bottom: 20px;
}

.marquee span {
    display: inline-block;
    min-width: 100%; /* ⭐ 保證不會太小，也能適應不同寬度 */
    white-space: nowrap;
    animation: scroll-left 15s linear infinite;
    font-size: 1em; /* ⭐ 改用相對單位，適應手機縮放 */
    font-weight: bold;
    color: #e65100;
}

@keyframes scroll-left {
    0% {
        transform: translateX(100%);
    }
    100% {
        transform: translateX(-100%);
    }
}

@media (max-width: 480px) {
    .marquee span {
        font-size: 0.9em;
    }

    .card h2 {
        font-size: 1.2em;
    }

    .card p {
        font-size: 1em;
    }
}

.card {
    border: 1px solid #ccc;
    padding: 16px;
    margin: 12px 0;
    border-radius: 8px;
}

.card.first {
    background: linear-gradient(135deg, #ffe082, #fff8e1);
    box-shadow: 0 0 20px gold;
    transform: scale(1.03);
}

.card.first h2 {
    font-size: 1.8em;
    font-weight: bold;
    color: #e65100;
}

.card.first p {
    font-size: 1.3em;
    font-weight: 600;
    color: #6d4c41;
}
</style>