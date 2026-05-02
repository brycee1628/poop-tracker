const functions = require("firebase-functions/v1");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");
const cors = require("cors");

admin.initializeApp();

const corsForToilets = cors({ origin: true });

const db = admin.database();

function getLineChannelAccessToken() {
  if (process.env.LINE_CHANNEL_ACCESS_TOKEN) return process.env.LINE_CHANNEL_ACCESS_TOKEN;
  try {
    return functions.config().line.channel_access_token;
  } catch (error) {
    return null;
  }
}

async function replyLineText(replyToken, text) {
  const accessToken = getLineChannelAccessToken();
  if (!accessToken) {
    console.warn("⚠️ 缺少 LINE channel access token，無法回覆訊息");
    return false;
  }
  if (!replyToken) {
    console.warn("⚠️ 缺少 replyToken，無法回覆訊息");
    return false;
  }

  try {
    const response = await fetch("https://api.line.me/v2/bot/message/reply", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        replyToken,
        messages: [{ type: "text", text }],
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error(`❌ LINE 回覆 API 失敗: HTTP ${response.status} ${body}`);
      return false;
    }
    return true;
  } catch (error) {
    console.error("❌ LINE 回覆失敗:", error);
    return false;
  }
}

async function pushLineText(toUserId, text) {
  const accessToken = getLineChannelAccessToken();
  if (!accessToken || !toUserId) return false;

  try {
    const response = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        to: toUserId,
        messages: [{ type: "text", text }],
      }),
    });
    if (!response.ok) {
      const body = await response.text();
      console.error(`❌ LINE Push API 失敗: HTTP ${response.status} ${body}`);
      return false;
    }
    return true;
  } catch (error) {
    console.error("❌ LINE Push 失敗:", error);
    return false;
  }
}

async function notifyLineUser(event, text) {
  const replied = await replyLineText(event?.replyToken, text);
  if (replied) return;

  const lineUserId = event?.source?.userId;
  if (lineUserId) {
    await pushLineText(lineUserId, text);
  } else {
    console.warn("⚠️ 無法 fallback push：缺少 line user id");
  }
}

function buildNowInTaipei() {
  const now = new Date();
  const taipeiTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Taipei" }));
  const year = taipeiTime.getFullYear();
  const month = String(taipeiTime.getMonth() + 1).padStart(2, "0");
  const day = String(taipeiTime.getDate()).padStart(2, "0");
  const hour = String(taipeiTime.getHours()).padStart(2, "0");
  const minute = String(taipeiTime.getMinutes()).padStart(2, "0");
  return {
    dateString: `${year}-${month}-${day}`,
    timeString: `${hour}:${minute}`,
  };
}

function normalizePoopNode(val) {
  if (val == null) return { count: 0, declaration: null, dailyRecords: {}, achievements: {} };
  if (typeof val === "number") {
    return { count: val, declaration: null, dailyRecords: {}, achievements: {} };
  }
  return {
    count: val.count || 0,
    declaration: val.declaration || null,
    dailyRecords: val.dailyRecords && typeof val.dailyRecords === "object" ? val.dailyRecords : {},
    achievements: val.achievements && typeof val.achievements === "object" ? val.achievements : {},
  };
}

function mergeAchievements(base = {}, incoming = {}) {
  const merged = { ...base };
  Object.entries(incoming).forEach(([id, incomingAchievement]) => {
    const existing = merged[id] || {};
    merged[id] = {
      ...existing,
      ...incomingAchievement,
      unlocked: Boolean(existing.unlocked || incomingAchievement?.unlocked),
      unlockDate: existing.unlockDate || incomingAchievement?.unlockDate || null,
      timestamp: Math.max(existing.timestamp || 0, incomingAchievement?.timestamp || 0),
    };
  });
  return merged;
}

