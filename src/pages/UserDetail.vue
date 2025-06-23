<template>
    <div class="container">
        <div class="header">
            <button class="back-button" @click="goBack">← 返回</button>
            <h1>{{ userName }} 成名屎</h1>
        </div>

        <div class="user-info">
            <div class="declaration" v-if="userData.declaration">
                <h2>霸氣宣言</h2>
                <p>{{ userData.declaration }}</p>
            </div>

            <!-- 只有从首页进入时才显示月份选择器 -->
            <div v-if="!isFromHistory" class="month-selector">
                <select v-model="selectedMonth" @change="fetchMonthData">
                    <option value="current">本月</option>
                    <option v-for="month in availableMonths" :key="month" :value="month">
                        {{ month }}
                    </option>
                </select>
            </div>

            <div class="stats">
                <div class="stat-card">
                    <h3>{{ selectedMonth === 'current' ? '本月支出' : selectedMonth + ' 月支出' }}</h3>
                    <p class="count">{{ currentMonthCount }}</p>
                </div>
                <div class="stat-card">
                    <h3>歷屎總計</h3>
                    <p class="count">{{ totalCount }}</p>
                </div>
            </div>

            <div class="daily-stats">
                <h2>一日之計在於屎</h2>
                <div class="daily-list">
                    <div v-for="day in dailyRecords" :key="day.date" class="daily-item"
                        :class="{ 'has-data': day.count > 0, 'clickable': day.count > 0 }" @click="showDayDetails(day)">
                        <span class="date">{{ day.date }}</span>
                        <span class="count">{{ day.count }} 次</span>
                    </div>
                </div>
            </div>
        </div>

        <!-- 當日詳細時間彈窗 -->
        <div v-if="showTimeModal" class="modal" @click="showTimeModal = false">
            <div class="modal-content" @click.stop>
                <h3>{{ selectedDay?.date }} 詳細記錄</h3>
                <div class="modal-body">
                    <p><strong>總次數:</strong> {{ selectedDay?.count }} 次</p>
                    <div v-if="selectedDay?.times && selectedDay.times.length > 0" class="time-list">
                        <p><strong>記錄時間:</strong></p>
                        <div class="time-grid">
                            <span v-for="(time, index) in selectedDay.times" :key="index" class="time-tag">
                                {{ time }}
                            </span>
                        </div>
                    </div>
                    <div v-else class="no-time-data">
                        <p>此記錄沒有詳細時間資料</p>
                    </div>
                </div>
                <div class="modal-footer">
                    <button @click="showTimeModal = false">關閉</button>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { database, ref as dbRef, onValue, get } from '../firebase';

const route = useRoute();
const router = useRouter();
const userName = route.params.name;
const selectedMonth = ref('current');
const availableMonths = ref([]);
const userData = ref({});
const dailyData = ref({});
const dailyRecords = ref([]);
const historicalTotal = ref(0);
const isFromHistory = ref(false); // 判断是否从历史页面进入
const showTimeModal = ref(false);
const selectedDay = ref(null);

const currentMonthCount = computed(() => {
    return userData.value?.count || 0;
});

const totalCount = computed(() => {
    return currentMonthCount.value + historicalTotal.value;
});

// 獲取當月的天數
function getDaysInMonth(year, month) {
    return new Date(year, month, 0).getDate();
}

// 生成當月每一天的記錄
function generateDailyRecords(monthString) {
    const records = [];
    if (monthString === 'current') {
        const today = new Date();
        const year = today.getFullYear();
        const month = today.getMonth() + 1;
        const daysInMonth = getDaysInMonth(year, month);

        for (let day = 1; day <= today.getDate(); day++) {
            const dateString = `${month}月${day}日`;
            records.push({
                date: dateString,
                count: day === today.getDate() ? (userData.value?.count || 0) : 0
            });
        }
    } else {
        const [year, month] = monthString.split('-').map(Number);
        const daysInMonth = getDaysInMonth(year, month);

        for (let day = 1; day <= daysInMonth; day++) {
            const dateString = `${month}月${day}日`;
            records.push({
                date: dateString,
                count: 0
            });
        }
    }
    return records;
}

