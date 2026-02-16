const express = require("express");
const { protectRoutes } = require("../../middleware/verify");
const {
  CREATE,
  FIND_ONE,
  FIND_ONE_PUBLIC,
  FIND_ALL,
  UPDATE_BY_ID,
  DELETE_BY_ID,
  TOGGLE_VIDEO,
  TOGGLE_FOLLOW,
  pinUnpinPlaylist,
  UPDATE_SHARE_IMAGE,
} = require("./service");

const router = express.Router();

// Public route (must be before protected routes)
router.get("/public/:id", FIND_ONE_PUBLIC);

router
  .post("/", protectRoutes, CREATE)
  .get("/", protectRoutes, FIND_ALL)
  .get("/:id", protectRoutes, FIND_ONE)
  .patch("/pinUnpinPlaylist/:id", protectRoutes, pinUnpinPlaylist)
  .patch("/:id", protectRoutes, UPDATE_BY_ID)
  .patch("/share/:id", protectRoutes, UPDATE_SHARE_IMAGE)
  .delete("/:id", protectRoutes, DELETE_BY_ID)
  .post("/addRemoveVideo", protectRoutes, TOGGLE_VIDEO)
  .post("/followUnfollow", protectRoutes, TOGGLE_FOLLOW);

module.exports = router;
