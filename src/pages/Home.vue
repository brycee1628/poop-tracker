<template>
    <div class="container">
        <h1>💩 大便次數排行榜 💩</h1>
        <p class="subtitle">讓我們一起譜寫歷屎 📖</p>

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

.card {
    border: 1px solid #ccc;
    padding: 20px;
    /* 增加內邊距 */
    margin: 20px 0;
    /* 增加卡片之間的距離 */
    border-radius: 8px;
    transition: transform 0.3s ease;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
    /* 微妙的陰影效果 */
}

/* 🌟 第一名特效 */
.card.first {
    background: linear-gradient(135deg, #ffe082, #fff8e1);
    box-shadow:
        0 0 40px gold,
        0 0 50px orange,
        0 0 60px red,
        0 0 80px rgba(255, 69, 0, 0.8),
        0 0 100px rgba(255, 69, 0, 0.7),
        0 0 120px rgba(255, 165, 0, 0.8);
    /* 更多層次的火焰陰影 */
    transform: scale(1.05);
    /* 更大一點的縮放效果 */
    animation: flame 1s ease-in-out infinite;
    /* 更強烈的火焰動畫 */
}

/* 火焰動畫效果 */
@keyframes flame {
    0% {
        box-shadow:
            0 0 40px gold,
            0 0 50px orange,
            0 0 60px red,
            0 0 80px rgba(255, 69, 0, 0.8),
            0 0 100px rgba(255, 69, 0, 0.7),
            0 0 120px rgba(255, 165, 0, 0.8);
        transform: scale(1.05);
    }

    25% {
        box-shadow:
            0 0 50px gold,
            0 0 70px orange,
            0 0 90px red,
            0 0 110px rgba(255, 69, 0, 0.9),
            0 0 140px rgba(255, 165, 0, 1);
        transform: scale(1.07);
        /* 增加縮放效果 */
    }

    50% {
        box-shadow:
            0 0 70px gold,
            0 0 90px orange,
            0 0 120px red,
            0 0 150px rgba(255, 69, 0, 1),
            0 0 180px rgba(255, 165, 0, 1);
        transform: scale(1.1);
        /* 最強的縮放效果 */
    }

    75% {
        box-shadow:
            0 0 50px gold,
            0 0 70px orange,
            0 0 90px red,
            0 0 110px rgba(255, 69, 0, 0.8),
            0 0 140px rgba(255, 165, 0, 0.9);
        transform: scale(1.07);
        /* 縮放稍微回縮 */
    }

    100% {
        box-shadow:
            0 0 40px gold,
            0 0 50px orange,
            0 0 60px red,
            0 0 80px rgba(255, 69, 0, 0.8),
            0 0 100px rgba(255, 69, 0, 0.7),
            0 0 120px rgba(255, 165, 0, 0.8);
        transform: scale(1.05);
        /* 恢復到初始縮放效果 */
    }
}

.card.first h2 {
    font-size: 2em;
    /* 更大的字型 */
    font-weight: bold;
    color: #ff4500;
    /* 更加亮眼的火紅色 */
    text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
    /* 文字添加陰影 */
}

.card.first p {
    font-size: 1.5em;
    /* 更大的字型 */
    font-weight: 600;
    color: #6d4c41;
    text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.2);
    /* 文字添加陰影 */
}
</style>