// 計算歷史總計
async function fetchHistoricalTotal() {
    const historyRef = dbRef(database, 'monthlyHistory');
    const snapshot = await get(historyRef);
    const historyData = snapshot.val() || {};

    let total = 0;

    // 遍歷所有月份
    for (const month in historyData) {
        // 如果是当前选择的历史月份，则跳过，避免重复计算
        if (selectedMonth.value !== 'current' && month === selectedMonth.value) {
            continue;
        }

        if (historyData[month][userName]) {
            const userData = historyData[month][userName];
            // 處理舊數據格式
            if (typeof userData === 'number') {
                total += userData;
            } else {
                total += userData?.count || 0;
            }
        }
    }

    historicalTotal.value = total;
}

// 生成空的每日記錄數組
function generateEmptyDailyRecords(monthString) {
    const records = [];
    if (monthString === 'current') {
        // 獲取當前日期，考慮台北時區
        const now = new Date();
        // 調整為台北時區 (UTC+8)
        const taipeiTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
        const year = taipeiTime.getUTCFullYear();
        const month = taipeiTime.getUTCMonth() + 1;
        const currentDay = taipeiTime.getUTCDate();
        const daysInMonth = getDaysInMonth(year, month);

        for (let day = 1; day <= currentDay; day++) {
            const dateString = `${month}月${day}日`;
            records.push({
                date: dateString,
                count: 0,
                times: [],
                fullDate: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
            });
        }
    } else {
        const [year, month] = monthString.split('-').map(Number);
        const daysInMonth = getDaysInMonth(year, month);

        for (let day = 1; day <= daysInMonth; day++) {
            const dateString = `${month}月${day}日`;
            records.push({
                date: dateString,
                count: 0,
                times: [],
                fullDate: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
            });
        }
    }
    return records;
}

