const express = require("express");
const { setResponse } = require("../../helpers/response.helper");
const { protectRoutes, adminOnly } = require("../../middleware/verify");
const {
  FIND_ONE,
  FIND_ALL,
  UPDATE_BY_ID,
  DELETE_BY_ID,
  ADD_REMOVE_LIKE,
  ADD_COMMENT,
  CREATE_VIDEO,
  FIND_ALL_FEATURED,
  GET_USER_VIDEOS,
  CREATE_VIDEO_SPONSORED,
  pinUnpinVideo,
  pinUnpinVideoInPlaylist,
} = require("./service");

const router = express.Router();

// Base routes
router
  .get("/", protectRoutes, FIND_ALL)
  .post("/", protectRoutes, CREATE_VIDEO)
  .post("/sponsored", CREATE_VIDEO_SPONSORED)

  .get("/getUserVideos/:id", protectRoutes, GET_USER_VIDEOS)
  .get("/featured", FIND_ALL_FEATURED)
  .patch("/addRemoveLike/:id", protectRoutes, ADD_REMOVE_LIKE)
  .patch("/addComment/:id", protectRoutes, ADD_COMMENT)
  .patch("/pinUnpinVideos/:id", protectRoutes, pinUnpinVideo)
  .patch(
    "/pinUnpinInPlaylist/:playlistId/:videoId",
    protectRoutes,
    pinUnpinVideoInPlaylist
  )
  .get("/:id", protectRoutes, FIND_ONE)
  .patch("/:id", protectRoutes, UPDATE_BY_ID)
  .delete("/:id", protectRoutes, DELETE_BY_ID);

module.exports = router;
