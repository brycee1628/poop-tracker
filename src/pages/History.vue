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
                :class="{ first: index === 0 }" @click="goToUserDetail(name)">
                <h2>第{{ index + 1 }}名 <span v-if="index === 0">👑</span> {{ name }}</h2>
                <p>{{ count }} 次</p>
            </div>
        </div>

        <p v-else class="empty">尚無資料</p>

        <!-- 添加每日记录显示 -->
        <div class="daily-records-section" v-if="selectedUser">
            <h2>{{ selectedUser }} 的每日記錄</h2>
            <div class="daily-list">
                <div v-for="day in dailyRecords" :key="day.date" class="daily-item"
                    :class="{ 'has-data': day.count > 0 }">
                    <span class="date">{{ day.date }}</span>
                    <span class="count">{{ day.count }} 次</span>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { database, ref as dbRef, onValue, get } from '../firebase';
import { useRouter } from 'vue-router';

const router = useRouter();
const selectedMonth = ref('');
const availableMonths = ref([]);
const historyData = ref({});
const selectedUser = ref('');
const dailyRecords = ref([]);

const sortedHistory = computed(() => {
    // 確保我們有正確的資料格式，處理新舊數據格式
    return Object.entries(historyData.value)
        .map(([name, data]) => {
            // 處理舊數據格式 (直接是數字)
            if (typeof data === 'number') {
                return { name, count: data };
            }

            // 處理新數據格式 (對象格式)
            return {
                name,
                count: data?.count || 0
            };
        })
        .sort((a, b) => b.count - a.count);
});

function goToUserDetail(name) {
    selectedUser.value = name;
    fetchDailyRecords(name);

    // 跳转到用户详情页并传递月份参数
    router.push({
        path: `/user/${name}`,
        query: { month: selectedMonth.value }  // 传递当前选择的月份
    });
}

// 獲取當月的天數
function getDaysInMonth(year, month) {
    return new Date(year, month, 0).getDate();
}

// 生成空的每日記錄數組
function generateEmptyDailyRecords(monthString) {
    const records = [];
    const [year, month] = monthString.split('-').map(Number);
    const daysInMonth = getDaysInMonth(year, month);

    for (let day = 1; day <= daysInMonth; day++) {
        const dateString = `${month}月${day}日`;
        records.push({
            date: dateString,
            count: 0
        });
    }
    return records;
}

async function fetchDailyRecords(name) {
    if (!selectedMonth.value || !name) return;

    // 根據選定月份獲取用戶的每日記錄
    const [yearStr, monthStr] = selectedMonth.value.split('-');
    const year = parseInt(yearStr);
    const month = parseInt(monthStr);

    const userData = historyData.value[name];

    // 生成基本的每日記錄
    const records = generateEmptyDailyRecords(selectedMonth.value);

    if (typeof userData === 'number') {
        // 舊數據格式，沒有每日記錄，將總數顯示在月初
        if (records.length > 0) {
            records[0].count = userData;
        }
    } else if (userData && userData.dailyRecords) {
        // 新數據格式，有每日記錄
        records.forEach((record, index) => {
            const day = index + 1;
            const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            if (userData.dailyRecords[dateStr]) {
                record.count = userData.dailyRecords[dateStr];
            }
        });
    } else if (userData && userData.count) {
        // 有總數但沒有日期記錄的情況
        if (records.length > 0) {
            records[0].count = userData.count;
        }
    }

    dailyRecords.value = records;
}

function fetchHistory() {
    if (!selectedMonth.value) return;

    const monthRef = dbRef(database, `monthlyHistory/${selectedMonth.value}`);
    onValue(monthRef, (snapshot) => {
        const data = snapshot.val() || {};
        historyData.value = data;

        // 清空已選擇的用戶和每日記錄
        selectedUser.value = '';
        dailyRecords.value = [];
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
    cursor: pointer;
    transition: transform 0.3s ease, box-shadow 0.3s ease;
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

.empty {
    color: #999;
    margin-top: 20px;
    font-style: italic;
}

/* 每日記錄相關樣式 */
.daily-records-section {
    margin-top: 40px;
    border-top: 1px dashed #ccc;
    padding-top: 20px;
}

.daily-list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    gap: 10px;
    margin-top: 20px;
}

.daily-item {
    border: 1px solid #ddd;
    border-radius: 6px;
    padding: 10px;
    display: flex;
    flex-direction: column;
    align-items: center;
    background-color: #f9f9f9;
}

.daily-item.has-data {
    background-color: #f0f8ff;
    border-color: #a9d4ff;
}

.daily-item .date {
    font-size: 0.9em;
    color: #666;
}

.daily-item .count {
    font-size: 1.1em;
    font-weight: bold;
    color: #3a3a3a;
}

.daily-item.has-data .count {
    color: #0066cc;
}
</style>
