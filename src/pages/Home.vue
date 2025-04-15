<template>
    <div class="container">
        <h1>💩 排行榜 💩</h1>
        <p class="subtitle">讓我們一起譜寫歷屎 📖</p>
        <p class="total">當前魔力濃度 {{ totalAllCount }}</p>
        <div v-if="topPooper" class="marquee">
            <span>榜一{{ topPooper.name }}: {{ topPooper.declaration || '吾乃歷💩名將，誰敢與我一爭？不服來💩！' }}</span>
        </div>

        <div class="search-container">
            <input 
                type="text" 
                v-model="searchQuery" 
                placeholder="搜尋歷屎人物" 
                class="search-input"
            />
        </div>

        <div class="leaderboard">
            <div v-for="(data, index) in filteredPoopList" :key="data.name" class="user-card"
                :class="{ 'top-user': index === 0 }" @click="goToUserDetail(data.name)">
                <div class="card-header">
                    <h2>
                        第{{ index + 1 }}名
                        <span v-if="index === 0">👑</span>
                        {{ data.name }}
                    </h2>
                    <div class="health-indicator">
                        <div class="health-dot" :class="data.status" :title="data.status === 'green' ? '健康狀態良好' :
                            data.status === 'orange' ? '已4天未上廁所' :
                                data.status === 'red' ? '已5天以上未上廁所' : '未知狀態'"></div>
                    </div>
                </div>
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
const searchQuery = vueRef('');

const sortedPoopList = computed(() => {
    return Object.entries(poopData)
        .map(([name, data]) => {
            // 處理舊數據格式
            if (typeof data === 'number') {
                return {
                    name,
                    count: data,
                    declaration: null,
                    status: getHealthStatus(null) // 無法判斷狀態
                };
            }

            // 計算健康狀態
            const status = getHealthStatus(data.dailyRecords);

            return {
                name,
                count: data?.count || 0,
                declaration: data?.declaration,
                status: status
            };
        })
        .sort((a, b) => b.count - a.count);
});

const filteredPoopList = computed(() => {
    if (!searchQuery.value) return sortedPoopList.value;
    
    return sortedPoopList.value.filter(item => 
        item.name.toLowerCase().includes(searchQuery.value.toLowerCase())
    );
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

// 計算健康狀態：綠燈（正常）、橘燈（2天沒上廁所）、紅燈（3天及以上）
function getHealthStatus(dailyRecords) {
    // 如果沒有 dailyRecords 數據結構
    if (!dailyRecords) {
        // 檢查是否有今天的數據 (但沒有具體記錄)
        // 將這種數據視為當月1號的記錄
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1;
        const firstDayStr = `${year}-${String(month).padStart(2, '0')}-01`;

        // 假設有當月1號的記錄，但仍根據時間判斷燈號顏色
        return getStatusBasedOnDate(firstDayStr);
    }

    // 找到最後一次記錄的日期
    const dates = Object.keys(dailyRecords).sort().reverse();
    if (dates.length === 0) {
        // 今天剛開始記錄的情況
        return 'green';
    }

    const lastRecordDate = dates[0];
    return getStatusBasedOnDate(lastRecordDate);
}

// 根據日期計算健康狀態
function getStatusBasedOnDate(dateStr) {
    const now = new Date();
    const today = now.toISOString().split('T')[0]; // 取得今天的日期字串 (YYYY-MM-DD)
    const lastRecordDate = new Date(dateStr);
    
    // 計算日期差異（天數）
    const diffTime = now - lastRecordDate;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    // 判斷狀態
    if (diffDays <= 3) {
        return 'green'; // 今天到3天內有記錄，正常
    } else if (diffDays == 4) {
        return 'orange'; // 第4天還沒記錄，警告
    } else {
        return 'red'; // 5天及以上沒記錄，危險
    }
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
    margin: 0;
    margin-bottom: 8px;
    color: #333;
    font-size: 1.2em;
    flex: 1;
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

.card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
}

.health-indicator {
    display: flex;
    align-items: center;
    justify-content: center;
    margin-left: 8px;
}

.health-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    box-shadow: 0 0 2px rgba(0, 0, 0, 0.2);
}

.health-dot.green {
    background-color: #4CAF50;
    box-shadow: 0 0 3px rgba(76, 175, 80, 0.5);
}

.health-dot.orange {
    background-color: #FF9800;
    box-shadow: 0 0 3px rgba(255, 152, 0, 0.5);
}

.health-dot.red {
    background-color: #F44336;
    box-shadow: 0 0 3px rgba(244, 67, 54, 0.5);
}

.health-dot.unknown {
    background-color: #9E9E9E;
}

/* 搜尋欄樣式 */
.search-container {
    margin-bottom: 20px;
    width: 100%;
}

.search-input {
    padding: 10px 15px;
    width: 100%;
    max-width: 500px;
    border-radius: 8px;
    border: 1px solid #ccc;
    font-size: 1rem;
    box-sizing: border-box;
    transition: all 0.3s ease;
}

.search-input:focus {
    outline: none;
    border-color: #FF9800;
    box-shadow: 0 0 5px rgba(255, 152, 0, 0.3);
}

@media (max-width: 480px) {
    .search-input {
        font-size: 0.9rem;
        padding: 8px 12px;
    }
}
</style>