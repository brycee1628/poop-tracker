<template>
    <div class="container">
        <h1>💩 排行榜 💩</h1>
        <p class="subtitle">讓我們一起譜寫歷屎 📖</p>
        <p class="total">當前魔力濃度 {{ totalAllCount }}</p>
        <div v-if="topPooper" class="marquee">
            <span>榜一{{ topPooper.name }}: {{ topPooper.declaration || '吾乃歷💩名將，誰敢與我一爭？不服來💩！' }}</span>
        </div>

        <div class="search-container">
            <input type="text" v-model="searchQuery" placeholder="搜尋歷屎人物" class="search-input" />
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
                                data.status === 'red' ? '已5天以上未上廁所' : '未知狀態'"
                            @click.stop="showHealthDetails(data.name)"></div>
                    </div>
                </div>
                <p>{{ data.count }} 次</p>
            </div>
        </div>

        <!-- 健康狀態詳情對話框 -->
        <div v-if="showHealthModal" class="modal" @click="showHealthModal = false">
            <div class="modal-content" @click.stop>
                <h3>歷屎人物健康狀態詳細資訊</h3>
                <div class="modal-body">
                    <p><strong>名人:</strong> {{ healthDetailsUser }}</p>
                    <p><strong>歷屎:</strong> {{ getLastRecordDate(healthDetailsUser) }}</p>
                    <p><strong>缺席:</strong> {{ getDayDifference(healthDetailsUser) }} 天</p>
                    <p><strong>狀態: </strong>
                        <span :class="'status-text ' + getHealthStatusById(healthDetailsUser)">
                            {{
                                getHealthStatusById(healthDetailsUser) === 'green' ? '良好' :
                                    getHealthStatusById(healthDetailsUser) === 'orange' ? '注意' :
                                        getHealthStatusById(healthDetailsUser) === 'red' ? '警告' : '未知'
                            }}
                        </span>
                    </p>
                    <p><strong>描述:</strong> {{ getHealthStatusTitle(healthDetailsUser) }}</p>
                </div>
                <div class="modal-footer">
                    <button @click="showHealthModal = false">關閉</button>
                </div>
            </div>
        </div>
    </div>
</template>


<script setup>
import { reactive, onMounted, computed, ref as vueRef } from 'vue';
import { database, ref, onValue, get } from '../firebase';
import { useRouter } from 'vue-router';

const legacyPoopData = reactive({});
const uidPoopData = reactive({});
const userProfiles = reactive({});
/** nameToUid/{排行榜名} -> firebase uid，用於 uid 列反查應顯示的舊榜名（避免顯示 LINE 暱稱） */
const nameToUidMap = reactive({});
const poopData = reactive({});
const historicalTotal = vueRef(0);
const router = useRouter();
const searchQuery = vueRef('');
const showHealthModal = vueRef(false);
const healthDetailsUser = vueRef('');

function syncReactiveObject(target, source) {
    Object.keys(target).forEach((key) => {
        if (!(key in source)) {
            delete target[key];
        }
    });

    Object.entries(source).forEach(([key, value]) => {
        target[key] = value;
    });
}

function normalizeUserData(data) {
    if (!data) return { count: 0, declaration: null, dailyRecords: {} };
    if (typeof data === 'number') {
        return { count: data, declaration: null, dailyRecords: {} };
    }
    return {
        count: data.count || 0,
        declaration: data.declaration || null,
        dailyRecords: data.dailyRecords || {}
    };
}

function mergeDailyRecords(baseRecords = {}, incomingRecords = {}) {
    const merged = { ...baseRecords };
    Object.entries(incomingRecords).forEach(([date, record]) => {
        const base = merged[date];
        const baseObj = typeof base === 'number' ? { count: base, times: [] } : (base || {});
        const incomingObj = typeof record === 'number' ? { count: record, times: [] } : (record || {});
        merged[date] = {
            count: (baseObj.count || 0) + (incomingObj.count || 0),
            times: [...(baseObj.times || []), ...(incomingObj.times || [])]
        };
    });
    return merged;
}

function rebuildCombinedPoopData() {
    const mergedData = {};
    /** @type {Record<string, string>} */
    const uidToMappedLegacyName = {};
    Object.entries(nameToUidMap).forEach(([legacyName, id]) => {
        if (id && uidToMappedLegacyName[id] === undefined) {
            uidToMappedLegacyName[id] = legacyName;
        }
    });

    // 先放入舊資料（name 為 key）
    Object.entries(legacyPoopData).forEach(([name, data]) => {
        mergedData[name] = normalizeUserData(data);
    });

    // 再合併新資料（uid 為 key，轉成顯示名稱）
    Object.entries(uidPoopData).forEach(([uid, data]) => {
        const profile = userProfiles[uid] || {};
        const displayName =
            profile.legacyName ||
            uidToMappedLegacyName[uid] ||
            profile.displayName ||
            `使用者-${uid.slice(-6)}`;
        const normalized = normalizeUserData(data);

        if (!mergedData[displayName]) {
            mergedData[displayName] = normalized;
            return;
        }

        const current = normalizeUserData(mergedData[displayName]);
        mergedData[displayName] = {
            count: (current.count || 0) + (normalized.count || 0),
            declaration: current.declaration || normalized.declaration || null,
            dailyRecords: mergeDailyRecords(current.dailyRecords, normalized.dailyRecords)
        };
    });

    syncReactiveObject(poopData, mergedData);
}

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
    Object.entries(historyData).forEach(([month, monthData]) => {
        // 遍歷每個月份中的每個人的數據
        Object.entries(monthData).forEach(([name, userData]) => {
            // 處理舊數據格式 (直接是數字)
            if (typeof userData === 'number') {
                total += userData;
            } else {
                // 處理新數據格式 (對象格式)
                total += userData?.count || 0;
            }
        });
    });

    historicalTotal.value = total;
};

