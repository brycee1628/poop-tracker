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
  remove,
  update
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

const LEGACY_BIND_DISMISSED_KEY = 'pt_legacyBindDismissedEmpty';

function readLegacyBindDismissedEmpty() {
  try {
    return localStorage.getItem(LEGACY_BIND_DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

function setLegacyBindDismissedEmpty() {
  try {
    localStorage.setItem(LEGACY_BIND_DISMISSED_KEY, '1');
  } catch {
    /* ignore */
  }
}

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

/** 內建瀏覽器常導致 Firebase redirect 的 sessionStorage 無法延續（missing initial state） */
function isLikelyInAppOrEmbeddedBrowser() {
  const ua = navigator.userAgent || '';
  if (/Line\//i.test(ua)) return true;
  if (/FBAN|FBAV|FBIOS|Instagram|Line\/|MicroMessenger/i.test(ua)) return true;
  return false;
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

    await refreshLegacyBindingUi();
  } catch (error) {
    console.error(error);
    authError.value = 'LINE 內建瀏覽器登入失敗，請改用外部瀏覽器開啟。';
  }
}

/** LINE OIDC 的 sub；相容不同 Identity Platform provider id 寫法 */
function getLineProviderUid(user) {
  const providers = user?.providerData || [];
  let p = providers.find((item) => item.providerId?.startsWith('oidc.'));
  if (!p) {
    p = providers.find((item) => item.providerId?.toLowerCase().includes('line'));
  }
  return p?.uid || null;
}

/** 把 Firebase uid 合併進 lineUsers（LINE 繼承／+1 依賴）。用 update 避免蓋掉已繼承的 name、linkedLegacy。 */
async function syncLineUserFirebaseOnly(user) {
  const lineUid = getLineProviderUid(user);
  if (!lineUid) return;
  await update(dbRef(database, `lineUsers/${lineUid}`), {
    firebaseUid: user.uid,
    updatedAt: Date.now()
  });
}

async function syncLineUserBinding(user, boundName) {
  const lineUid = getLineProviderUid(user);
  if (!lineUid || !boundName) return;
  await set(dbRef(database, `lineUsers/${lineUid}`), {
    name: boundName,
    firebaseUid: user.uid,
    linkedLegacy: true,
    updatedAt: Date.now()
  });
}

/**
 * Firebase 登入：僅當 users 有 legacyName，或 lineUsers 的排行榜名在 nameToUid 指向「本人 uid」。
 * 不可單靠 linkedLegacy（LIFF 綁定曾寫入但未必同步 nameToUid），也不可只判断 nameToUid「有值」（暱稱撞名會誤判）。
 */
async function isFirebaseLegacyBound(user, userProfile, lineBinding) {
  if (userProfile?.legacyName) return true;
  const n = lineBinding?.name;
  if (!n || !user?.uid) return false;
  const mapSnap = await get(dbRef(database, `nameToUid/${n}`));
  return mapSnap.val() === user.uid;
}

/**
 * 純 LIFF：以 linkedLegacy 為準，或以 name + firebaseUid 與 nameToUid 三者一致（舊資料）。
 * 禁止「nameToUid 只要有值就算綁定」——會與別人的排行榜名撞名時誤判。
 */
async function isLiffLegacyBound(lineBinding) {
  if (!lineBinding) return false;
  if (lineBinding.linkedLegacy === true && lineBinding.name) return true;
  const n = lineBinding.name;
  if (!n || lineBinding.firebaseUid == null || lineBinding.firebaseUid === '') return false;
  const mapSnap = await get(dbRef(database, `nameToUid/${n}`));
  return mapSnap.val() === lineBinding.firebaseUid;
}

/**
 * 是否已完成繼承（單一真相來源，避免 LIFF / Firebase 各算各的或互相覆寫）。
 * 同時存在 Firebase 與 LIFF 時，以 Firebase 規則為準（較嚴格、與 users/nameToUid 一致）。
 */
async function computeLegacyBoundState() {
  if (currentUser.value) {
    const userProfileSnapshot = await get(dbRef(database, `users/${currentUser.value.uid}`));
    const userProfile = userProfileSnapshot.val() || {};
    const lineUid = getLineProviderUid(currentUser.value);
    let lineBinding = null;
    if (lineUid) {
      const lineBindingSnapshot = await get(dbRef(database, `lineUsers/${lineUid}`));
      lineBinding = lineBindingSnapshot.val();
    }
    return isFirebaseLegacyBound(currentUser.value, userProfile, lineBinding);
  }
  if (liffProfile.value?.userId) {
    const lineBindingSnapshot = await get(dbRef(database, `lineUsers/${liffProfile.value.userId}`));
    const lineBinding = lineBindingSnapshot.val();
    return isLiffLegacyBound(lineBinding);
  }
  return true;
}

/** 依 poopCounter 剩餘名稱 + 繼承狀態，更新綁定按鈕與下拉選單資料 */
async function refreshLegacyBindingUi() {
  if (!currentUser.value && !liffProfile.value) {
    needsBinding.value = false;
    return;
  }
  const legacySnapshot = await get(dbRef(database, 'poopCounter'));
  const legacyData = legacySnapshot.val() || {};
  unlinkedLegacyNames.value = Object.keys(legacyData);
  const bound = await computeLegacyBoundState();
  const hasSlots = unlinkedLegacyNames.value.length > 0;
  // 有待認領名稱 → 一定要能看見按鈕；若名稱清單為空，僅在「尚未手動關閉過說明」時顯示，避免全新使用者永遠被干擾
  needsBinding.value = !bound && (hasSlots || !readLegacyBindDismissedEmpty());
  if (unlinkedLegacyNames.value.length > 0) {
    if (!selectedLegacyName.value || !unlinkedLegacyNames.value.includes(selectedLegacyName.value)) {
      selectedLegacyName.value = unlinkedLegacyNames.value[0];
    }
  }
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
      try {
        await refreshLegacyBindingUi();
      } catch (error) {
        console.error(error);
        needsBinding.value = false;
      }
    }
  });

  // 某些瀏覽器在 OAuth 回跳後不會即時刷新 UI，回焦點時主動同步一次
  window.addEventListener('focus', syncAuthUserNow);

  // LIFF 先跑、Firebase 後就緒時，再對齊一次「綁定ID」狀態
  if (currentUser.value || liffProfile.value) {
    try {
      await refreshLegacyBindingUi();
    } catch (error) {
      console.error(error);
    }
  }
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
    if (error?.code === 'auth/operation-not-supported-in-this-environment') {
      authError.value =
        '此瀏覽器不支援登入彈窗。請勿在 LINE／IG／微信等 App 內建瀏覽器登入：點右上角「⋯」或「⋮」→ 用 Safari／Chrome「在瀏覽器中開啟」本站，再按登入。';
      return;
    }
    if (error?.code === 'auth/popup-blocked') {
      if (isLikelyInAppOrEmbeddedBrowser()) {
        authError.value =
          '彈窗被擋下，且內建瀏覽器無法安全使用轉址登入。請用 Safari／Chrome 開啟本站網址後再登入（LINE 內請選「在瀏覽器中開啟」）。';
        return;
      }
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
  // 先前僅在 poopCounter 為空時才 sync，導致「還有待認領舊名」的使用者登入後 lineUsers 仍無 firebaseUid，LINE 指令「繼承」永遠失敗
  if (lineUid) {
    await syncLineUserFirebaseOnly(user);
  }
  let lineBinding = null;
  if (lineUid) {
    const lineBindingSnapshot = await get(dbRef(database, `lineUsers/${lineUid}`));
    lineBinding = lineBindingSnapshot.val();
  }

  const legacyBound = await isFirebaseLegacyBound(user, userProfile, lineBinding);
  if (legacyBound) {
    const boundName = userProfile.legacyName || lineBinding?.name;
    if (boundName) {
      await syncLineUserBinding(user, boundName);
    }
    showLinkModal.value = false;
    await refreshLegacyBindingUi();
    return;
  }

  const legacySnapshot = await get(dbRef(database, 'poopCounter'));
  const legacyData = legacySnapshot.val() || {};
  const keys = Object.keys(legacyData);

  if (keys.length === 0) {
    await set(userProfileRef, {
      displayName: user.displayName || null,
      legacyName: null,
      updatedAt: Date.now()
    });
  }

  showLinkModal.value = false;
  await refreshLegacyBindingUi();
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
        linkedLegacy: true,
        updatedAt: Date.now()
      });
    }

    showLinkModal.value = false;
    await refreshLegacyBindingUi();
  } catch (error) {
    linkError.value = error.message || '綁定失敗，請稍後再試。';
  } finally {
    linking.value = false;
  }
}

