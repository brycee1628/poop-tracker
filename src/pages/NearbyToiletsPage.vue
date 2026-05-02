<template>
    <div class="container">
        <h1>🚽 附近廁所</h1>
        <p class="subtitle">緊急時刻，不差這幾步。</p>

        <div class="toolbar">
            <label class="radius-label">
                搜尋半徑
                <select v-model.number="radiusM" class="radius-select">
                    <option :value="400">400 m</option>
                    <option :value="800">800 m</option>
                    <option :value="1200">1.2 km</option>
                    <option :value="2000">2 km</option>
                </select>
            </label>
            <button type="button" class="btn-primary" :disabled="loading" @click="searchNearby">
                {{ loading ? '搜尋中…' : '用目前位置搜尋' }}
            </button>
        </div>

        <p v-if="geoError" class="error">{{ geoError }}</p>
        <p v-if="apiError" class="error">{{ apiError }}</p>

        <p v-if="lastPosition" class="hint">
            位置：{{ lastPosition.lat.toFixed(5) }}, {{ lastPosition.lon.toFixed(5) }}
        </p>

        <ul v-if="toilets.length" class="list">
            <li v-for="(t, i) in toilets" :key="`${t.osmType}-${t.osmId}-${i}`" class="card">
                <div class="card-main">
                    <h2>{{ t.name }}</h2>
                    <p class="dist">約 {{ t.distanceMeters }} m</p>
                    <p v-if="t.address" class="meta">{{ t.address }}</p>
                    <p v-if="t.openingHours" class="meta">營業／開放：{{ t.openingHours }}</p>
                    <p class="meta tags">
                        <span v-if="t.fee">費用：{{ t.fee }}</span>
                        <span v-if="t.wheelchair">輪椅：{{ t.wheelchair }}</span>
                    </p>
                </div>
                <a
                    class="map-link"
                    :href="mapsUrl(t.lat, t.lon)"
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    地圖
                </a>
            </li>
        </ul>

        <p v-else-if="searched && !loading" class="empty">這個範圍內沒有查到 OSM 上的公共廁所，可加大半徑再試。</p>

        <p class="legal">
            資料來自 <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>（社群標註，可能不完整）。
        </p>
    </div>
</template>

<script setup>
import { ref } from 'vue';

/** 開發時走 Vite proxy（同源，無 CORS）；正式環境直連 Cloud Function */
const toiletsApiBase =
    import.meta.env.VITE_NEARBY_TOILETS_URL ||
    (import.meta.env.DEV
        ? '/api/nearby-toilets'
        : 'https://us-central1-poop-counter-a4309.cloudfunctions.net/nearbyToilets');

const radiusM = ref(800);
const loading = ref(false);
const geoError = ref('');
const apiError = ref('');
const toilets = ref([]);
const lastPosition = ref(null);
const searched = ref(false);

function mapsUrl(lat, lon) {
    return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`;
}

async function searchNearby() {
    geoError.value = '';
    apiError.value = '';
    toilets.value = [];
    searched.value = false;
    loading.value = true;

    if (!navigator.geolocation) {
        geoError.value = '此裝置不支援定位，請改用可取得位置的瀏覽器。';
        loading.value = false;
        return;
    }

    navigator.geolocation.getCurrentPosition(
        async (pos) => {
            const lat = pos.coords.latitude;
            const lon = pos.coords.longitude;
            lastPosition.value = { lat, lon };

            try {
                const requestUrl = toiletsApiBase.startsWith('http')
                    ? new URL(toiletsApiBase)
                    : new URL(toiletsApiBase, window.location.origin);
                requestUrl.searchParams.set('lat', String(lat));
                requestUrl.searchParams.set('lon', String(lon));
                requestUrl.searchParams.set('radius', String(radiusM.value));

                const res = await fetch(requestUrl.toString());
                const data = await res.json();

                if (!data.ok) {
                    apiError.value = data.error || '查詢失敗';
                    searched.value = true;
                    return;
                }
                toilets.value = data.toilets || [];
                searched.value = true;
            } catch (e) {
                apiError.value = e.message || '網路錯誤，請確認已部署 nearbyToilets 並允許跨域。';
            } finally {
                loading.value = false;
            }
        },
        (err) => {
            loading.value = false;
            if (err.code === 1) {
                geoError.value = '已拒絕定位權限，請在瀏覽器設定中允許此網站使用位置。';
            } else {
                geoError.value = '無法取得位置，請稍後再試。';
            }
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    );
}
</script>

<style scoped>
.container {
    max-width: 560px;
    margin: 0 auto;
    padding: 16px;
    text-align: center;
}

h1 {
    margin-bottom: 8px;
}

.subtitle {
    color: #666;
    margin-bottom: 24px;
}

.toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 12px;
    margin-bottom: 16px;
}

.radius-label {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.95rem;
    color: #444;
}

.radius-select {
    padding: 8px 12px;
    border-radius: 8px;
    border: 1px solid #ccc;
}

.btn-primary {
    background: #e65100;
    color: #fff;
    border: none;
    padding: 10px 20px;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
}

.btn-primary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}

.error {
    color: #c62828;
    margin: 8px 0;
}

.hint {
    font-size: 0.85rem;
    color: #888;
    margin-bottom: 12px;
}

.list {
    list-style: none;
    padding: 0;
    margin: 0;
    text-align: left;
}

.card {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    padding: 16px;
    margin-bottom: 12px;
    background: #fdfaf7;
    border-radius: 10px;
    border: 1px solid #e8e0d8;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
}

.card h2 {
    font-size: 1.1rem;
    margin: 0 0 6px;
    color: #5d4037;
}

.dist {
    font-weight: 700;
    color: #e65100;
    margin: 0 0 6px;
}

.meta {
    font-size: 0.88rem;
    color: #666;
    margin: 4px 0 0;
}

.tags span {
    margin-right: 10px;
}

.map-link {
    flex-shrink: 0;
    align-self: center;
    padding: 8px 14px;
    background: #fff;
    border: 1px solid #e65100;
    color: #e65100;
    border-radius: 8px;
    text-decoration: none;
    font-weight: 600;
    font-size: 0.9rem;
}

.map-link:hover {
    background: #fff3e0;
}

.empty {
    color: #888;
    font-style: italic;
    margin-top: 20px;
}

.legal {
    margin-top: 32px;
    font-size: 0.75rem;
    color: #999;
    line-height: 1.5;
}

.legal a {
    color: #795548;
}
</style>