async function fetchMonthData() {
    if (selectedMonth.value === 'current') {
        // 獲取當前月份數據
        const currentRef = dbRef(database, `poopCounter/${userName}`);
        onValue(currentRef, (snapshot) => {
            const data = snapshot.val();

            // 獲取當前日期，確保使用台北時區
            const now = new Date();
            // 調整為台北時區 (UTC+8)
            const taipeiTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
            const currentYear = taipeiTime.getUTCFullYear();
            const currentMonth = taipeiTime.getUTCMonth() + 1;
            const currentDay = taipeiTime.getUTCDate();
            const todayStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(currentDay).padStart(2, '0')}`;

            if (typeof data === 'number') {
                userData.value = { count: data };
                // 舊數據結構（無日期記錄），將數據放在月初第一天
                const records = generateEmptyDailyRecords('current');
                if (records.length > 0) {
                    records[0].count = data; // 將總數放在1號
                    records[0].times = []; // 舊資料沒有時間記錄
                }
                dailyRecords.value = records;
            } else {
                userData.value = data || {};

                // 生成基本的每日記錄（全為0）
                const records = generateEmptyDailyRecords('current');

                // 將實際數據填入
                if (data && data.dailyRecords) {
                    // 遍歷每一天
                    records.forEach((record, index) => {
                        const day = index + 1;
                        const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                        if (data.dailyRecords[dateStr]) {
                            const dayData = data.dailyRecords[dateStr];
                            if (typeof dayData === 'number') {
                                // 舊格式：純數字
                                record.count = dayData;
                                record.times = [];
                            } else {
                                // 新格式：包含時間
                                record.count = dayData.count || 0;
                                record.times = dayData.times || [];
                            }
                        }
                    });
                } else if (data && data.count) {
                    // 有總數但沒有日期記錄的情況，將數據放在月初第一天
                    if (records.length > 0) {
                        records[0].count = data.count;
                        records[0].times = [];
                    }
                }

                dailyRecords.value = records;
            }
        });
    } else {
        // 獲取歷史月份數據
        const [yearStr, monthStr] = selectedMonth.value.split('-');
        const year = parseInt(yearStr);
        const month = parseInt(monthStr);

        const monthRef = dbRef(database, `monthlyHistory/${selectedMonth.value}/${userName}`);
        const snapshot = await get(monthRef);
        let data = snapshot.val();

        if (data === null) {
            userData.value = { count: 0 };
            dailyRecords.value = generateEmptyDailyRecords(selectedMonth.value);
        } else if (typeof data === 'number') {
            userData.value = { count: data };
            // 對於舊格式，將數據顯示在月份的第一天
            const records = generateEmptyDailyRecords(selectedMonth.value);
            if (records.length > 0) {
                records[0].count = data;
                records[0].times = []; // 舊資料沒有時間記錄
            }
            dailyRecords.value = records;
        } else {
            userData.value = data || {};

            // 生成基本的每日記錄
            const records = generateEmptyDailyRecords(selectedMonth.value);

            // 將實際數據填入
            if (data && data.dailyRecords) {
                records.forEach((record, index) => {
                    const day = index + 1;
                    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    if (data.dailyRecords[dateStr]) {
                        const dayData = data.dailyRecords[dateStr];
                        if (typeof dayData === 'number') {
                            // 舊格式：純數字
                            record.count = dayData;
                            record.times = [];
                        } else {
                            // 新格式：包含時間
                            record.count = dayData.count || 0;
                            record.times = dayData.times || [];
                        }
                    }
                });
            } else if (data && data.count) {
                // 僅有總數的情況，將數據放在1號
                if (records.length > 0) {
                    records[0].count = data.count;
                    records[0].times = [];
                }
            }

            dailyRecords.value = records;
        }

        // 重新計算歷史總計，確保數據正確
        await fetchHistoricalTotal();
    }
}

function goBack() {
    router.go(-1); // 返回上一頁，而不是固定返回首頁
}

function showDayDetails(day) {
    selectedDay.value = day;
    showTimeModal.value = true;
}

onMounted(async () => {
    // 獲取可用的月份列表
    const monthsRef = dbRef(database, 'monthlyHistory');
    onValue(monthsRef, (snapshot) => {
        const months = snapshot.val();
        if (months) {
            availableMonths.value = Object.keys(months).sort().reverse();

            // 如果URL中包含月份参数，则优先使用该月份
            const monthParam = route.query.month;
            if (monthParam && availableMonths.value.includes(monthParam)) {
                selectedMonth.value = monthParam;
                isFromHistory.value = true; // 标记为从历史页面进入
            } else {
                // 否则使用默认值
                selectedMonth.value = 'current';
            }

            // 获取初始数据
            fetchMonthData();
        }
    });

    // 獲取歷史總計
    await fetchHistoricalTotal();
});
</script>

<style scoped>
.container {
    max-width: 800px;
    margin: auto;
    padding: 20px;
    text-align: center;
}

.header {
    position: relative;
    margin-bottom: 30px;
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: flex-start;
    width: 100%;
}

.header h1 {
    margin: 0;
    flex-grow: 1;
    text-align: center;
    padding-right: 65px;
}

.back-button {
    position: relative;
    background-color: #e65100;
    color: white;
    border: none;
    padding: 8px 15px;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 600;
    font-size: 0.9em;
    transition: all 0.2s ease;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    min-width: 65px;
}

.back-button:hover {
    background-color: #f57c00;
    transform: scale(1.05);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
}

.back-button:active {
    transform: scale(1);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.user-info {
    background: #fdfaf7;
    padding: 20px;
    border-radius: 8px;
    margin-top: 20px;
    width: 100%;
    box-sizing: border-box;
}

.declaration {
    margin-bottom: 30px;
    padding: 20px;
    background: #fff8e1;
    border-radius: 8px;
    border-left: 4px solid #ffe082;
    width: 100%;
    box-sizing: border-box;
    min-height: 100px;
    display: flex;
    flex-direction: column;
    justify-content: center;
}

.declaration h2 {
    color: #e65100;
    margin-bottom: 10px;
    text-align: center;
}

.declaration p {
    font-size: 1.2em;
    color: #6d4c41;
    font-style: italic;
    text-align: center;
    margin: 0;
    padding: 0 10px;
    word-wrap: break-word;
}

.month-selector {
    margin: 20px 0;
}

select {
    padding: 8px 12px;
    font-size: 1em;
    border-radius: 8px;
    border: 1px solid #ccc;
    background: white;
}

.stats {
    display: flex;
    justify-content: center;
    gap: 20px;
    margin: 20px 0;
}

.stat-card {
    background: white;
    padding: 20px;
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    min-width: 150px;
}

.stat-card h3 {
    color: #666;
    margin-bottom: 10px;
}

.stat-card .count {
    font-size: 2em;
    color: #e65100;
    font-weight: bold;
}

.daily-stats {
    margin-top: 30px;
}

.daily-list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 10px;
    margin-top: 20px;
}

.daily-item {
    background: white;
    padding: 10px;
    border-radius: 8px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    transition: transform 0.2s, box-shadow 0.2s;
}

.daily-item.has-data {
    background: #fff8e1;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.daily-item .date {
    color: #666;
    font-weight: 500;
}

.daily-item .count {
    color: #e65100;
    font-weight: bold;
}

.daily-item.clickable {
    cursor: pointer;
}

.modal {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
}

.modal-content {
    background-color: white;
    padding: 20px;
    border-radius: 8px;
    max-width: 80%;
    width: 100%;
    max-height: 80%;
    overflow-y: auto;
}

.modal-content h3 {
    color: #e65100;
    margin-bottom: 10px;
}

.modal-body {
    margin-bottom: 20px;
}

.modal-body p {
    margin: 10px 0;
}

.time-list {
    margin-top: 10px;
}

.time-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
}

.time-tag {
    background-color: #e65100;
    color: white;
    padding: 5px 10px;
    border-radius: 5px;
}

.no-time-data {
    text-align: center;
}

.modal-footer {
    text-align: right;
}

.modal-footer button {
    background-color: #e65100;
    color: white;
    border: none;
    padding: 8px 15px;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 600;
    font-size: 0.9em;
    transition: all 0.2s ease;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.modal-footer button:hover {
    background-color: #f57c00;
    transform: scale(1.05);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
}

.modal-footer button:active {
    transform: scale(1);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

@media (max-width: 600px) {
    .container {
        padding: 15px 10px;
        margin: 0;
    }

    .back-button {
        padding: 6px 12px;
        font-size: 0.85em;
        min-width: 55px;
    }

    .header h1 {
        font-size: 1.5em;
        padding-left: 0;
        padding-right: 55px;
    }

    .user-info {
        padding: 15px 10px;
        width: 100%;
        box-sizing: border-box;
    }

    .declaration {
        padding: 15px;
        margin-bottom: 20px;
        min-height: 80px;
        width: 100%;
    }

    .declaration p {
        font-size: 1.1em;
        padding: 0 5px;
    }

    .daily-list {
        grid-template-columns: repeat(2, 1fr);
        gap: 10px;
        margin-top: 15px;
    }

    .daily-item {
        padding: 10px 8px;
        font-size: 0.9em;
    }

    .daily-stats h2 {
        font-size: 1.3em;
    }

    .stats {
        flex-direction: column;
        align-items: center;
        gap: 15px;
        margin: 15px 0;
    }

    .stat-card {
        width: 100%;
        max-width: 260px;
        padding: 15px;
    }

    .stat-card h3 {
        font-size: 1em;
    }

    .stat-card .count {
        font-size: 1.8em;
    }

    select {
        padding: 8px;
        font-size: 0.95em;
    }

    .month-selector {
        margin: 15px 0;
    }
}
</style>