const { BUG_REPORT_MODEL, USER_MODEL, DOT_NOTIFICATION_MODEL } = require("../../models");
const handleError = require("../../utils/errorHandler");

module.exports = {
  CREATE_BUG_REPORT: async (req, res) => {
    try {
      const user = req.user;
      const { title, description = "", mediaUrls = [] } = req.body;

      if (!title) {
        return res.status(400).json({
          success: false,
          message: "Title is required",
        });
      }

      if (!user || !user._id) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      const bugReport = await BUG_REPORT_MODEL.create({
        reportedBy: user._id,
        title,
        description,
        mediaUrls,
        status: "not_resolved",
      });

      // Create dot notification for bug report
      await DOT_NOTIFICATION_MODEL.create({
        type: "bug_report",
        bugReport: bugReport._id,
        createdBy: user._id,
      });

      return res.status(201).json({
        success: true,
        message: "Bug report created successfully",
        data: bugReport,
      });
    } catch (error) {
      return handleError(error, res);
    }
  },
};