function mergeDailyRecords(base = {}, incoming = {}) {
  const merged = { ...base };
  Object.entries(incoming).forEach(([date, record]) => {
    const baseEntry = merged[date];
    const baseObj =
      typeof baseEntry === "number"
        ? { count: baseEntry, times: [] }
        : baseEntry || { count: 0, times: [] };
    const incObj =
      typeof record === "number" ? { count: record, times: [] } : record || { count: 0, times: [] };
    merged[date] = {
      count: (baseObj.count || 0) + (incObj.count || 0),
      times: [...(baseObj.times || []), ...(incObj.times || [])],
    };
  });
  return merged;
}

function mergePoopNodes(existingVal, legacyVal) {
  const a = normalizePoopNode(existingVal);
  const b = normalizePoopNode(legacyVal);
  return {
    count: (a.count || 0) + (b.count || 0),
    declaration: a.declaration || b.declaration || null,
    dailyRecords: mergeDailyRecords(a.dailyRecords, b.dailyRecords),
    achievements: mergeAchievements(a.achievements, b.achievements),
  };
}

/** 只保留 YYYY-MM- 開頭的日期鍵（與 buildNowInTaipei 同日曆月） */
function pruneDailyRecordsByMonthPrefix(dailyRecords, monthPrefix) {
  if (!dailyRecords || typeof dailyRecords !== "object") return {};
  const out = {};
  Object.entries(dailyRecords).forEach(([date, record]) => {
    if (date.startsWith(monthPrefix)) out[date] = record;
  });
  return out;
}

function sumDailyRecordsCounts(dailyRecords) {
  return Object.values(dailyRecords || {}).reduce((sum, record) => {
    if (typeof record === "number") return sum + record;
    return sum + (record?.count || 0);
  }, 0);
}

async function loadUidToName() {
  const nameToUidSnapshot = await db.ref("nameToUid").once("value");
  const nameToUidData = nameToUidSnapshot.val() || {};
  const usersSnapshot = await db.ref("users").once("value");
  const usersData = usersSnapshot.val() || {};
  const uidToName = {};
  Object.entries(nameToUidData).forEach(([legacyName, uid]) => {
    if (uid) uidToName[uid] = legacyName;
  });
  Object.entries(usersData).forEach(([uid, profile]) => {
    const legacyName = profile?.legacyName;
    if (legacyName && !uidToName[uid]) uidToName[uid] = legacyName;
  });
  return uidToName;
}

/** 從即時 poopCounter + poopCounterByUser 切出指定年月的備份切片（與月底結算相同鍵規則） */
function buildMonthSliceFromLive(data, userCounterData, uidToName, year, month) {
  const backup = {};
  Object.entries(data).forEach(([legacyName, entry]) => {
    backup[legacyName] = filterEntryByMonth(entry, year, month);
  });
  Object.entries(userCounterData).forEach(([uid, entry]) => {
    const legacyName = uidToName[uid];
    const filteredEntry = filterEntryByMonth(entry, year, month);
    if (legacyName) {
      if (backup[legacyName]) {
        backup[legacyName] = mergePoopNodes(backup[legacyName], filteredEntry);
      } else {
        backup[legacyName] = filteredEntry;
      }
    } else {
      backup[uid] = filteredEntry;
    }
  });
  return backup;
}

function poopSliceHasData(entry) {
  if (entry == null) return false;
  if (typeof entry === "number") return entry !== 0;
  return (
    (entry.count || 0) > 0 ||
    (entry.dailyRecords && Object.keys(entry.dailyRecords).length > 0)
  );
}

/** 從單一使用者節點移除指定年月的每日鍵，並重算 count（僅物件格式） */
function stripMonthFromPoopEntry(entry, year, month) {
  if (entry == null || typeof entry === "number") return entry;
  const monthPrefix = `${year}-${String(month).padStart(2, "0")}-`;
  const dailyRecords = { ...(entry.dailyRecords || {}) };
  let changed = false;
  Object.keys(dailyRecords).forEach((d) => {
    if (d.startsWith(monthPrefix)) {
      delete dailyRecords[d];
      changed = true;
    }
  });
  if (!changed) return entry;
  return {
    ...entry,
    count: sumDailyRecordsCounts(dailyRecords),
    dailyRecords,
  };
}

