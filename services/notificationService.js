const axios = require('axios');
const { NOTIFICATION_MODEL, USER_MODEL, NOTIFICATION_PREFERENCES_MODEL } = require('../models');

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const BATCH_SIZE = 100;
const TIMEOUT_MS = 15000;

/**
 * Send batch push notifications to Expo API
 * @param {Array} messages - Array of Expo push notification messages
 * @returns {Promise<Array>} Results array with status for each notification
 */
async function sendBatchPushNotifications(messages) {
  if (!messages || messages.length === 0) {
    return [];
  }

  const results = [];
  
  // Split into batches of 100
  for (let i = 0; i < messages.length; i += BATCH_SIZE) {
    const batch = messages.slice(i, i + BATCH_SIZE);
    
    try {
      const response = await axios.post(EXPO_PUSH_URL, batch, {
        timeout: TIMEOUT_MS,
        headers: {
          'Content-Type': 'application/json',
        },
      });

      // Expo returns an array of results, one per message
      if (Array.isArray(response.data)) {
        results.push(...response.data);
      } else {
        // If single result, wrap it
        results.push(response.data);
      }
    } catch (error) {
      // Add error results for this batch
      batch.forEach(() => {
        results.push({ status: 'error', message: error.message });
      });
    }
  }

  return results;
}

/**
 * Optimized notification function for multiple users
 * Uses bulk operations to minimize database queries
 * @param {Array} receiverIds - Array of user IDs to notify
 * @param {Object} notificationData - {sender, title, body, additionalData}
 * @returns {Promise<Object>} {success: boolean, notified: number}
 */
async function notifyUsersOptimized(receiverIds, { sender, title, body, additionalData = {} }) {
  if (!receiverIds || receiverIds.length === 0) {
    return { success: true, notified: 0 };
  }

  try {
    // 1. Fetch ALL user tokens in ONE query
    const users = await USER_MODEL.find(
      { 
        _id: { $in: receiverIds }, 
        notificationToken: { $exists: true } 
      }
    ).select('_id notificationToken').lean();

    // 2. Create token map for O(1) lookup
    const tokenMap = new Map();
    users.forEach(user => {
      if (user.notificationToken && user.notificationToken.startsWith('ExponentPushToken')) {
        tokenMap.set(user._id.toString(), user.notificationToken);
      }
    });

    // 3. Prepare notifications for bulk insert
    const notifications = receiverIds.map(receiverId => ({
      sender,
      receiver: receiverId,
      title,
      body,
      status: 'unread',
      additionalData,
      createdAt: new Date(),
    }));

    // 4. Bulk insert notifications (ordered: false allows partial success)
    await NOTIFICATION_MODEL.insertMany(notifications, { ordered: false });

    // 5. Prepare push notification messages
    const pushMessages = [];
    receiverIds.forEach(receiverId => {
      const token = tokenMap.get(receiverId.toString());
      if (token) {
        pushMessages.push({
          to: token,
          sound: 'default',
          title,
          body,
          data: additionalData,
        });
      }
    });

    // 6. Send push notifications in batches
    if (pushMessages.length > 0) {
      await sendBatchPushNotifications(pushMessages);
    }

    const notifiedCount = pushMessages.length;
    return { success: true, notified: notifiedCount };
  } catch (error) {
    // Return partial success - some notifications may have been created
    return { success: false, notified: 0, error: error.message };
  }
}

/**
 * Get users to notify based on preferences
 * @param {String} targetUserId - The user whose content triggered the notification
 * @param {String} preferenceType - 'newVideo' or 'newPlaylist'
 * @returns {Promise<Array>} Array of user IDs to notify
 */
async function getUsersToNotify(targetUserId, preferenceType) {
  try {
    // Build the query object dynamically
    const query = {
      targetUserId,
    };
    query[`preferences.${preferenceType}`] = true;

    const preferences = await NOTIFICATION_PREFERENCES_MODEL.find(query)
      .select('userId')
      .lean();

    return preferences.map(p => p.userId);
  } catch (error) {
    return [];
  }
}

/**
 * Single user notification (for comments, likes, etc.)
 * Keep existing functionality for immediate notifications
 * @param {Object} params - {receiver, sender, title, body, additionalData}
 * @returns {Promise<Object|null>} Created notification or null on error
 */
async function notifyUser({ receiver, sender, title, body, additionalData = {} }) {
  try {
    const newNotification = await NOTIFICATION_MODEL.create({
      sender,
      receiver,
      title,
      body,
      status: 'unread',
      additionalData,
    });

    const user = await USER_MODEL.findById(receiver).select('notificationToken').lean();
    if (user?.notificationToken && user.notificationToken.startsWith('ExponentPushToken')) {
      // Send push notification (non-blocking)
      sendBatchPushNotifications([{
        to: user.notificationToken,
        sound: 'default',
        title,
        body,
        data: additionalData,
      }]).catch(() => {});
    }

    return newNotification;
  } catch (err) {
    return null;
  }
}

module.exports = {
  sendBatchPushNotifications,
  notifyUsersOptimized,
  getUsersToNotify,
  notifyUser,
};

