<template>
    <div class="container">
        <h1>💩 大便次數排行榜 💩</h1>

        <div v-for="(count, name) in poopData" :key="name" class="card">
            <h2>{{ name }}</h2>
            <p>{{ count }} 次</p>
        </div>
    </div>
</template>

<script setup>
import { reactive, onMounted } from 'vue';
import { database, ref, onValue } from '../firebase';

// 資料綁定
const poopData = reactive({});

// 監聽 poopCounter
const poopRef = ref(database, 'poopCounter');

onMounted(() => {
    onValue(poopRef, (snapshot) => {
        const data = snapshot.val() || {};

        // 🔧 清空
        Object.keys(poopData).forEach((key) => delete poopData[key]);

        // 重新塞入最新資料
        Object.keys(data).forEach(name => {
            poopData[name] = data[name];
        });
    });
});
</script>

<style scoped>
.container {
    max-width: 600px;
    margin: auto;
    text-align: center;
}

.card {
    border: 1px solid #ccc;
    padding: 16px;
    margin: 12px 0;
    border-radius: 8px;
}
</style>
