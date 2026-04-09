const functions = require("firebase-functions/v1");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");
admin.initializeApp();

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
  if (val == null) return { count: 0, declaration: null, dailyRecords: {} };
  if (typeof val === "number") {
    return { count: val, declaration: null, dailyRecords: {} };
  }
  return {
    count: val.count || 0,
    declaration: val.declaration || null,
    dailyRecords: val.dailyRecords && typeof val.dailyRecords === "object" ? val.dailyRecords : {},
  };
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
  };
}

async function incrementCounterAtPath(path) {
  const targetRef = db.ref(path);
  const { dateString, timeString } = buildNowInTaipei();

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

    const newDailyRecords = { ...(current.dailyRecords || {}) };
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
      count: (current.count || 0) + 1,
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

      // 處理刪除指令
      const deleteMatch = msg.match(/^(.+?)\s+delete$/i);
      if (deleteMatch) {
        const name = deleteMatch[1].trim();
        const userRef = db.ref(`poopCounter/${name}`);

        // 檢查用戶是否存在
        const userSnapshot = await userRef.once("value");
        if (userSnapshot.exists()) {
          // 刪除用戶資料
          await userRef.remove();
          console.log(`🗑️ 已刪除用戶: ${name}`);
        } else {
          console.log(`⚠️ 用戶不存在: ${name}`);
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
      // 獲取台北時區的當前日期
      const now = new Date();
      // 使用台北時區 (UTC+8)
      const taipeiTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Taipei" }));

      // 計算上個月的年份和月份
      const lastMonthDate = new Date(taipeiTime);
      lastMonthDate.setDate(1); // 設置為當月1號
      lastMonthDate.setMonth(lastMonthDate.getMonth() - 1); // 減去一個月

      const backupYear = lastMonthDate.getFullYear();
      const backupMonth = lastMonthDate.getMonth() + 1; // 月份從0開始，所以+1
      const monthString = String(backupMonth).padStart(2, "0");

      console.log(`🗓️ 當前台北時間: ${taipeiTime.toISOString()}`);
      console.log(`📅 備份上個月: ${backupYear}-${monthString}`);

      const poopRef = db.ref("poopCounter");
      const snapshot = await poopRef.once("value");
      const data = snapshot.val();

      if (!data) {
        console.log("💤 沒有排行榜資料，跳過結算");
        return null;
      }

      // 檢查是否已經備份過這個月份
      const backupRef = db.ref(`monthlyHistory/${backupYear}-${monthString}`);
      const existingBackup = await backupRef.once("value");

      if (existingBackup.exists()) {
        console.log(`⚠️ ${backupYear}-${monthString} 已經備份過，跳過重複備份`);
        return null;
      }

      // 備份數據到對應月份
      await backupRef.set(data);
      console.log(`📦 已備份 ${backupYear}-${monthString} 的資料`);

      // 重置所有用戶資料，但保留宣言
      const resetData = {};

      Object.entries(data).forEach(([name, userData]) => {
        if (typeof userData === 'number') {
          // 處理舊格式用戶（純數字）
          resetData[name] = {
            count: 0,
            dailyRecords: {}
          };
        } else {
          // 處理新格式用戶（對象格式）
          resetData[name] = {
            count: 0,
            declaration: userData.declaration || null, // 保留宣言
            dailyRecords: {}
          };
        }
      });

      // 更新資料庫
      await poopRef.set(resetData);

      console.log(`✅ 已重置排行榜，保留 ${Object.keys(resetData).length} 位用戶的宣言`);
      console.log(`📊 重置的用戶: ${Object.keys(resetData).join(', ')}`);

      return null;
    } catch (error) {
      console.error("❌ 月底結算發生錯誤:", error);
      throw error;
    }
  }
);


// ✅ 手動測試 monthlyReset（可從瀏覽器觸發）
exports.testMonthlyReset = functions.https.onRequest(async (req, res) => {
  try {
    await exports.monthlyReset.run();
    res.send("✅ monthlyReset 手動觸發完成！");
  } catch (error) {
    res.status(500).send(`❌ 錯誤: ${error.message}`);
  }
});