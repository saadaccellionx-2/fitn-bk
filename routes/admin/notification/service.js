const { ADMIN_NOTIFICATION, USER_MODEL } = require("../../../models");
const handleError = require("../../../utils/errorHandler");

module.exports = {
  // GET: Fetch all notifications with optional filters, search, pagination
  FIND_ALL_NOTIFICATIONS: async (req, res) => {
    try {
      const {
        pageNum = 1,
        perPage = 10,
        search = "",
        sortBy = "newest",
        status,
        days,
      } = req.query;

      const query = {};

      if (status) {
        query.status = status;
      }

      if (search) {
        query.$or = [
          { title: { $regex: search, $options: "i" } },
          { body: { $regex: search, $options: "i" } },
        ];
      }

      // Add date range filter if days parameter is provided
      if (days) {
        const daysNum = Number(days);
        if (daysNum > 0) {
          const fromDate = new Date(Date.now() - daysNum * 24 * 60 * 60 * 1000);
          query.createdAt = { $gte: fromDate };
        }
      }

      const pageNumber = Number(pageNum) || 1;
      const itemsPerPage = Number(perPage) || 10;
      const skip = (pageNumber - 1) * itemsPerPage;

      const totalNotifications = await ADMIN_NOTIFICATION.countDocuments(query);
      const unreadCount = await ADMIN_NOTIFICATION.countDocuments({
        status: "unread",
      });

      const notifications = await ADMIN_NOTIFICATION.find(query)
        .sort(sortBy === "newest" ? { createdAt: -1 } : { createdAt: 1 })
        .skip(skip)
        .limit(itemsPerPage);
      // .populate("relatedItem");

      await Promise.all(
        notifications.map(async (notification) => {
          if (notification.type === "form_submission") {
            return;
          }
          if (notification.relatedItem) {
            await notification.populate("relatedItem");
          }
          if (
            notification.type === "playlists" &&
            notification.relatedItem &&
            notification.relatedItem.owner
          ) {
            const user = await USER_MODEL.findById(
              notification.relatedItem.owner
            ).select("name role email");
            if (user) {
              notification.relatedItem.owner = user;
            }
          } else if (
            notification.type === "users" &&
            notification.relatedItem &&
            notification.relatedItem._id
          ) {
            const user = await USER_MODEL.findById(
              notification.relatedItem._id
            ).select("role");
            if (user) {
              notification.type = user.role;
            }
          }
        })
      );

      if (!notifications.length) {
        return res.status(200).json({
          status: "error",
          message: "No notifications found",
        });
      }

      return res.status(200).json({
        message: "Notifications retrieved successfully",
        data: notifications,
        unreadCount: unreadCount,
        pagination: {
          pageNum: pageNumber,
          perPage: itemsPerPage,
          totalItems: totalNotifications,
        },
      });
    } catch (error) {
      return handleError(error, res);
    }
  },

  // PATCH: Mark a single notification as read
  MARK_NOTIFICATION_AS_READ: async (req, res) => {
    try {
      const { id } = req.params;
      console.log(id);
      const notification = await ADMIN_NOTIFICATION.findOneAndUpdate(
        { _id: id },
        { status: "read" },
        { new: true }
      );
      console.log(notification);
      if (!notification) {
        return res.status(404).json({
          status: "error",
          message: "Notification not found",
        });
      }

      return res.status(200).json({
        message: "Notification marked as read",
        data: notification,
      });
    } catch (error) {
      return handleError(error, res);
    }
  },

  // PATCH: Mark all notifications as read
  MARK_ALL_NOTIFICATIONS_AS_READ: async (req, res) => {
    try {
      const result = await ADMIN_NOTIFICATION.updateMany(
        { status: "unread" },
        { status: "read" }
      );

      return res.status(200).json({
        message: "All notifications marked as read",
        modifiedCount: result.modifiedCount,
      });
    } catch (error) {
      return handleError(error, res);
    }
  },

  // GET: Get single notification by ID
  GET_NOTIFICATION_BY_ID: async (req, res) => {
    try {
      const { id } = req.params;

      const notification = await ADMIN_NOTIFICATION.findOne({
        _id: id,
      }).populate("relatedItem");

      if (!notification) {
        return res.status(404).json({
          status: "error",
          message: "Notification not found",
        });
      }

      return res.status(200).json({
        message: "Notification retrieved successfully",
        data: notification,
      });
    } catch (error) {
      return handleError(error, res);
    }
  },

  // DELETE: Hard delete a single notification
  DELETE_NOTIFICATION_BY_ID: async (req, res) => {
    try {
      const { id } = req.params;

      const notification = await ADMIN_NOTIFICATION.findOneAndDelete({
        _id: id,
      });

      if (!notification) {
        return res.status(404).json({
          status: "error",
          message: "Notification not found",
        });
      }

      return res.status(200).json({
        message: "Notification deleted successfully",
        data: notification,
      });
    } catch (error) {
      return handleError(error, res);
    }
  },

  // DELETE: Hard delete all notifications
  DELETE_ALL_NOTIFICATIONS: async (req, res) => {
    try {
      const { ids } = req.body || {};
      const filter =
        Array.isArray(ids) && ids.length ? { _id: { $in: ids } } : {};

      const result = await ADMIN_NOTIFICATION.deleteMany(filter);

      const deletedCount = result.deletedCount || 0;
      const message =
        Array.isArray(ids) && ids.length
          ? "Selected notifications deleted successfully"
          : "All notifications deleted successfully";

      return res.status(200).json({
        message,
        deletedCount,
      });
    } catch (error) {
      return handleError(error, res);
    }
  },

  // POST: Hard delete selected notifications (dedicated bulk endpoint)
  DELETE_BULK_NOTIFICATIONS: async (req, res) => {
    try {
      const { ids } = req.body || {};
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({
          status: "error",
          message: "ids array is required",
        });
      }

      const result = await ADMIN_NOTIFICATION.deleteMany({ _id: { $in: ids } });
      const deletedCount = result.deletedCount || 0;

      return res.status(200).json({
        message: "Selected notifications deleted successfully",
        deletedCount,
      });
    } catch (error) {
      return handleError(error, res);
    }
  },
};
