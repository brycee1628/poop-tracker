<template>
    <div class="container">
        <h1>💩 排行榜 💩</h1>
        <p class="subtitle">讓我們一起譜寫歷屎 📖</p>
        <p class="total">當前魔力濃度 {{ totalAllCount }}</p>
        <div v-if="topPooper" class="marquee">
            <span>{{ randomMarqueeText }}</span>
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
import { reactive, onMounted, computed, ref as vueRef } from 'vue';
import { database, ref, onValue, get } from '../firebase';

const poopData = reactive({});
const historicalTotal = vueRef(0);
const randomMarqueeText = vueRef('');

const marqueeTexts = [
    (name) => `榜一${name}: 吾乃歷💩名將，誰敢與我一爭？不服來💩！`,
    (name) => `榜一${name}：屎間還很多，我可以等你。`
];

const sortedPoopList = computed(() => {
    return Object.entries(poopData)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);
});

const totalCount = computed(() => {
    return Object.values(poopData).reduce((sum, count) => sum + count, 0);
});

const totalAllCount = computed(() => {
    return totalCount.value + historicalTotal.value;
});

const topPooper = computed(() => {
    if (sortedPoopList.value.length > 0) {
        const top = sortedPoopList.value[0];
        // 當排行榜資料更新時，隨機選擇一條跑馬燈文字
        updateRandomMarqueeText(top.name);
        return top;
    }
    return null;
});

// 更新隨機跑馬燈文字
function updateRandomMarqueeText(name) {
    const randomIndex = Math.floor(Math.random() * marqueeTexts.length);
    randomMarqueeText.value = marqueeTexts[randomIndex](name);
}

// 獲取歷史數據總和
const fetchHistoricalTotal = async () => {
    const historyRef = ref(database, 'monthlyHistory');
    const snapshot = await get(historyRef);
    const historyData = snapshot.val() || {};

    let total = 0;

    // 遍歷每個月份
    Object.values(historyData).forEach(monthData => {
        // 遍歷每個月份中的每個人的數據
        Object.values(monthData).forEach(count => {
            total += count;
        });
    });

    historicalTotal.value = total;
};

const poopRef = ref(database, 'poopCounter');

onMounted(() => {
    // 獲取當前月份數據
    onValue(poopRef, (snapshot) => {
        const data = snapshot.val() || {};
        // 優化數據處理方式，避免不必要的刪除和重新創建
        Object.keys(poopData).forEach(key => {
            if (!(key in data)) {
                delete poopData[key];
            }
        });

        Object.entries(data).forEach(([key, value]) => {
            poopData[key] = value;
        });
    });

    // 獲取歷史數據總和
    fetchHistoricalTotal();
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

.total-all {
    font-size: 0.9em;
    color: #666;
    margin-left: 5px;
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
    min-width: 100%;
    /* ⭐ 保證不會太小，也能適應不同寬度 */
    white-space: nowrap;
    animation: scroll-left 15s linear infinite;
    font-size: 1em;
    /* ⭐ 改用相對單位，適應手機縮放 */
    font-weight: bold;
    color: #e65100;
}

/* 添加滑鼠懸停時暫停滾動效果 */
@media (hover: hover) {
    .marquee:hover span {
        animation-play-state: paused;
    }
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
    transition: transform 0.3s ease, box-shadow 0.3s ease;
    /* 添加過渡效果 */
}

.card:hover {
    transform: translateY(-3px);
    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
}

.card.first {
    background: linear-gradient(135deg, #ffe082, #fff8e1);
    box-shadow: 0 0 20px gold;
    transform: scale(1.03);
}

.card.first:hover {
    transform: scale(1.05);
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