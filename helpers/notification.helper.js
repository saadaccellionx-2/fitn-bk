const axios = require("axios");
const { NOTIFICATION_MODEL, USER_MODEL } = require("../models");

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

async function sendPushNotification(token, title, body, data = {}) {
  if (!token || !token.startsWith("ExponentPushToken")) return;

  try {
    await axios.post(EXPO_PUSH_URL, {
      to: token,
      sound: "default",
      title,
      body,
      data,
    });
    return true;
  } catch (err) {
    console.error("❌ Error sending push notification:", err.message);
    return false;
  }
}

async function notifyUser({
  receiver,
  sender,
  title,
  body,
  additionalData = {},
}) {
  try {
    const newNotification = await NOTIFICATION_MODEL.create({
      sender,
      receiver,
      title,
      body,
      status: "unread",
      additionalData,
    });

    const user = await USER_MODEL.findById(receiver).select(
      "notificationToken"
    );
    if (user?.notificationToken) {
      await sendPushNotification(
        user.notificationToken,
        title,
        body,
        additionalData
      );
    }

    return newNotification;
  } catch (err) {
    console.error("❌ notifyUser error:", err.message);
    return null;
  }
}

async function notifyUsers(
  receivers,
  { sender, title, body, additionalData = {} }
) {
  const promises = receivers.map((userId) =>
    notifyUser({ receiver: userId, sender, title, body, additionalData })
  );
  return Promise.all(promises);
}

module.exports = { notifyUser, notifyUsers, sendPushNotification };
