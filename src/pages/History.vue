<template>
    <div class="container">
        <h1>📅 歷屎排行榜</h1>
        <p class="subtitle">看看過去誰稱霸💩界！</p>

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

onMounted(() => {
    const monthsRef = dbRef(database, 'monthlyHistory');
    onValue(monthsRef, (snapshot) => {
        const months = snapshot.val();
        if (months) {
            availableMonths.value = Object.keys(months).sort().reverse();
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
