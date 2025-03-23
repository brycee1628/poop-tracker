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
      const match = msg.match(/^(.+?)\s*\+1$/);

      if (match) {
        const name = match[1];
        const ref = db.ref(`poopCounter/${name}`);
        await ref.transaction((current) => (current || 0) + 1);
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
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const monthString = String(month === 0 ? 12 : month).padStart(2, "0");
    const backupYear = month === 0 ? year - 1 : year;

    const poopRef = db.ref("poopCounter");
    const snapshot = await poopRef.once("value");
    const data = snapshot.val();

    if (!data) {
      console.log("💤 沒有排行榜資料，跳過結算");
      return null;
    }

    const backupRef = db.ref(`monthlyHistory/${backupYear}-${monthString}`);
    await backupRef.set(data);
    await poopRef.remove();

    console.log(`📦 已備份 ${backupYear}-${monthString} 並清空排行榜`);
    return null;
  }
);

// ✅ 手動測試 monthlyReset（可從瀏覽器觸發）
exports.testMonthlyReset = functions.https.onRequest(async (req, res) => {
  await exports.monthlyReset.run();
  res.send("✅ monthlyReset 手動觸發完成！");
});