function filterEntryByMonth(entry, year, month) {
  if (entry == null || typeof entry === 'number') return entry;

  const monthPrefix = `${year}-${String(month).padStart(2, '0')}-`;
  const filteredDailyRecords = {};
  Object.entries(entry.dailyRecords || {}).forEach(([date, record]) => {
    if (date.startsWith(monthPrefix)) {
      filteredDailyRecords[date] = record;
    }
  });

  const count = Object.values(filteredDailyRecords).reduce((sum, record) => {
    if (typeof record === 'number') return sum + record;
    return sum + (record?.count || 0);
  }, 0);

  const hasDailyRecords = entry.dailyRecords && typeof entry.dailyRecords === 'object';
  return {
    ...entry,
    count:
      Object.keys(filteredDailyRecords).length > 0
        ? count
        : hasDailyRecords
        ? 0
        : typeof entry.count === 'number'
        ? entry.count
        : 0,
    dailyRecords: filteredDailyRecords,
  };
}

async function incrementCounterAtPath(path) {
  const targetRef = db.ref(path);
  const { dateString, timeString } = buildNowInTaipei();
  const monthPrefix = `${dateString.slice(0, 7)}-`;

  const txResult = await targetRef.transaction((current) => {
    if (!current) {
      return {
        count: 1,
        dailyRecords: {
          [dateString]: {
            count: 1,
            times: [timeString],
          },
        },
      };
    }

    if (typeof current === "number") {
      return {
        count: current + 1,
        dailyRecords: {
          [dateString]: {
            count: 1,
            times: [timeString],
          },
        },
      };
    }

    // 綁定 uid 路徑若換月重置曾略過，會累積多個月份的日期鍵；每次 +1 僅保留「台北當月」並重算 count
    const baseDaily = pruneDailyRecordsByMonthPrefix(current.dailyRecords, monthPrefix);
    const newDailyRecords = { ...baseDaily };
    if (!newDailyRecords[dateString]) {
      newDailyRecords[dateString] = { count: 1, times: [timeString] };
    } else if (typeof newDailyRecords[dateString] === "number") {
      newDailyRecords[dateString] = {
        count: newDailyRecords[dateString] + 1,
        times: [timeString],
      };
    } else {
      newDailyRecords[dateString] = {
        count: (newDailyRecords[dateString].count || 0) + 1,
        times: [...(newDailyRecords[dateString].times || []), timeString],
      };
    }

    return {
      ...current,
      count: sumDailyRecordsCounts(newDailyRecords),
      dailyRecords: newDailyRecords,
    };
  });

  const finalData = txResult.snapshot.val() || {};
  const todayRecord = finalData.dailyRecords?.[dateString];
  const todayCount = typeof todayRecord === "number"
    ? todayRecord
    : (todayRecord?.count || 0);
  return {
    totalCount: finalData.count || 0,
    todayCount,
  };
}

