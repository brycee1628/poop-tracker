<script setup>
import NavBar from './components/NavBar.vue';
import Footer from './components/Footer.vue';
import { onMounted, ref } from 'vue';
import {
  auth,
  onAuthStateChanged,
  signInWithLinePopup,
  signInWithLineRedirect,
  getLineRedirectResult,
  signOutAuth
} from './firebase';

const currentUser = ref(null);
const authError = ref('');

onMounted(async () => {
  try {
    await getLineRedirectResult();
  } catch (error) {
    authError.value = 'LINE 登入失敗，請再試一次。';
    console.error(error);
  }

  onAuthStateChanged(auth, (user) => {
    currentUser.value = user;
  });
});

async function loginWithLine() {
  authError.value = '';
  try {
    await signInWithLinePopup();
  } catch (error) {
    if (error?.code === 'auth/popup-blocked' || error?.code === 'auth/operation-not-supported-in-this-environment') {
      await signInWithLineRedirect();
      return;
    }
    authError.value = 'LINE 登入失敗，請稍後再試。';
    console.error(error);
  }
}

async function logout() {
  await signOutAuth();
}
</script>

<template>
  <div class="wrapper">
    <NavBar :paths="[
      { id: 0, pageName: '首頁', url: '/' },
      { id: 1, pageName: '歷屎', url: '/history' },
      { id: 2, pageName: '聖域', url: '/gacha' },
    ]">
      <template #right>
        <template v-if="currentUser">
          <span class="auth-text">{{ currentUser.displayName || currentUser.email || currentUser.uid }}</span>
          <button class="auth-button logout" @click="logout">登出</button>
        </template>
        <template v-else>
          <button class="auth-button" @click="loginWithLine">登入</button>
        </template>
      </template>
    </NavBar>
    <p v-if="authError" class="auth-error">{{ authError }}</p>
    <router-view></router-view>
    <Footer></Footer>
  </div>
</template>

<style lang="scss" scoped>
.wrapper {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.auth-text {
  font-size: 12px;
  color: #444;
  max-width: 150px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.auth-button {
  border: 0;
  border-radius: 6px;
  padding: 6px 10px;
  font-size: 12px;
  line-height: 1;
  cursor: pointer;
  background-color: #06c755;
  color: white;
}

.auth-button.logout {
  background-color: #555;
}

.auth-error {
  margin: 0 auto 12px;
  width: min(920px, calc(100% - 32px));
  color: #d93025;
  font-size: 14px;
}

@media (max-width: 720px) {
  .auth-text {
    display: none;
  }
}
</style>
