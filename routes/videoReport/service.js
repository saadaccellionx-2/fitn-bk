const { VIDEO_REPORT_MODEL, ADMIN_NOTIFICATION } = require("../../models");
const handleError = require("../../utils/errorHandler");

module.exports = {
  CREATE: async (req, res) => {
    try {
      const user = req.user;
      const videoReportData = {
        user: req.user._id,
        video: req.body.video,
        report: req.body.report,
      };

      console.log(videoReportData);

      const data = await VIDEO_REPORT_MODEL.create(videoReportData);

      await ADMIN_NOTIFICATION.create({
        title: "New Video Report Submitted",
        body: `User ${user.name || user.email} has reported a video.`,
        type: "video_reports",
        relatedItem: data._id,
      });

      return res.status(201).json({
        type: "success",
        message: "Video reported successfully",
        data,
      });
    } catch (error) {
      console.error(error);

      return handleError(error, res);
    }
  },

  FIND_ALL: async (req, res) => {
    try {
      const { perPage = 10, pageNo = 1 } = req.query;
      const skip = (parseInt(pageNo) - 1) * parseInt(perPage);

      const videoReports = await VIDEO_REPORT_MODEL.find()
        .populate("user", "name profilePic")
        .populate("video", "title thumbnail")
        .skip(skip)
        .limit(parseInt(perPage))
        .sort({ createdAt: -1 });

      if (!videoReports.length) {
        return res.status(404).json({
          status: "error",
          message: "No video reports found",
        });
      }

      // Get total count for pagination
      const total = await VIDEO_REPORT_MODEL.countDocuments();

      return res.status(200).json({
        type: "success",
        message: "Video reports retrieved successfully",
        data: videoReports,
        pagination: {
          total,
          currentPage: parseInt(pageNo),
          perPage: parseInt(perPage),
          totalPages: Math.ceil(total / parseInt(perPage)),
        },
      });
    } catch (error) {
      return handleError(error, res);
    }
  },

  UPDATE_BY_ID: async (req, res) => {
    try {
      const videoReport = await VIDEO_REPORT_MODEL.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true }
      );

      if (!videoReport) {
        return res.status(404).json({
          status: "error",
          message: "Video report not found",
        });
      }

      return res.status(200).json({
        type: "success",
        message: "Video report updated successfully",
        data: videoReport,
      });
    } catch (error) {
      return handleError(error, res);
    }
  },

  DELETE_BY_ID: async (req, res) => {
    try {
      const videoReport = await VIDEO_REPORT_MODEL.findByIdAndDelete(
        req.params.id
      );

      if (!videoReport) {
        return res.status(404).json({
          status: "error",
          message: "Video report not found",
        });
      }

      return res.status(200).json({
        type: "success",
        message: "Video report deleted successfully",
      });
    } catch (error) {
      return handleError(error, res);
    }
  },
};