// ✅ LINE Webhook（GCF Gen 1）
exports.lineWebhook = functions.https.onRequest(async (req, res) => {
  const events = req.body.events;

  for (const event of events) {
    if (event.type === "message" && event.message.type === "text") {
      const msg = event.message.text.trim();

      // 繼承舊排行榜：繼承 舊名稱 ／ 綁定 舊名稱（需先在網站用 LINE 登入過一次，lineUsers 才有 firebaseUid）
      const inheritMatch = msg.match(/^(?:繼承|綁定)\s+(.+)$/);
      if (inheritMatch) {
        const legacyName = inheritMatch[1].trim();
        const lineUserId = event?.source?.userId;
        if (!lineUserId) {
          await notifyLineUser(event, "無法取得 LINE 帳號資訊，請稍後再試。");
          continue;
        }
        if (!legacyName) {
          await notifyLineUser(event, "請輸入：繼承 你的舊排行榜名稱\n例：繼承 滅世魔王");
          continue;
        }

        const lineBindingSnap = await db.ref(`lineUsers/${lineUserId}`).once("value");
        const lineBinding = lineBindingSnap.val();
        const firebaseUid = lineBinding?.firebaseUid || null;
        if (!firebaseUid) {
          await notifyLineUser(
            event,
            [
              "尚未把這個 LINE 帳號與網站登入對應起來（缺 firebaseUid）。",
              "",
              "請用「外部瀏覽器」開啟網站並完成 LINE 登入，看到右上角已登入後等幾秒，再傳：",
              `繼承 ${legacyName}`,
              "",
              "若你已登入仍出現此訊息：請確認網站已更新到最新版；不要用僅 LIFF、未走 Firebase 登入的狀態。",
            ].join("\n")
          );
          continue;
        }

        const legacyRef = db.ref(`poopCounter/${legacyName}`);
        const uidRef = db.ref(`poopCounterByUser/${firebaseUid}`);
        const nameMapRef = db.ref(`nameToUid/${legacyName}`);
        const userProfileRef = db.ref(`users/${firebaseUid}`);

        const [legacySnap, uidSnap, mapSnap, profileSnap] = await Promise.all([
          legacyRef.once("value"),
          uidRef.once("value"),
          nameMapRef.once("value"),
          userProfileRef.once("value"),
        ]);

        const existingMapUid = mapSnap.val();
        if (existingMapUid != null && existingMapUid !== "" && existingMapUid !== firebaseUid) {
          await notifyLineUser(event, `「${legacyName}」已綁定其他帳號，無法繼承。`);
          continue;
        }

        if (!legacySnap.exists()) {
          await notifyLineUser(
            event,
            `找不到「${legacyName}」在未認領清單中，可能已被綁定或名稱打錯（請與排行榜上完全一致）。`
          );
          continue;
        }

        const legacyData = legacySnap.val();
        const uidData = uidSnap.val();
        const mergedForUid =
          uidData == null ? legacyData : mergePoopNodes(uidData, legacyData);
        const profile = profileSnap.val() || {};

        const updates = {};
        updates[`poopCounter/${legacyName}`] = null;
        updates[`poopCounterByUser/${firebaseUid}`] = mergedForUid;
        updates[`nameToUid/${legacyName}`] = firebaseUid;
        updates[`users/${firebaseUid}`] = {
          ...profile,
          legacyName,
          updatedAt: Date.now(),
        };
        updates[`lineUsers/${lineUserId}`] = {
          name: legacyName,
          firebaseUid,
          linkedLegacy: true,
          updatedAt: Date.now(),
        };

        await db.ref().update(updates);
        console.log(`🔗 LINE 繼承成功: ${lineUserId} -> ${legacyName} (uid ${firebaseUid})`);
        await notifyLineUser(
          event,
          `已將「${legacyName}」綁定到你的帳號。\n之後傳「+1」會計入網站排行榜（與登入相同）。`
        );
        continue;
      }

      // 處理宣告設定
      const declarationMatch = msg.match(/^(.+?):(.+)$/);
      if (declarationMatch) {
        const potentialName = declarationMatch[1].trim();
        const potentialDeclaration = declarationMatch[2].trim();

        // 檢查是否是URL相關格式
        const isURLPattern = /^(http|https|ftp):\/\//i.test(msg) || // 標準URL開頭
          msg.includes("www.") || // 包含www.
          msg.match(/\.[a-z]{2,}(\/|$)/i); // 包含域名後綴如.com, .org等

        // 如果不是URL，才處理為宣言
        if (!isURLPattern) {
          // 更新用戶的宣告內容
          const userRef = db.ref(`poopCounter/${potentialName}`);
          const userSnapshot = await userRef.once("value");
          const userData = userSnapshot.val();

          // 處理舊數據格式
          if (typeof userData === 'number') {
            // 如果是舊格式（純數字），轉換為新格式
            await userRef.set({
              count: userData,
              declaration: potentialDeclaration
            });
          } else {
            // 如果是新格式，保留計數，更新宣告
            await userRef.set({
              ...userData,
              count: userData?.count || 0,
              declaration: potentialDeclaration
            });
          }
        }

        continue;
      }

      // 處理 +1 計數（支援「名字 +1」和純「+1」）
      const namedCountMatch = msg.match(/^(.+?)\s*\+1$/);
      const plainPlusOne = msg === "+1";
      if (namedCountMatch || plainPlusOne) {
        let targetName = namedCountMatch ? namedCountMatch[1].trim() : null;

        if (plainPlusOne) {
          const lineUserId = event?.source?.userId;
          if (!lineUserId) {
            console.log("⚠️ +1 缺少 line user id，已略過");
            await notifyLineUser(event, "找不到使用者資訊，無法 +1。");
            continue;
          }
          const lineBindingSnapshot = await db.ref(`lineUsers/${lineUserId}`).once("value");
          const lineBinding = lineBindingSnapshot.val();
          // 若有 firebaseUid，優先寫入新路徑，確保不同登入方式 +1 行為一致
          if (lineBinding?.firebaseUid) {
            const countResult = await incrementCounterAtPath(`poopCounterByUser/${lineBinding.firebaseUid}`);
            await notifyLineUser(
              event,
              `✅ ${lineBinding?.name || "你"} +1 成功`
            );
            continue;
          }
          targetName = lineBinding?.name || null;
          if (!targetName) {
            console.log(`⚠️ +1 找不到綁定名稱: ${lineUserId}`);
            await notifyLineUser(event, "你還沒完成綁定，請先到網站登入並完成綁定。");
            continue;
          }
        }

        const uidSnapshot = await db.ref(`nameToUid/${targetName}`).once("value");
        const uid = uidSnapshot.val();
        let countResult = null;
        if (uid) {
          countResult = await incrementCounterAtPath(`poopCounterByUser/${uid}`);
        } else {
          countResult = await incrementCounterAtPath(`poopCounter/${targetName}`);
        }

        if (countResult) {
          await notifyLineUser(
            event,
            `✅ ${targetName} +1 成功`
          );
        }
      }
    }
  }

  res.status(200).send("OK");
});

