<template>
    <div class="container">
        <h1>💩 大便次數排行榜 💩</h1>

        <div v-for="(count, name) in poopData" :key="name" class="card">
            <h2>{{ name }}</h2>
            <p>{{ count }} 次</p>
            <button @click="addPoop(name)">+1</button>
        </div>

        <div class="new-user">
            <input v-model="newUser" placeholder="輸入新人名字" />
            <button @click="addNewUser">加入排行榜</button>
        </div>
    </div>
</template>

<script setup>
import { ref as vueRef, reactive, onMounted } from 'vue';
import { database, ref, onValue, set } from '../firebase';

// 資料綁定
const poopData = reactive({});
const newUser = vueRef('');

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
console.log('poopData: ', poopData);

// +1 次數
function addPoop(name) {
    const current = poopData[name] || 0;
    const userRef = ref(database, `poopCounter/${name}`);
    set(userRef, current + 1);
}

// 加入新人
function addNewUser() {
    const name = newUser.value.trim();
    if (!name) return alert('請輸入名字！');
    if (poopData[name] !== undefined) return alert('這個人已經在排行榜啦！');

    const userRef = ref(database, `poopCounter/${name}`);
    set(userRef, 0);
    newUser.value = '';
}
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

button {
    padding: 8px 16px;
    margin-top: 8px;
    background-color: #4caf50;
    color: white;
    border: none;
    border-radius: 8px;
    cursor: pointer;
}

button:hover {
    background-color: #45a049;
}

.new-user {
    margin-top: 24px;
}

.new-user input {
    padding: 8px;
    width: 60%;
}

.new-user button {
    margin-left: 8px;
}
</style>