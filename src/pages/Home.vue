<template>
    <div class="container">
        <h1>💩 大便次數排行榜 💩</h1>
        <p class="subtitle">讓我們一起譜寫歷屎 📖</p>

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
import { reactive, onMounted, computed } from 'vue';
import { database, ref, onValue } from '../firebase';

const poopData = reactive({});

const sortedPoopList = computed(() => {
    return Object.entries(poopData)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);
});

const poopRef = ref(database, 'poopCounter');

onMounted(() => {
    onValue(poopRef, (snapshot) => {
        const data = snapshot.val() || {};
        Object.keys(poopData).forEach((key) => delete poopData[key]);
        Object.keys(data).forEach((name) => {
            poopData[name] = data[name];
        });
    });
});
</script>

<style scoped>
.subtitle {
    font-size: 1.2em;
    color: #666;
    margin-bottom: 20px;
    font-style: italic;
    opacity: 0;
    transform: translateY(-10px) scale(0.95);
    animation: fadeSlideIn 0.8s ease-out forwards;
}

@keyframes fadeSlideIn {
    to {
        opacity: 1;
        transform: translateY(0) scale(1);
    }
}


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
    transition: transform 0.3s ease;
}

/* 🌟 第一名特效 */
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
</style>