/**
 * @param {{ forceBackup?: boolean, skipReset?: boolean }} options
 * forceBackup: 強制覆寫 monthlyHistory（補空備份／修正錯誤備份）
 * skipReset: 只寫歷史備份，不清空 poopCounter / poopCounterByUser（保留本月即時資料）
 */
async function executeMonthlyReset(options = {}) {
  const forceBackup = Boolean(options.forceBackup);
  const skipReset = Boolean(options.skipReset);

  const now = new Date();
  const taipeiTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Taipei" }));

  const lastMonthDate = new Date(taipeiTime);
  lastMonthDate.setDate(1);
  lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);

  const backupYear = lastMonthDate.getFullYear();
  const backupMonth = lastMonthDate.getMonth() + 1;
  const monthString = String(backupMonth).padStart(2, "0");

  console.log(`🗓️ 當前台北時間: ${taipeiTime.toISOString()}`);
  console.log(`📅 備份上個月: ${backupYear}-${monthString} (forceBackup=${forceBackup}, skipReset=${skipReset})`);

  const poopRef = db.ref("poopCounter");
  const snapshot = await poopRef.once("value");
  const data = snapshot.val() || {};

  const userPoopRef = db.ref("poopCounterByUser");
  const userSnapshot = await userPoopRef.once("value");
  const userCounterData = userSnapshot.val() || {};

  if (Object.keys(data).length === 0 && Object.keys(userCounterData).length === 0) {
    console.log("💤 沒有排行榜資料，跳過結算");
    return {
      skipped: true,
      reason: "no_live_data",
      backupMonthKey: `${backupYear}-${monthString}`,
      wroteBackup: false,
      didReset: false,
    };
  }

  const uidToName = await loadUidToName();

  const backupRef = db.ref(`monthlyHistory/${backupYear}-${monthString}`);
  const existingBackup = await backupRef.once("value");

  const backupData = buildMonthSliceFromLive(data, userCounterData, uidToName, backupYear, backupMonth);
  const shouldWriteBackup = !existingBackup.exists() || forceBackup;

  if (shouldWriteBackup) {
    await backupRef.set(backupData);
    console.log(`📦 已備份 ${backupYear}-${monthString} 的資料 (${forceBackup ? "強制覆寫" : "首次寫入"})`);
  } else {
    console.log(`⚠️ ${backupYear}-${monthString} 備份已存在，略過寫入（加 forceBackup=1 可覆寫）`);
  }

  const buildResetData = (sourceData) => {
    const result = {};
    Object.entries(sourceData).forEach(([key, entry]) => {
      if (typeof entry === "number") {
        result[key] = {
          count: 0,
          dailyRecords: {},
        };
        return;
      }

      result[key] = {
        count: 0,
        declaration: entry.declaration || null,
        dailyRecords: {},
      };
      if (entry && typeof entry.achievements === "object") {
        result[key].achievements = entry.achievements;
      }
    });
    return result;
  };

  let didReset = false;
  if (!skipReset) {
    const resetData = buildResetData(data);
    const resetUserData = buildResetData(userCounterData);

    await poopRef.set(resetData);
    if (Object.keys(resetUserData).length > 0) {
      await userPoopRef.set(resetUserData);
      console.log(`📦 已重置 poopCounterByUser 的資料`);
    }

    console.log(`✅ 已重置排行榜，保留 ${Object.keys(resetData).length} 位用戶的宣言`);
    console.log(`📊 重置的用戶: ${Object.keys(resetData).join(", ")}`);
    didReset = true;
  } else {
    console.log("⚠️ skipReset=1：未清空 poopCounter / poopCounterByUser");
  }

  return {
    skipped: false,
    backupMonthKey: `${backupYear}-${monthString}`,
    wroteBackup: shouldWriteBackup,
    didReset,
    userKeysInBackup: Object.keys(backupData).length,
  };
}

