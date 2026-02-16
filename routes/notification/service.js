const { NOTIFICATION_MODEL } = require("../../models");
const handleError = require("../../utils/errorHandler");

module.exports = {
  CREATE: async (req, res) => {
    try {
      const { receiver, title, body, additionalData } = req.body;
      const senderId = req.user._id;

      const notificationData = {
        sender: senderId,
        receiver,
        title,
        body,
        status: "unread",
        additionalData: additionalData ? { ...additionalData } : {},
      };

      // Save new notification
      const newNotification = await NOTIFICATION_MODEL.create(notificationData);

      // Count total notifications for this receiver
      const totalCount = await NOTIFICATION_MODEL.countDocuments({ receiver });

      // If count exceeds 30, delete the oldest extra ones
      if (totalCount > 30) {
        const toDeleteCount = totalCount - 30;

        // Find the oldest notifications to delete
        const oldest = await NOTIFICATION_MODEL.find({ receiver })
          .sort({ createdAt: 1 }) // oldest first
          .limit(toDeleteCount)
          .select("_id");

        const idsToDelete = oldest.map((n) => n._id);

        // Delete them
        await NOTIFICATION_MODEL.deleteMany({ _id: { $in: idsToDelete } });
      }

      return res.status(201).json({
        type: "success",
        message: "Notification sent and saved successfully",
        data: newNotification,
      });
    } catch (error) {
      return handleError(error, res);
    }
  },

  FIND_ALL: async (req, res) => {
    try {
      const userId = req.user._id;
      const { status } = req.query;

      const query = { receiver: userId };
      if (status) query.status = status;
      if (req?.query?.filter === "last7days") {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        query.createdAt = { $gte: sevenDaysAgo }; // or appropriate filter
      }

      // Fetch latest 30 notifications (sorted by latest)
      const notifications = await NOTIFICATION_MODEL.find(query)
        .sort({ createdAt: -1 })
        .limit(30)
        .populate("sender", "name profilePic");

      // Background update to mark unread ones as read
      const unreadIds = notifications
        .filter((n) => n.status === "unread")
        .map((n) => n._id);

      if (unreadIds.length) {
        NOTIFICATION_MODEL.updateMany(
          { _id: { $in: unreadIds } },
          { $set: { status: "read" } }
        ).exec(); // non-blocking
      }

      return res.status(200).json({
        type: "success",
        message: "Notifications retrieved successfully",
        data: notifications, // original unread/read status preserved in response
      });
    } catch (error) {
      return handleError(error, res);
    }
  },

  UPDATE_BY_ID: async (req, res) => {
    try {
      const notification = await NOTIFICATION_MODEL.findByIdAndUpdate(
        req.params.id,
        { status: req.body.status },
        { new: true }
      );

      if (!notification) {
        return res.status(404).json({
          status: "error",
          message: "Notification not found",
        });
      }

      return res.status(200).json({
        type: "success",
        message: "Notification updated successfully",
        data: notification,
      });
    } catch (error) {
      return handleError(error, res);
    }
  },

  DELETE_BY_ID: async (req, res) => {
    try {
      const notification = await NOTIFICATION_MODEL.findByIdAndDelete(
        req.params.id
      );

      if (!notification) {
        return res.status(404).json({
          status: "error",
          message: "Notification not found",
        });
      }

      return res.status(200).json({
        type: "success",
        message: "Notification deleted successfully",
      });
    } catch (error) {
      return handleError(error, res);
    }
  },

  UNREAD_COUNT: async (req, res) => {
    try {
      const userId = req.user._id;

      const unreadCount = await NOTIFICATION_MODEL.countDocuments({
        receiver: userId,
        status: "unread",
      });

      return res.status(200).json({
        type: "success",
        message: "Unread notification count retrieved successfully",
        count: unreadCount,
      });
    } catch (error) {
      return handleError(error, res);
    }
  },
};
