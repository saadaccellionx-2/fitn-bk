const mongoose = require("mongoose");
const {
  COMMENT_MODEL,
  COMMENT_REPORT_MODEL,
  USER_MODEL,
} = require("../../../models");
const handleError = require("../../../utils/errorHandler");
const parseFilter = require("../../../utils/parseFilter");

module.exports = {
  DELETE_COMMENT: async (req, res) => {
    try {
      const commentId = req.params.id;

      if (!commentId || !mongoose.Types.ObjectId.isValid(commentId)) {
        return res.status(400).json({
          status: "error",
          message: "Valid Comment ID is required.",
        });
      }

      const comment = await COMMENT_MODEL.findById(commentId);
      if (!comment) {
        return res.status(404).json({
          status: "error",
          message: "Comment not found.",
        });
      }

      comment.isDeleted = true;
      await comment.save();

      return res.status(200).json({
        status: "success",
        message: "Comment has been soft deleted.",
      });
    } catch (error) {
      return handleError(error, res);
    }
  },

  FIND_ALL_reported_comments: async (req, res) => {
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
        query.$and = query.$and || [];
        query.$and.push({
          $or: [
            { "report.reason": { $regex: search, $options: "i" } },
            { "report.detail": { $regex: search, $options: "i" } },
          ],
        });
      }

      const totalItems = await COMMENT_REPORT_MODEL.countDocuments(query);

      const reportedComments = await COMMENT_REPORT_MODEL.find(query)
        .sort(sortBy === "newest" ? { createdAt: -1 } : { createdAt: 1 })
        .skip((pageNum - 1) * perPage)
        .limit(Number(perPage))
        .populate({
          path: "comment",
          populate: {
            path: "userId",
            select: "name email profilePic",
          },
        })
        .populate({
          path: "user", // reporter
          select: "name email profilePic",
        });

      const userIds = reportedComments.map((report) => report.user._id);
      const commenterIds = reportedComments
        .map((r) => r.comment?.user?._id)
        .filter(Boolean);

      // Aggregated report counts
      const [userReportCounts, commenterReportCounts] = await Promise.all([
        COMMENT_REPORT_MODEL.aggregate([
          { $match: { user: { $in: userIds } } },
          { $group: { _id: "$user", reportCount: { $sum: 1 } } },
        ]),
        COMMENT_REPORT_MODEL.aggregate([
          {
            $lookup: {
              from: "comments",
              localField: "comment",
              foreignField: "_id",
              as: "commentData",
            },
          },
          { $unwind: "$commentData" },
          { $group: { _id: "$commentData.user", reportCount: { $sum: 1 } } },
        ]),
      ]);

      const userReportMap = new Map(
        userReportCounts.map((item) => [
          item._id ? item._id.toString() : "unknown",
          item.reportCount,
        ])
      );
      const commenterReportMap = new Map(
        commenterReportCounts.map((item) => [
          item._id ? item._id.toString() : "unknown",
          item.reportCount,
        ])
      );

      // Batch fetch comment owners
      const uniqueCommentOwnerIds = [...new Set(commenterIds.map(String))];
      const commentOwnerUsers = await USER_MODEL.find(
        { _id: { $in: uniqueCommentOwnerIds } },
        "name email profilePic"
      );
      const commentOwnerMap = new Map(
        commentOwnerUsers.map((user) => [user._id.toString(), user])
      );

      const enrichedReportedComments = reportedComments.map((report) => {
        const userReportCount =
          userReportMap.get(report.user._id.toString()) || 0;

        const commentOwnerId = report.comment?.user?._id?.toString();
        const commenterReportCount =
          (commentOwnerId && commenterReportMap.get(commentOwnerId)) || 0;

        const commentOwnerData =
          (commentOwnerId && commentOwnerMap.get(commentOwnerId)) || null;

        return {
          ...report.toObject(),
          userReportCount,
          commenterReportCount,
          commentOwner: commentOwnerData,
        };
      });

      const totalPages = Math.ceil(totalItems / perPage);

      return res.json({
        status: "success",
        data: enrichedReportedComments,
        pagination: {
          pageNum: Number(pageNum),
          perPage: Number(perPage),
          totalItems,
          totalPages,
          hasNextPage: pageNum < totalPages,
          hasPrevPage: pageNum > 1,
        },
      });
    } catch (error) {
      return handleError(error, res);
    }
  },

  GET_BY_ID_reported_comment: async (req, res) => {
    try {
      const reportId = req.params.id;

      if (!mongoose.Types.ObjectId.isValid(reportId)) {
        return res.status(400).json({
          status: "error",
          message: "Invalid report ID.",
        });
      }

      const commentReport = await COMMENT_REPORT_MODEL.findById(reportId)
        .populate({
          path: "comment",
          populate: {
            path: "userId",
            select: "name email profilePic",
          },
        })
        .populate({
          path: "user",
          select: "name email profilePic",
        });

      if (!commentReport) {
        return res.status(404).json({
          status: "error",
          message: "Comment report not found",
        });
      }

      const [userReportCountAgg, commenterReportCountAgg] = await Promise.all([
        COMMENT_REPORT_MODEL.aggregate([
          { $match: { user: commentReport.user._id } },
          { $group: { _id: "$user", reportCount: { $sum: 1 } } },
        ]),
        COMMENT_REPORT_MODEL.aggregate([
          {
            $lookup: {
              from: "comments",
              localField: "comment",
              foreignField: "_id",
              as: "commentData",
            },
          },
          { $unwind: "$commentData" },
          {
            $match: {
              "commentData.user": commentReport.comment?.user?._id,
            },
          },
          {
            $group: {
              _id: "$commentData.user",
              reportCount: { $sum: 1 },
            },
          },
        ]),
      ]);

      const userReportCount =
        userReportCountAgg.length > 0 ? userReportCountAgg[0].reportCount : 0;
      const commenterReportCount =
        commenterReportCountAgg.length > 0
          ? commenterReportCountAgg[0].reportCount
          : 0;

      const commentOwnerId = commentReport.comment?.user?._id?.toString();

      const commentOwnerData = commentOwnerId
        ? await USER_MODEL.findById(commentOwnerId, "name email profilePic")
        : null;

      return res.status(200).json({
        status: "success",
        message: "Comment report retrieved successfully",
        data: {
          ...commentReport.toObject(),
          userReportCount,
          commenterReportCount,
          commentOwner: commentOwnerData,
        },
      });
    } catch (error) {
      return handleError(error, res);
    }
  },

  DELETE_reported_comment: async (req, res) => {
    try {
      const { id } = req.params;

      if (!id || !mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          status: "error",
          message: "Valid report comment ID is required",
        });
      }

      const reportedComment = await COMMENT_REPORT_MODEL.findById(id);

      if (!reportedComment) {
        return res.status(404).json({
          status: "error",
          message: "Reported comment not found",
        });
      }

      await COMMENT_REPORT_MODEL.deleteOne({ _id: id });

      return res.status(200).json({
        status: "success",
        message: "Reported comment deleted successfully",
      });
    } catch (error) {
      return handleError(error, res);
    }
  },
};