/**
 * 將「目前即時資料裡仍存在的」指定年月每日紀錄合併進 monthlyHistory，並可選擇從即時節點刪除該月日期鍵（綁定會員主要在 poopCounterByUser）。
 * @param {{ dryRun?: boolean, stripFromLive?: boolean }} options stripFromLive 預設 true（寫入歷史後從即時移除該月鍵，避免重複）
 */
async function backfillMonthHistoryFromLive(targetYear, targetMonth, options = {}) {
  const dryRun = Boolean(options.dryRun);
  const stripFromLive = options.stripFromLive !== false;

  const monthString = String(targetMonth).padStart(2, "0");
  const monthKey = `${targetYear}-${monthString}`;

  const poopRef = db.ref("poopCounter");
  const userPoopRef = db.ref("poopCounterByUser");
  const [poopSnap, userSnap] = await Promise.all([poopRef.once("value"), userPoopRef.once("value")]);
  const data = poopSnap.val() || {};
  const userCounterData = userSnap.val() || {};

  const uidToName = await loadUidToName();
  const slice = buildMonthSliceFromLive(data, userCounterData, uidToName, targetYear, targetMonth);

  const backupRef = db.ref(`monthlyHistory/${monthKey}`);
  const existing = (await backupRef.once("value")).val() || {};

  const merged = { ...existing };
  let sliceKeysWithData = 0;
  for (const [key, entry] of Object.entries(slice)) {
    if (!poopSliceHasData(entry)) continue;
    sliceKeysWithData += 1;
    if (merged[key]) {
      merged[key] = mergePoopNodes(merged[key], entry);
    } else {
      merged[key] = entry;
    }
  }

  const stripSummary = { poopCounter: 0, poopCounterByUser: 0 };

  if (!dryRun) {
    await backupRef.set(merged);

    if (stripFromLive) {
      await Promise.all(
        Object.entries(data).map(([name, entry]) => {
          const stripped = stripMonthFromPoopEntry(entry, targetYear, targetMonth);
          if (stripped !== entry) {
            stripSummary.poopCounter += 1;
            return db.ref(`poopCounter/${name}`).set(stripped);
          }
          return Promise.resolve();
        })
      );
      await Promise.all(
        Object.entries(userCounterData).map(([uid, entry]) => {
          const stripped = stripMonthFromPoopEntry(entry, targetYear, targetMonth);
          if (stripped !== entry) {
            stripSummary.poopCounterByUser += 1;
            return db.ref(`poopCounterByUser/${uid}`).set(stripped);
          }
          return Promise.resolve();
        })
      );
    }
  }

  return {
    monthKey,
    sliceKeysWithData,
    mergedUserKeys: Object.keys(merged).length,
    dryRun,
    stripFromLive: dryRun ? false : stripFromLive,
    stripSummary: dryRun ? null : stripSummary,
  };
}

