const express = require("express");
const {
  FIND_ALL_VIDEOS,
  FIND_ALL_reported_videos,
  GET_VIDEO_GRAPH_DATA,
  UPDATE_VIDEO_BY_ID,
  DELETE_VIDEO_BY_ID,
  GET_USER_VIDEO_ANALYTICS,
  FIND_VIDEOS_BY_USER,
  DELETE_reported_video,
  GET_NOTIFICATIONS,
  MARK_ALL_AS_READ,
  GET_VIDEO_BY_ID,
  GET_BY_ID,
} = require("./service");

const router = express.Router();

router
  .get("/", FIND_ALL_VIDEOS) // GET /videos
  .get("/reported", FIND_ALL_reported_videos) // GET /videos/report
  .get("/reported/:id", GET_BY_ID)
  .get("/user/:userId", FIND_VIDEOS_BY_USER)
  .get("/notifications", GET_NOTIFICATIONS)
  .get("/video_analytics/:id", GET_USER_VIDEO_ANALYTICS)
  .get("/graph", GET_VIDEO_GRAPH_DATA) // GET /videos/graph
  .get("/:id", GET_VIDEO_BY_ID)
  .patch("/:id", UPDATE_VIDEO_BY_ID) // PATCH /videos/:id
  .patch("/notifications/read-all", MARK_ALL_AS_READ)
  .delete("/reported/:id", DELETE_reported_video)
  .delete("/:id", DELETE_VIDEO_BY_ID); // DELETE /videos/:id

module.exports = router;