const poopRef = ref(database, 'poopCounter');

onMounted(() => {
    // 舊資料來源：poopCounter（name key）
    onValue(poopRef, (snapshot) => {
        const data = snapshot.val() || {};
        syncReactiveObject(legacyPoopData, data);
        rebuildCombinedPoopData();
    });

    // 新資料來源：poopCounterByUser（uid key）
    onValue(ref(database, 'poopCounterByUser'), (snapshot) => {
        const data = snapshot.val() || {};
        syncReactiveObject(uidPoopData, data);
        rebuildCombinedPoopData();
    });

    // 使用者檔：users/{uid}，用於 uid -> 顯示名稱
    onValue(ref(database, 'users'), (snapshot) => {
        const data = snapshot.val() || {};
        syncReactiveObject(userProfiles, data);
        rebuildCombinedPoopData();
    });

    onValue(ref(database, 'nameToUid'), (snapshot) => {
        const data = snapshot.val() || {};
        syncReactiveObject(nameToUidMap, data);
        rebuildCombinedPoopData();
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

// 顯示健康狀態詳細資訊
function showHealthDetails(name) {
    healthDetailsUser.value = name;
    showHealthModal.value = true;
}

// 根據用戶ID獲取健康狀態
function getHealthStatusById(name) {
    const userData = poopData[name];

    // 處理舊數據格式
    if (typeof userData === 'number') {
        return 'unknown';
    }

    // 計算健康狀態
    return getHealthStatus(userData?.dailyRecords);
}

// 獲取用戶最後記錄日期
function getLastRecordDate(name) {
    const userData = poopData[name];

    if (!userData) {
        return '無記錄';
    }

    if (typeof userData === 'number') {
        return '無日期資料';
    }

    if (!userData.dailyRecords || Object.keys(userData.dailyRecords).length === 0) {
        return '無記錄';
    }

    const dates = Object.keys(userData.dailyRecords).sort().reverse();
    return dates[0] || '無記錄';
}

// 計算日期差異（天數）
function getDayDifference(name) {
    if (!name || !poopData[name]) {
        return '無法計算';
    }

    const userData = poopData[name];

    if (typeof userData === 'number') {
        return '無法計算';
    }

    if (!userData.dailyRecords || Object.keys(userData.dailyRecords).length === 0) {
        return '無法計算';
    }

    const dates = Object.keys(userData.dailyRecords).sort().reverse();
    const lastDate = dates[0];

    if (!lastDate) {
        return '無法計算';
    }

    try {
        const now = new Date();
        now.setHours(0, 0, 0, 0);

        const lastRecordDate = new Date(lastDate);
        lastRecordDate.setHours(0, 0, 0, 0);

        const diffTime = now - lastRecordDate;
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        return diffDays;
    } catch (error) {
        return '計算錯誤';
    }
}

// 獲取健康狀態提示標題
function getHealthStatusTitle(name) {
    const status = getHealthStatusById(name);
    if (status === 'green') {
        return '健康狀態良好 (3天內有記錄)';
    } else if (status === 'orange') {
        return '請注意健康狀態 (4天未上廁所)';
    } else if (status === 'red') {
        return '警告！已5天以上未上廁所';
    } else {
        return '未知狀態';
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

/* 模態對話框樣式 */
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
    z-index: 1000;
}

.modal-content {
    background-color: white;
    padding: 20px;
    border-radius: 8px;
    width: 80%;
    max-width: 400px;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
}

.modal-content h3 {
    margin-top: 0;
    color: #333;
    text-align: center;
    margin-bottom: 15px;
}

.modal-body {
    text-align: left;
    margin-bottom: 15px;
}

.modal-body p {
    margin: 8px 0;
    text-align: left;
}

.modal-footer {
    text-align: center;
}

.modal-content button {
    background-color: #4CAF50;
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 4px;
    cursor: pointer;
}

.modal-content button:hover {
    background-color: #45a049;
}

.status-text {
    font-weight: bold;
}

.status-text.green {
    color: #4CAF50;
}

.status-text.orange {
    color: #FF9800;
}

.status-text.red {
    color: #F44336;
}

.status-text.unknown {
    color: #9E9E9E;
}

@media (max-width: 480px) {
    .search-input {
        font-size: 0.9rem;
        padding: 8px 12px;
    }

    .modal-content {
        width: 90%;
        padding: 15px;
    }
}
</style>