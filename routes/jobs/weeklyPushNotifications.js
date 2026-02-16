const cron = require("node-cron");
const axios = require("axios");
const { USER_MODEL } = require("../../models");

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

async function sendPushNotification(token, title, body) {
  if (!token || !token.startsWith("ExponentPushToken")) return;

  try {
    await axios.post(EXPO_PUSH_URL, {
      to: token,
      sound: "default",
      title,
      body,
      data: { type: "weeklyNotification" },
    });
  } catch (error) {
    console.error("Error sending push notification:", error.message);
  }
}

async function sendWeeklyNotifications() {
  console.log("📅 Running weekly notification job...");

  try {
    const users = await USER_MODEL.find({
      notificationToken: { $exists: true, $ne: "" },
    });

    if (!users.length) {
      console.log("No users found with push tokens.");
      return;
    }
    const chunkSize = 70;
    let totalSent = 0;
    let totalFailed = 0;

    for (let i = 0; i < users.length; i += chunkSize) {
      const chunk = users.slice(i, i + chunkSize);

      const results = await Promise.all(
        chunk.map((user) =>
          sendPushNotification(
            user.notificationToken,
            "🔥 Check out on FITN!",
            "Check out the latest videos on FITN for you to save!"
          )
        )
      );

      totalSent += results.filter((r) => r).length;
      totalFailed += results.filter((r) => !r).length;
    }
  } catch (err) {
    console.error("❌ Error in weekly notification job:", err);
  }
}

cron.schedule("0 10 * * 1,4", () => {
  sendWeeklyNotifications();
});

module.exports = sendWeeklyNotifications;
