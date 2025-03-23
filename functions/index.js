const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();

const db = admin.database();

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
