<template>
    <div class="container">
        <h1>💩屎記💩</h1>
        <p class="subtitle">承載著我們消失於漩渦的一切。</p>
        <p class="description">
            每一次沖水，都是一次送行。<br>
            任它在漩渦中消失，彷彿從未存在。<br><br>

            但屎記，會記得。<br>
            為每一次努力，寫下歷屎。<br>
        </p>

        <select v-model="selectedMonth" @change="fetchHistory">
            <option v-for="month in availableMonths" :key="month" :value="month">
                {{ month }}
            </option>
        </select>

        <div v-if="sortedHistory.length" class="history-list">
            <div v-for="({ name, count }, index) in sortedHistory" :key="name" class="card"
                :class="{ first: index === 0 }">
                <h2>第{{ index + 1 }}名 <span v-if="index === 0">👑</span> {{ name }}</h2>
                <p>{{ count }} 次</p>
            </div>
        </div>

        <p v-else class="empty">尚無資料</p>
    </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { database, ref as dbRef, onValue } from '../firebase';

const selectedMonth = ref('');
const availableMonths = ref([]);
const historyData = ref({});

const sortedHistory = computed(() => {
    // 確保我們有正確的資料格式
    return Object.entries(historyData.value)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);
});

function fetchHistory() {
    if (!selectedMonth.value) return;

    const monthRef = dbRef(database, `monthlyHistory/${selectedMonth.value}`);
    onValue(monthRef, (snapshot) => {
        const data = snapshot.val() || {};
        console.log("Fetched data:", data); // 這裡檢查資料是否正確
        historyData.value = data;
    });
}

// 獲取上個月的年月
function getPreviousMonth() {
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const year = lastMonth.getFullYear();
    const month = String(lastMonth.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
}

onMounted(() => {
    const monthsRef = dbRef(database, 'monthlyHistory');
    onValue(monthsRef, (snapshot) => {
        const months = snapshot.val();
        if (months) {
            availableMonths.value = Object.keys(months).sort().reverse();

            // 設置預設月份為上個月或最新的一個月
            const previousMonth = getPreviousMonth();
            if (availableMonths.value.includes(previousMonth)) {
                selectedMonth.value = previousMonth;
            } else if (availableMonths.value.length > 0) {
                selectedMonth.value = availableMonths.value[0]; // 最新的月份
            }

            // 自動獲取選定月份的歷史數據
            fetchHistory();
        }
    });
});
</script>

<style scoped>
.container {
    max-width: 600px;
    margin: auto;
    text-align: center;
}

.subtitle {
    font-size: 1.2em;
    color: #666;
    margin-bottom: 20px;
    font-style: italic;
}

.description {
    font-size: 1.1em;
    line-height: 1.8;
    color: #4a3f35;
    /* 深褐灰，溫潤感 */
    background-color: #fdfaf7;
    /* 淡米色，像廁紙一樣柔和 */
    padding: 20px;
    border-left: 4px solid #d6c2a1;
    /* 仿古書頁邊線感 */
    border-radius: 8px;
    max-width: 600px;
    margin: 0 auto 30px auto;
    font-family: 'Georgia', serif;
    /* 讓它有一點書寫感 */
}

select {
    padding: 8px 12px;
    font-size: 1em;
    margin-bottom: 20px;
    border-radius: 8px;
    border: 1px solid #ccc;
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

.empty {
    color: #999;
    margin-top: 20px;
    font-style: italic;
}
</style>