async function skipLinkForNow() {
  const legacySnap = await get(dbRef(database, 'poopCounter'));
  const noLegacySlots = Object.keys(legacySnap.val() || {}).length === 0;
  if (noLegacySlots) {
    setLegacyBindDismissedEmpty();
  }

  if (currentUser.value) {
    await set(dbRef(database, `users/${currentUser.value.uid}`), {
      displayName: currentUser.value.displayName || null,
      legacyName: null,
      updatedAt: Date.now()
    });
    await syncLineUserFirebaseOnly(currentUser.value);
  } else if (liffProfile.value?.userId) {
    await update(dbRef(database, `lineUsers/${liffProfile.value.userId}`), {
      name: null,
      linkedLegacy: null,
      updatedAt: Date.now()
    });
  }
  showLinkModal.value = false;
  await refreshLegacyBindingUi();
}

async function openBindingSelector() {
  linkError.value = '';
  const legacySnapshot = await get(dbRef(database, 'poopCounter'));
  const legacyData = legacySnapshot.val() || {};
  unlinkedLegacyNames.value = Object.keys(legacyData);
  showLinkModal.value = true;
  if (unlinkedLegacyNames.value.length > 0) {
    selectedLegacyName.value = unlinkedLegacyNames.value[0];
  } else {
    linkError.value =
      '後端「尚未認領」的舊名稱清單為空（poopCounter 無資料）。若你確定排行榜上還有你的舊名稱，請管理員檢查 Firebase 的 poopCounter 是否已被清空，或你是否已用其他帳號綁定。';
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
        <p v-if="unlinkedLegacyNames.length > 0">
          請從下方選擇你在舊排行榜上的名稱，以繼承次數與紀錄。
        </p>
        <p v-else>
          目前沒有從伺服器載入到「尚未認領」的舊名稱。若你應該要繼承資料，請看下方紅字說明，或聯絡管理員檢查 Firebase。
        </p>
        <select v-if="unlinkedLegacyNames.length > 0" v-model="selectedLegacyName">
          <option v-for="name in unlinkedLegacyNames" :key="name" :value="name">
            {{ name }}
          </option>
        </select>
        <p v-if="linkError" class="link-error">{{ linkError }}</p>
        <div class="link-actions">
          <button class="auth-button logout" :disabled="linking" @click="skipLinkForNow">關閉</button>
          <button
            class="auth-button"
            :disabled="linking || unlinkedLegacyNames.length === 0 || !selectedLegacyName"
            @click="linkSelectedLegacyData"
          >
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
