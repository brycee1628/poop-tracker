const functions = require("firebase-functions");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");
admin.initializeApp();

const db = admin.database();

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

      // 處理 +1 計數
      const countMatch = msg.match(/^(.+?)\s*\+1$/);
      if (countMatch) {
        const name = countMatch[1];
        const ref = db.ref(`poopCounter/${name}`);

        // 獲取當前日期，使用台北時區
        const now = new Date();
        // 調整為台北時區 (UTC+8)
        const taipeiTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
        const year = taipeiTime.getUTCFullYear();
        const month = String(taipeiTime.getUTCMonth() + 1).padStart(2, '0');
        const day = String(taipeiTime.getUTCDate()).padStart(2, '0');
        const dateString = `${year}-${month}-${day}`;

        await ref.transaction((current) => {
          if (!current) {
            return {
              count: 1,
              dailyRecords: {
                [dateString]: 1
              }
            };
          }

          // 處理舊數據格式
          if (typeof current === 'number') {
            return {
              count: current + 1,
              dailyRecords: {
                [dateString]: 1
              }
            };
          }

          // 新數據格式
          const newDailyRecords = { ...(current.dailyRecords || {}) };
          newDailyRecords[dateString] = (newDailyRecords[dateString] || 0) + 1;

          return {
            ...current,
            count: (current.count || 0) + 1,
            dailyRecords: newDailyRecords
          };
        });
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
    // 獲取台北時區的當前日期
    const now = new Date();
    // 調整為台北時區 (UTC+8)
    const taipeiTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);

    // 計算上個月的年份和月份
    // 這裡先創建上個月1號的日期
    const lastMonthDate = new Date(taipeiTime);
    lastMonthDate.setUTCDate(1); // 設置為當月1號
    lastMonthDate.setUTCMonth(lastMonthDate.getUTCMonth() - 1); // 減去一個月

    const backupYear = lastMonthDate.getUTCFullYear();
    const backupMonth = lastMonthDate.getUTCMonth() + 1; // 月份從0開始，所以+1
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

    // 備份數據到對應月份
    const backupRef = db.ref(`monthlyHistory/${backupYear}-${monthString}`);
    await backupRef.set(data);

    // 保留宣言，重置計數
    const declarations = {};

    // 收集所有用戶的宣言
    Object.entries(data).forEach(([name, userData]) => {
      // 只保留宣言字段
      if (typeof userData === 'object' && userData.declaration) {
        declarations[name] = {
          count: 0,
          declaration: userData.declaration,
          dailyRecords: {}
        };
      }
    });

    // 清空所有計數但保留宣言
    await poopRef.set(declarations);

    console.log(`📦 已備份 ${backupYear}-${monthString} 並重置排行榜，保留用戶宣言`);
    return null;
  }
);


// // ✅ 手動測試 monthlyReset（可從瀏覽器觸發）
// exports.testMonthlyReset = functions.https.onRequest(async (req, res) => {
//   await exports.monthlyReset.run();
//   res.send("✅ monthlyReset 手動觸發完成！");
// });