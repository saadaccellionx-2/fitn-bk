const express = require("express");
const {
  ADD_COMMENT,
  DELETE_COMMENT,
  LIKE_UNLIKE_COMMENT,
  GET_VIDEO_COMMENTS,
} = require("./service");
const { protectRoutes } = require("../../middleware/verify");

const router = express.Router();

router
  .get("/video/:videoId", protectRoutes, GET_VIDEO_COMMENTS)
  .post("/video/:videoId", protectRoutes, ADD_COMMENT)
  .delete("/:commentId", protectRoutes, DELETE_COMMENT)
  .patch("/:commentId/like", protectRoutes, LIKE_UNLIKE_COMMENT);

module.exports = router;
