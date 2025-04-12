<template>
    <div class="container">
        <h1>💩 排行榜 💩</h1>
        <p class="subtitle">讓我們一起譜寫歷屎 📖</p>
        <p class="total">當前魔力濃度 {{ totalAllCount }}</p>
        <div v-if="topPooper" class="marquee">
            <span>榜一{{ topPooper.name }}: {{ topPooper.declaration || '吾乃歷💩名將，誰敢與我一爭？不服來💩！' }}</span>
        </div>

        <div class="leaderboard">
            <div v-for="(data, index) in sortedPoopList" :key="data.name" class="user-card"
                :class="{ 'top-user': index === 0 }" @click="goToUserDetail(data.name)">
                <h2>
                    第{{ index + 1 }}名
                    <span v-if="index === 0">👑</span>
                    {{ data.name }}
                </h2>
                <p>{{ data.count }} 次</p>
            </div>
        </div>
    </div>
</template>


<script setup>
import { reactive, onMounted, computed, ref as vueRef } from 'vue';
import { database, ref, onValue, get } from '../firebase';
import { useRouter } from 'vue-router';

const poopData = reactive({});
const historicalTotal = vueRef(0);
const router = useRouter();

const sortedPoopList = computed(() => {
    return Object.entries(poopData)
        .map(([name, data]) => {
            // 處理舊數據格式
            if (typeof data === 'number') {
                return {
                    name,
                    count: data,
                    declaration: null
                };
            }
            return {
                name,
                count: data?.count || 0,
                declaration: data?.declaration
            };
        })
        .sort((a, b) => b.count - a.count);
});

const totalCount = computed(() => {
    return Object.values(poopData).reduce((sum, data) => {
        // 處理舊數據格式
        if (typeof data === 'number') {
            return sum + data;
        }
        return sum + (data?.count || 0);
    }, 0);
});

const totalAllCount = computed(() => {
    return totalCount.value + historicalTotal.value;
});

const topPooper = computed(() => {
    return sortedPoopList.value.length > 0 ? sortedPoopList.value[0] : null;
});

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

function goToUserDetail(name) {
    router.push(`/user/${name}`);
}
</script>

<style scoped>
.subtitle {
    font-size: 1.5em;
    color: #666;
    margin-bottom: 30px;
    font-style: italic;
}

.container {
    max-width: 800px;
    margin: auto;
    text-align: center;
    padding: 20px;
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
    min-width: 100%;
    white-space: nowrap;
    animation: scroll-left 15s linear infinite;
    font-size: 1em;
    font-weight: bold;
    color: #e65100;
}

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

.user-card {
    border: 1px solid #ccc;
    padding: 16px;
    margin: 12px 0;
    border-radius: 8px;
    transition: transform 0.3s ease, box-shadow 0.3s ease;
    cursor: pointer;
}

.user-card:hover {
    transform: translateY(-3px);
    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
}

.user-card.top-user {
    background: linear-gradient(135deg, #ffe082, #fff8e1);
    box-shadow: 0 0 20px gold;
    transform: scale(1.03);
}

.user-card.top-user:hover {
    transform: scale(1.05);
}

.user-card.top-user h2 {
    font-size: 1.8em;
    font-weight: bold;
    color: #e65100;
}

.user-card.top-user p {
    font-size: 1.3em;
    font-weight: 600;
    color: #6d4c41;
}

.user-card h2 {
    margin-bottom: 8px;
    color: #333;
}

.user-card p {
    color: #666;
    font-size: 1.1em;
}

@media (max-width: 480px) {
    .marquee span {
        font-size: 0.9em;
    }

    .user-card h2 {
        font-size: 1.2em;
    }

    .user-card p {
        font-size: 1em;
    }
}
</style>