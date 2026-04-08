const functions = require("firebase-functions/v1");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");
admin.initializeApp();

const db = admin.database();

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

async function incrementCounterAtPath(path) {
  const targetRef = db.ref(path);
  const { dateString, timeString } = buildNowInTaipei();

  await targetRef.transaction((current) => {
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
}

// ✅ LINE Webhook（GCF Gen 1）
exports.lineWebhook = functions.https.onRequest(async (req, res) => {
  const events = req.body.events;

  for (const event of events) {
    if (event.type === "message" && event.message.type === "text") {
      const msg = event.message.text.trim();

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
            continue;
          }
          const lineBindingSnapshot = await db.ref(`lineUsers/${lineUserId}`).once("value");
          const lineBinding = lineBindingSnapshot.val();
          targetName = lineBinding?.name || null;
          if (!targetName) {
            console.log(`⚠️ +1 找不到綁定名稱: ${lineUserId}`);
            continue;
          }
        }

        const uidSnapshot = await db.ref(`nameToUid/${targetName}`).once("value");
        const uid = uidSnapshot.val();
        if (uid) {
          await incrementCounterAtPath(`poopCounterByUser/${uid}`);
        } else {
          await incrementCounterAtPath(`poopCounter/${targetName}`);
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