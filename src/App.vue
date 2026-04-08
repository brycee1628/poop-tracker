<script setup>
import NavBar from './components/NavBar.vue';
import Footer from './components/Footer.vue';
import { computed, onMounted, ref } from 'vue';
import liff from '@line/liff';
import {
  auth,
  onIdTokenChanged,
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
const liffProfile = ref(null);
const needsBinding = ref(false);
const isLoggedIn = computed(() => !!currentUser.value || !!liffProfile.value);

function syncAuthUserNow() {
  if (auth.currentUser) {
    currentUser.value = auth.currentUser;
  }
}

async function waitAndSyncAuthUser() {
  try {
    if (typeof auth.authStateReady === 'function') {
      await auth.authStateReady();
    }
  } catch (error) {
    console.error(error);
  }

  // 補一段短輪詢，避免 OAuth 回跳後事件延遲
  for (let i = 0; i < 8; i += 1) {
    if (auth.currentUser) {
      currentUser.value = auth.currentUser;
      return auth.currentUser;
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  return null;
}

const displayUserName = computed(() => {
  if (currentUser.value) {
    return currentUser.value.displayName || currentUser.value.email || currentUser.value.uid;
  }
  if (liffProfile.value) {
    return `${liffProfile.value.displayName} (LINE)`;
  }
  return '';
});

function isLineInAppBrowser() {
  return /Line\//i.test(navigator.userAgent || '');
}

function openWithLiffUrl() {
  const liffId = import.meta.env.VITE_LIFF_ID;
  if (!liffId) return;
  window.location.href = `https://liff.line.me/${liffId}`;
}

function handleLoginEntry() {
  if (isLineInAppBrowser() && import.meta.env.VITE_LIFF_ID) {
    openWithLiffUrl();
    return;
  }
  loginWithLine();
}

async function initLiffLoginIfNeeded() {
  if (!isLineInAppBrowser()) return;

  const liffId = import.meta.env.VITE_LIFF_ID;
  if (!liffId) {
    authError.value = 'LINE 內建瀏覽器請先設定 LIFF ID（VITE_LIFF_ID）。';
    return;
  }

  try {
    await liff.init({ liffId });
    if (!liff.isLoggedIn()) {
      authError.value = '';
      return;
    }
    const profile = await liff.getProfile();
    liffProfile.value = {
      userId: profile.userId,
      displayName: profile.displayName
    };
    authError.value = '';

    // LIFF 登入成功後，若尚未綁定名稱則顯示綁定面板
    const lineBindingSnapshot = await get(dbRef(database, `lineUsers/${profile.userId}`));
    const lineBinding = lineBindingSnapshot.val();
    if (!lineBinding?.name) {
      needsBinding.value = true;
      const legacySnapshot = await get(dbRef(database, 'poopCounter'));
      const legacyData = legacySnapshot.val() || {};
      unlinkedLegacyNames.value = Object.keys(legacyData);
      if (unlinkedLegacyNames.value.length > 0) {
        selectedLegacyName.value = unlinkedLegacyNames.value[0];
      }
    } else {
      needsBinding.value = false;
    }
  } catch (error) {
    console.error(error);
    authError.value = 'LINE 內建瀏覽器登入失敗，請改用外部瀏覽器開啟。';
  }
}

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
  await initLiffLoginIfNeeded();

  try {
    const redirectResult = await getLineRedirectResult();
    if (redirectResult?.user) {
      currentUser.value = redirectResult.user;
      await ensureUserLinkState(redirectResult.user);
    }
    await waitAndSyncAuthUser();
  } catch (error) {
    authError.value = 'LINE 登入失敗，請再試一次。';
    console.error(error);
  }

  // 先同步目前登入狀態，避免 UI 卡在舊按鈕
  if (auth.currentUser) {
    currentUser.value = auth.currentUser;
    try {
      await ensureUserLinkState(auth.currentUser);
    } catch (error) {
      console.error(error);
    }
  }

  onIdTokenChanged(auth, async (user) => {
    currentUser.value = user;
    if (user) {
      authError.value = '';
      try {
        await ensureUserLinkState(user);
      } catch (error) {
        console.error(error);
      }
    } else {
      showLinkModal.value = false;
      unlinkedLegacyNames.value = [];
      selectedLegacyName.value = '';
    }
  });

  // 某些瀏覽器在 OAuth 回跳後不會即時刷新 UI，回焦點時主動同步一次
  window.addEventListener('focus', syncAuthUserNow);
});

async function loginWithLine() {
  authError.value = '';
  const inLineBrowser = isLineInAppBrowser();

  // 僅 LINE 內建瀏覽器走 LIFF/redirect；外部瀏覽器優先 popup，避免 missing initial state。
  if (inLineBrowser) {
    if (inLineBrowser && !import.meta.env.VITE_LIFF_ID) {
      authError.value = 'LINE 內建瀏覽器建議使用 LIFF，請先設定 VITE_LIFF_ID。';
      return;
    }
    if (inLineBrowser && import.meta.env.VITE_LIFF_ID) {
      openWithLiffUrl();
      return;
    }
    try {
      await signInWithLineRedirect();
      return;
    } catch (error) {
      authError.value = 'LINE 登入失敗，請稍後再試。';
      console.error(error);
      return;
    }
  }

  // 桌機優先 popup，若被擋再 fallback redirect。
  try {
    const popupResult = await signInWithLinePopup();
    const resolvedUser = popupResult?.user || (await waitAndSyncAuthUser());
    if (resolvedUser) {
      currentUser.value = resolvedUser;
      await ensureUserLinkState(resolvedUser);
      syncAuthUserNow();
      return;
    }
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
  if (currentUser.value) {
    await signOutAuth();
    return;
  }

  if (liffProfile.value) {
    try {
      liff.logout();
    } catch (error) {
      console.error(error);
    }
    liffProfile.value = null;
    window.location.reload();
  }
}

async function ensureUserLinkState(user) {
  linkError.value = '';
  const userProfileRef = dbRef(database, `users/${user.uid}`);
  const userProfileSnapshot = await get(userProfileRef);
  const userProfile = userProfileSnapshot.val() || {};
  const lineUid = getLineProviderUid(user);
  let lineBinding = null;
  if (lineUid) {
    const lineBindingSnapshot = await get(dbRef(database, `lineUsers/${lineUid}`));
    lineBinding = lineBindingSnapshot.val();
  }

  // users 或 lineUsers 任一已有綁定，都視為已綁定
  if (userProfile.legacyName || lineBinding?.name) {
    const boundName = userProfile.legacyName || lineBinding?.name;
    if (boundName) {
      await syncLineUserBinding(user, boundName);
    }
    needsBinding.value = false;
    showLinkModal.value = false;
    return;
  }

  const legacySnapshot = await get(dbRef(database, 'poopCounter'));
  const legacyData = legacySnapshot.val() || {};
  unlinkedLegacyNames.value = Object.keys(legacyData);

  if (unlinkedLegacyNames.value.length > 0) {
    needsBinding.value = true;
    selectedLegacyName.value = unlinkedLegacyNames.value[0];
    showLinkModal.value = false;
  } else {
    await set(userProfileRef, {
      displayName: user.displayName || null,
      legacyName: null,
      updatedAt: Date.now()
    });
    await syncLineUserBinding(user, user.displayName || null);
    needsBinding.value = false;
    showLinkModal.value = false;
  }
}

async function linkSelectedLegacyData() {
  if ((!currentUser.value && !liffProfile.value) || !selectedLegacyName.value) return;

  linking.value = true;
  linkError.value = '';
  const legacyName = selectedLegacyName.value;

  try {
    if (currentUser.value) {
      const uid = currentUser.value.uid;
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
    } else if (liffProfile.value?.userId) {
      // LIFF-only 綁定：若名稱已對應 firebase uid，寫入同一 uid，讓 +1 路徑與 Firebase 登入一致
      const uidSnapshot = await get(dbRef(database, `nameToUid/${legacyName}`));
      const mappedUid = uidSnapshot.val() || null;
      await set(dbRef(database, `lineUsers/${liffProfile.value.userId}`), {
        name: legacyName,
        firebaseUid: mappedUid,
        updatedAt: Date.now()
      });
    }

    needsBinding.value = false;
    showLinkModal.value = false;
  } catch (error) {
    linkError.value = error.message || '綁定失敗，請稍後再試。';
  } finally {
    linking.value = false;
  }
}

async function skipLinkForNow() {
  if (currentUser.value) {
    await set(dbRef(database, `users/${currentUser.value.uid}`), {
      displayName: currentUser.value.displayName || null,
      legacyName: null,
      updatedAt: Date.now()
    });
    await syncLineUserBinding(currentUser.value, currentUser.value.displayName || null);
  } else if (liffProfile.value?.userId) {
    await set(dbRef(database, `lineUsers/${liffProfile.value.userId}`), {
      name: liffProfile.value.displayName || null,
      updatedAt: Date.now()
    });
  }
  needsBinding.value = false;
  showLinkModal.value = false;
}

async function openBindingSelector() {
  linkError.value = '';
  const legacySnapshot = await get(dbRef(database, 'poopCounter'));
  const legacyData = legacySnapshot.val() || {};
  unlinkedLegacyNames.value = Object.keys(legacyData);
  if (unlinkedLegacyNames.value.length > 0) {
    selectedLegacyName.value = unlinkedLegacyNames.value[0];
    showLinkModal.value = true;
  } else {
    linkError.value = '目前沒有可綁定的歷史名稱。';
  }
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
        <template v-if="isLoggedIn">
          <span class="auth-text">{{ displayUserName }}</span>
          <button v-if="needsBinding" class="auth-button secondary" @click="openBindingSelector">綁定ID</button>
          <button class="auth-button logout" @click="logout">登出</button>
        </template>
        <template v-else>
          <button class="auth-button" @click="handleLoginEntry">登入</button>
        </template>
      </template>
    </NavBar>
    <p v-if="authError && !isLoggedIn" class="auth-error">{{ authError }}</p>
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

.auth-button.secondary {
  background-color: #888;
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