// ✅ 每月自動結算（GCF Gen 2）
exports.monthlyReset = onSchedule(
  {
    schedule: "0 0 1 * *",
    timeZone: "Asia/Taipei",
    region: "asia-east1",
    memory: "256MiB",
    cpu: 1,
  },
  async () => {
    try {
      await executeMonthlyReset({ forceBackup: false, skipReset: false });
      return null;
    } catch (error) {
      console.error("❌ 月底結算發生錯誤:", error);
      throw error;
    }
  }
);

// ✅ 手動觸發結算（瀏覽器或 curl）
// 範例：只補上個月歷史、不清空本月 → ?forceBackup=1&skipReset=1
// 若有設定環境變數 MONTHLY_RESET_KEY，必須帶 ?key=該值
exports.testMonthlyReset = functions.https.onRequest(async (req, res) => {
  try {
    const requiredKey = process.env.MONTHLY_RESET_KEY;
    if (requiredKey && req.query.key !== requiredKey) {
      res.status(403).send("Forbidden");
      return;
    }

    const forceBackup = req.query.forceBackup === "1" || req.query.forceBackup === "true";
    const skipReset = req.query.skipReset === "1" || req.query.skipReset === "true";

    const result = await executeMonthlyReset({ forceBackup, skipReset });
    res.status(200).json({
      ok: true,
      message: "monthlyReset 已執行",
      forceBackup,
      skipReset,
      ...result,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

// ✅ 補指定月份到 monthlyHistory（從即時 poopCounter / poopCounterByUser 切出該月資料並合併）
// 範例：year=2026&month=4&dryRun=1 先看會合併幾人；正式執行去掉 dryRun，並可加 stripLive=0 保留即時裡的該月鍵
// 若有 MONTHLY_RESET_KEY 須帶 key=
exports.backfillMonthlyHistory = functions.https.onRequest(async (req, res) => {
  try {
    const requiredKey = process.env.MONTHLY_RESET_KEY;
    if (requiredKey && req.query.key !== requiredKey) {
      res.status(403).send("Forbidden");
      return;
    }

    const year = parseInt(req.query.year, 10);
    const month = parseInt(req.query.month, 10);
    if (!year || !month || month < 1 || month > 12) {
      res.status(400).json({
        ok: false,
        error: "需要有效的 year、month（例：?year=2026&month=4）",
      });
      return;
    }

    const dryRun = req.query.dryRun === "1" || req.query.dryRun === "true";
    const stripLive = req.query.stripLive !== "0" && req.query.stripLive !== "false";

    const result = await backfillMonthHistoryFromLive(year, month, {
      dryRun,
      stripFromLive: stripLive,
    });

    res.status(200).json({
      ok: true,
      message: dryRun ? "dryRun：未寫入資料庫" : "已合併至 monthlyHistory",
      ...result,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

const OVERPASS_INTERPRETER = "https://overpass-api.de/api/interpreter";

function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function overpassToiletsQuery(radius, lat, lon) {
  return `
[out:json][timeout:25];
(
  node["amenity"="toilets"](around:${radius},${lat},${lon});
  way["amenity"="toilets"](around:${radius},${lat},${lon});
  relation["amenity"="toilets"](around:${radius},${lat},${lon});
);
out center;
`.trim();
}

function osmElementToPoint(el) {
  if (el.type === "node" && el.lat != null && el.lon != null) {
    return { lat: el.lat, lon: el.lon };
  }
  if (el.center && el.center.lat != null && el.center.lon != null) {
    return { lat: el.center.lat, lon: el.center.lon };
  }
  return null;
}

async function fetchOsmToiletsAround(lat, lon, radiusM) {
  const q = overpassToiletsQuery(radiusM, lat, lon);
  const body = new URLSearchParams();
  body.set("data", q);
  const r = await fetch(OVERPASS_INTERPRETER, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`Overpass HTTP ${r.status}: ${t.slice(0, 240)}`);
  }
  return r.json();
}

/** 附近公共廁所（OpenStreetMap，經 Overpass 代理）GET ?lat=&lon=&radius= */
exports.nearbyToilets = functions.https.onRequest((req, res) => {
  corsForToilets(req, res, () => {
    void (async () => {
      if (req.method === "OPTIONS") {
        res.status(204).end();
        return;
      }
      if (req.method !== "GET") {
        res.status(405).json({ ok: false, error: "請使用 GET" });
        return;
      }

      const lat = parseFloat(req.query.lat);
      const lon = parseFloat(req.query.lon);
      let radius = parseInt(req.query.radius, 10);

      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        res.status(400).json({ ok: false, error: "需要有效的查詢參數 lat、lon（十進位經緯度）" });
        return;
      }
      if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
        res.status(400).json({ ok: false, error: "經緯度超出範圍" });
        return;
      }
      if (!Number.isFinite(radius) || radius < 50) radius = 800;
      if (radius > 5000) radius = 5000;

      try {
        const data = await fetchOsmToiletsAround(lat, lon, radius);
        const elements = data.elements || [];
        const toilets = [];
        for (const el of elements) {
          const p = osmElementToPoint(el);
          if (!p) continue;
          const tags = el.tags || {};
          const dist = haversineMeters(lat, lon, p.lat, p.lon);
          toilets.push({
            osmType: el.type,
            osmId: el.id,
            lat: p.lat,
            lon: p.lon,
            distanceMeters: Math.round(dist),
            name: tags.name || tags.operator || "公共廁所",
            fee: tags.fee ?? null,
            wheelchair: tags.wheelchair ?? null,
            openingHours: tags.opening_hours ?? null,
            address:
              [tags["addr:street"], tags["addr:housenumber"]].filter(Boolean).join(" ").trim() ||
              null,
          });
        }
        toilets.sort((a, b) => a.distanceMeters - b.distanceMeters);

        res.status(200).json({
          ok: true,
          source: "OpenStreetMap / Overpass API",
          attribution: "資料 © OpenStreetMap 貢獻者，ODbL",
          count: toilets.length,
          lat,
          lon,
          radiusMeters: radius,
          toilets,
        });
      } catch (error) {
        console.error("nearbyToilets:", error);
        res.status(500).json({ ok: false, error: error.message || "Overpass 查詢失敗" });
      }
    })();
  });
});