const { COMMENT_MODEL } = require("../../models");
const handleError = require("../../utils/errorHandler");

const commentPopulateFields = {
  path: "userId",
  select: "name username profilePic",
};

module.exports = {
  GET_VIDEO_COMMENTS: async (req, res) => {
    try {
      const { videoId } = req.params;
      const { page = 1, limit = 20 } = req.query;
      const skip = (page - 1) * limit;

      const comments = await COMMENT_MODEL.find({
        videoId,
        isDeleted: false,
      })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate(commentPopulateFields);

      const total = await COMMENT_MODEL.countDocuments({
        videoId,
        isDeleted: false,
      });

      return res.status(200).json({
        data: comments,
        pagination: {
          total,
          page: Number(page),
          totalPages: Math.ceil(total / limit),
          hasMore: skip + comments.length < total,
        },
      });
    } catch (error) {
      return handleError(error, res);
    }
  },

  ADD_COMMENT: async (req, res) => {
    try {
      const { videoId } = req.params;
      const { text } = req.body;
      const user = req.user;

      const comment = await COMMENT_MODEL.create({
        videoId,
        userId: user._id,
        text,
      });

      await comment.populate(commentPopulateFields);

      return res.status(201).json({
        message: "Comment added successfully",
        data: comment,
      });
    } catch (error) {
      console.error(error);

      return handleError(error, res);
    }
  },

  DELETE_COMMENT: async (req, res) => {
    try {
      const { commentId } = req.params;
      const user = req.user;

      const comment = await COMMENT_MODEL.findOne({
        _id: commentId,
        userId: user._id,
      });

      if (!comment) {
        return res.status(404).json({
          status: "error",
          message: "Comment not found",
        });
      }

      comment.isDeleted = true;
      await comment.save();

      return res.status(200).json({
        message: "Comment deleted successfully",
      });
    } catch (error) {
      return handleError(error, res);
    }
  },

  LIKE_UNLIKE_COMMENT: async (req, res) => {
    try {
      const { commentId } = req.params;
      const user = req.user;

      const comment = await COMMENT_MODEL.findById(commentId);

      if (!comment) {
        return res.status(404).json({
          status: "error",
          message: "Comment not found",
        });
      }

      const likeIndex = comment.likes.indexOf(user._id);
      if (likeIndex > -1) {
        comment.likes.splice(likeIndex, 1);
        comment.likesCount--;
      } else {
        comment.likes.push(user._id);
        comment.likesCount++;
      }

      await comment.save();
      await comment.populate(commentPopulateFields);

      console.log("comment", comment);

      return res.status(200).json({
        message: "Comment likes updated successfully",
        data: comment,
      });
    } catch (error) {
      console.error(error);

      return handleError(error, res);
    }
  },
};
