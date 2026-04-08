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
  signOutAuth,
  database,
  ref as dbRef,
  get,
  set,
  remove
} from './firebase';

const currentUser = ref(null);
const authError = ref('');
const showLinkModal = ref(false);
const linking = ref(false);
const linkError = ref('');
const unlinkedLegacyNames = ref([]);
const selectedLegacyName = ref('');

function getLineProviderUid(user) {
  const provider = user?.providerData?.find((item) => item.providerId?.startsWith('oidc.'));
  return provider?.uid || null;
}

async function syncLineUserBinding(user, boundName) {
  const lineUid = getLineProviderUid(user);
  if (!lineUid || !boundName) return;
  await set(dbRef(database, `lineUsers/${lineUid}`), {
    name: boundName,
    firebaseUid: user.uid,
    updatedAt: Date.now()
  });
}

onMounted(async () => {
  try {
    await getLineRedirectResult();
  } catch (error) {
    authError.value = 'LINE 登入失敗，請再試一次。';
    console.error(error);
  }

  onAuthStateChanged(auth, (user) => {
    currentUser.value = user;
    if (user) {
      ensureUserLinkState(user);
    } else {
      showLinkModal.value = false;
      unlinkedLegacyNames.value = [];
      selectedLegacyName.value = '';
    }
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

async function ensureUserLinkState(user) {
  linkError.value = '';
  const userProfileRef = dbRef(database, `users/${user.uid}`);
  const userProfileSnapshot = await get(userProfileRef);
  const userProfile = userProfileSnapshot.val() || {};

  if (userProfile.legacyName) {
    await syncLineUserBinding(user, userProfile.legacyName);
    showLinkModal.value = false;
    return;
  }

  const legacySnapshot = await get(dbRef(database, 'poopCounter'));
  const legacyData = legacySnapshot.val() || {};
  unlinkedLegacyNames.value = Object.keys(legacyData);

  if (unlinkedLegacyNames.value.length > 0) {
    selectedLegacyName.value = unlinkedLegacyNames.value[0];
    showLinkModal.value = true;
  } else {
    await set(userProfileRef, {
      displayName: user.displayName || null,
      legacyName: null,
      updatedAt: Date.now()
    });
    await syncLineUserBinding(user, user.displayName || null);
    showLinkModal.value = false;
  }
}

async function linkSelectedLegacyData() {
  if (!currentUser.value || !selectedLegacyName.value) return;

  linking.value = true;
  linkError.value = '';
  const uid = currentUser.value.uid;
  const legacyName = selectedLegacyName.value;

  try {
    const legacyRef = dbRef(database, `poopCounter/${legacyName}`);
    const uidRef = dbRef(database, `poopCounterByUser/${uid}`);
    const userProfileRef = dbRef(database, `users/${uid}`);
    const nameMapRef = dbRef(database, `nameToUid/${legacyName}`);

    const [legacySnapshot, uidSnapshot] = await Promise.all([
      get(legacyRef),
      get(uidRef)
    ]);

    const legacyData = legacySnapshot.val();
    const uidData = uidSnapshot.val();

    if (legacyData === null) {
      throw new Error('找不到舊資料，可能已被綁定。');
    }

    if (uidData === null) {
      await set(uidRef, legacyData);
    }

    await Promise.all([
      remove(legacyRef),
      set(nameMapRef, uid),
      set(userProfileRef, {
        displayName: currentUser.value.displayName || null,
        legacyName,
        updatedAt: Date.now()
      })
    ]);
    await syncLineUserBinding(currentUser.value, legacyName);

    showLinkModal.value = false;
  } catch (error) {
    linkError.value = error.message || '綁定失敗，請稍後再試。';
  } finally {
    linking.value = false;
  }
}

async function skipLinkForNow() {
  if (!currentUser.value) return;
  await set(dbRef(database, `users/${currentUser.value.uid}`), {
    displayName: currentUser.value.displayName || null,
    legacyName: null,
    updatedAt: Date.now()
  });
  await syncLineUserBinding(currentUser.value, currentUser.value.displayName || null);
  showLinkModal.value = false;
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
    <div v-if="showLinkModal" class="link-modal-mask">
      <div class="link-modal">
        <h3>綁定舊資料</h3>
        <p>偵測到舊排行榜資料，請選擇你的舊名稱進行綁定。</p>
        <select v-model="selectedLegacyName">
          <option v-for="name in unlinkedLegacyNames" :key="name" :value="name">
            {{ name }}
          </option>
        </select>
        <p v-if="linkError" class="link-error">{{ linkError }}</p>
        <div class="link-actions">
          <button class="auth-button logout" :disabled="linking" @click="skipLinkForNow">稍後再綁</button>
          <button class="auth-button" :disabled="linking || !selectedLegacyName" @click="linkSelectedLegacyData">
            {{ linking ? '綁定中...' : '確認綁定' }}
          </button>
        </div>
      </div>
    </div>
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

.link-modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1100;
}

.link-modal {
  width: min(420px, calc(100% - 32px));
  background: #fff;
  border-radius: 10px;
  padding: 16px;
  box-sizing: border-box;
}

.link-modal h3 {
  margin: 0 0 8px;
}

.link-modal p {
  margin: 0 0 12px;
  color: #444;
  font-size: 14px;
}

.link-modal select {
  width: 100%;
  margin-bottom: 10px;
  padding: 8px;
}

.link-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.link-error {
  color: #d93025;
}

@media (max-width: 720px) {
  .auth-text {
    display: none;
  }
}
</style>
