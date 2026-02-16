const { BUG_REPORT_MODEL, USER_MODEL } = require("../../../models");
const handleError = require("../../../utils/errorHandler");
const parseFilter = require("../../../utils/parseFilter");

module.exports = {
  GET_BUG_REPORT: async (req, res) => {
    try {
      const {
        pageNum = 1,
        perPage = 10,
        search = "",
        sortBy = "newest",
      } = req.query;

      const filter = parseFilter(req.query.filter, res);
      if (filter === null) return;

      const query = { ...filter };

      if (search) {
        // Find user IDs matching search term
        const matchingUsers = await USER_MODEL.find({
          name: { $regex: search, $options: "i" },
        }).select("_id");

        const userIds = matchingUsers.map((u) => u._id);

        query.$or = [
          { title: { $regex: search, $options: "i" } },
          { description: { $regex: search, $options: "i" } },
          { reportedBy: { $in: userIds } },
        ];
      }

      const totalItems = await BUG_REPORT_MODEL.countDocuments(query);
      const bugReports = await BUG_REPORT_MODEL.find(query)
        .sort(sortBy === "newest" ? { createdAt: -1 } : { createdAt: 1 })
        .skip((pageNum - 1) * perPage)
        .limit(Number(perPage))
        .populate("reportedBy", ["name", "email", "profilePic"]);

      return res.json({
        data: bugReports,
        pagination: {
          pageNum: Number(pageNum),
          perPage: Number(perPage),
          totalItems,
        },
      });
    } catch (error) {
      return handleError(error, res);
    }
  },

  UPDATE_BUG_REPORT: async (req, res) => {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const bugReport = await BUG_REPORT_MODEL.findOneAndUpdate(
        { _id: id },
        updateData,
        { new: true }
      ).populate("reportedBy", ["name", "email", "profilePic"]);

      if (!bugReport) {
        return res.status(404).json({
          status: "error",
          message: "Bug report not found",
        });
      }

      return res.status(200).json({
        message: "Bug report updated successfully",
        data: bugReport,
      });
    } catch (error) {
      return handleError(error, res);
    }
  },

  DELETE_BUG_REPORT: async (req, res) => {
    try {
      const { id } = req.params;

      const bugReport = await BUG_REPORT_MODEL.findByIdAndDelete(id);

      if (!bugReport) {
        return res.status(404).json({
          status: "error",
          message: "Bug report not found",
        });
      }

      return res.status(200).json({
        message: "Bug report deleted successfully",
      });
    } catch (error) {
      return handleError(error, res);
    }
  },
};