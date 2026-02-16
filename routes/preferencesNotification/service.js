const { NOTIFICATION_PREFERENCES_MODEL } = require("../../models");
const handleError = require("../../utils/errorHandler");

module.exports = {
  CREATE_OR_UPDATE: async (req, res) => {
    try {
      const userId = req.user._id;
      const { targetUserId, newVideo, newPlaylist } = req.body;

      const preferences = {
        ...(typeof newVideo === "boolean" && {
          "preferences.newVideo": newVideo,
        }),
        ...(typeof newPlaylist === "boolean" && {
          "preferences.newPlaylist": newPlaylist,
        }),
      };

      const data = await NOTIFICATION_PREFERENCES_MODEL.findOneAndUpdate(
        { userId, targetUserId },
        {
          $set: preferences,
          $setOnInsert: { userId, targetUserId },
        },
        { new: true, upsert: true }
      );

      return res.status(200).json({
        type: "success",
        message: "Notification preferences saved successfully",
        data,
      });
    } catch (error) {
      return handleError(error, res);
    }
  },
  FIND_ONE: async (req, res) => {
    try {
      const userId = req.user._id;
      const { targetUserId } = req.params;

      const data = await NOTIFICATION_PREFERENCES_MODEL.findOne({
        userId,
        targetUserId,
      });

      const normalizedResponse = {
        _id: data?._id || null,
        userId,
        targetUserId,
        preferences: {
          newVideo: data?.preferences?.newVideo ?? false,
          newPlaylist: data?.preferences?.newPlaylist ?? false,
        },
        createdAt: data?.createdAt || null,
        updatedAt: data?.updatedAt || null,
      };

      return res.status(200).json({
        type: "success",
        message: "Notification preferences retrieved successfully",
        data: normalizedResponse,
      });
    } catch (error) {
      return handleError(error, res);
    }
  },
};
