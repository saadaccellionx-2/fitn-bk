const { COMMENT_REPORT_MODEL, ADMIN_NOTIFICATION } = require("../../models");
const handleError = require("../../utils/errorHandler");

module.exports = {
  // Create a new comment report
  CREATE: async (req, res) => {
    try {
      const user = req.user;
      const commentReportData = {
        user: req.user._id,
        comment: req.body.video,
        report: req.body.report,
      };

      console.log(commentReportData);

      const data = await COMMENT_REPORT_MODEL.create(commentReportData);

      // Create an admin notification
      await ADMIN_NOTIFICATION.create({
        title: "New Comment Report Submitted",
        body: `User ${user.name || user.email} has reported a comment.`,
        type: "comment_reports",
        relatedItem: data._id,
      });

      return res.status(201).json({
        type: "success",
        message: "Comment reported successfully",
        data,
      });
    } catch (error) {
      console.error(error);
      return handleError(error, res);
    }
  },

  // Get all comment reports
  FIND_ALL: async (req, res) => {
    try {
      const { perPage = 10, pageNo = 1 } = req.query;
      const skip = (parseInt(pageNo) - 1) * parseInt(perPage);

      const commentReports = await COMMENT_REPORT_MODEL.find()
        .populate("user", "name profilePic")
        .populate("comment", "text")
        .skip(skip)
        .limit(parseInt(perPage))
        .sort({ createdAt: -1 });

      if (!commentReports.length) {
        return res.status(404).json({
          status: "error",
          message: "No comment reports found",
        });
      }

      const total = await COMMENT_REPORT_MODEL.countDocuments();

      return res.status(200).json({
        type: "success",
        message: "Comment reports retrieved successfully",
        data: commentReports,
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

  // Update a specific comment report
  UPDATE_BY_ID: async (req, res) => {
    try {
      const commentReport = await COMMENT_REPORT_MODEL.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true }
      );

      if (!commentReport) {
        return res.status(404).json({
          status: "error",
          message: "Comment report not found",
        });
      }

      return res.status(200).json({
        type: "success",
        message: "Comment report updated successfully",
        data: commentReport,
      });
    } catch (error) {
      return handleError(error, res);
    }
  },

  // Delete a comment report
  DELETE_BY_ID: async (req, res) => {
    try {
      const commentReport = await COMMENT_REPORT_MODEL.findByIdAndDelete(
        req.params.id
      );

      if (!commentReport) {
        return res.status(404).json({
          status: "error",
          message: "Comment report not found",
        });
      }

      return res.status(200).json({
        type: "success",
        message: "Comment report deleted successfully",
      });
    } catch (error) {
      return handleError(error, res);
    }
  },
};
