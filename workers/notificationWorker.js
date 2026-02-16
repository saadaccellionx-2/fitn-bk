const notificationQueue = require('../queue/notificationQueue');
const { USER_MODEL } = require('../models');
const {
  notifyUsersOptimized,
  getUsersToNotify,
} = require('../services/notificationService');

// Process content notifications (videos, playlists)
notificationQueue.process('send-content-notification', async (job) => {
  const { creatorId, contentType, contentId, contentName, imageUrl } = job.data;

  try {
    // 1. Fetch creator info
    const creator = await USER_MODEL.findById(creatorId)
      .select('name email')
      .lean();

    if (!creator) {
      throw new Error(`Creator ${creatorId} not found`);
    }

    // 2. Determine preference type
    const preferenceType = contentType === 'video' ? 'newVideo' : 'newPlaylist';

    // 3. Get users to notify
    const receiverIds = await getUsersToNotify(creatorId, preferenceType);

    if (!receiverIds || receiverIds.length === 0) {
      return { success: true, notified: 0 };
    }

    // 4. Build notification title and body
    const title = contentType === 'video' 
      ? 'New Video Alert 🎬' 
      : 'New Playlist Alert';
    
    const body = contentType === 'video'
      ? `${creator.name || creator.email} uploaded a new video!`
      : `${creator.name || creator.email} created a "${contentName}" playlist!`;

    // 5. Call optimized notification function
    const result = await notifyUsersOptimized(receiverIds, {
      sender: creatorId,
      title,
      body,
      additionalData: {
        type: contentType,
        id: contentId,
        imageUrl: imageUrl || null,
      },
    });

    return result;
  } catch (error) {
    // Throw error for Bull to handle retries
    throw error;
  }
});

module.exports = notificationQueue;

