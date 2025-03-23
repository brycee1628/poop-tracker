const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();

const db = admin.database();

// ✅ LINE Webhook 功能
exports.lineWebhook = functions.https.onRequest(async (req, res) => {
    const events = req.body.events;

    for (const event of events) {
        if (event.type === "message" && event.message.type === "text") {
            const msg = event.message.text.trim();
            const match = msg.match(/^(.+?)\s*\+1$/); // 範例："滅世魔王 +1"

            if (match) {
                const name = match[1];
                const ref = db.ref(`poopCounter/${name}`);
                await ref.transaction((current) => {
                    return (current || 0) + 1;
                });
            }
        }
    }

    res.status(200).send("OK");
});

// ✅ 每月 1 號 自動備份 + 歸零排行榜
exports.monthlyReset = functions.pubsub
    .schedule('0 0 1 * *') // 每月 1 號 00:00 UTC（台灣是 08:00）
    .timeZone('Asia/Taipei')
    .onRun(async () => {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth(); // 0 表示 1 月
        const monthString = String(month === 0 ? 12 : month).padStart(2, '0');
        const backupYear = month === 0 ? year - 1 : year;

        const poopRef = db.ref('poopCounter');
        const snapshot = await poopRef.once('value');
        const data = snapshot.val();

        if (!data) {
            console.log('💤 沒有排行榜資料，跳過結算');
            return null;
        }

        const backupRef = db.ref(`monthlyHistory/${backupYear}-${monthString}`);
        await backupRef.set(data);
        await poopRef.remove();

        console.log(`📦 已備份 ${backupYear}-${monthString} 並清空排行榜`);
        return null;
    });
