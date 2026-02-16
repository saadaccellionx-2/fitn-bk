const express = require("express");
const { protectRoutes } = require("../../middleware/verify");

const {
  CREATE,
  LOGIN,
  FIND_ONE,
  FIND_ALL,
  UPDATE_BY_ID,
  DELETE_BY_ID,
  SEND_CODE,
  VERIFY_CODE,
  VERIFY_CODE_AND_SIGNUP,
  COMPLETE_SIGNUP,
  FOLLOW_UNFOLLOW,
  FIND_ALL_FEATURED,
  SEARCH_FEATURED_USERS,
  GET_LOGED_USER,
  BLOCK_UNBLOCK,
  BLOCKED_USERS_LIST,
  FOLLOW_UNFOLLOW_PLAYLIST,
  RESET_PASSWORD_UPDATE,
  GET_SOCIAL_CONNECTIONS,
  GET_USER_TABS_STATS,
  VERIFY_CREDENTIALS,
  CHECK_USERNAME,
  CHECK_EMAIL,
  TRACK_SPONSOR_STATS,
  TRACK_VIDEO_ANALYTICS,
  INCREMENT_APP_OPEN,
  FIND_ALL_FEATURED_PLAYLISTS,
  FIND_TAG_INFLUENCERS,
  FIND_BY_CONNECTYCUBE_ID,
  UPDATE_APP_STATE,
  REFRESH_TOKEN,
  LOGOUT,
} = require("./service");

const router = express.Router();

router
  .post("/signup", CREATE)
  .post("/signup/verify-code", VERIFY_CODE_AND_SIGNUP)
  .post("/signup/complete", protectRoutes, COMPLETE_SIGNUP)
  .post("/login", LOGIN)
  .post("/logout", protectRoutes, LOGOUT)
  .post("/refresh", REFRESH_TOKEN)
  .post("/sendCode", SEND_CODE)
  .post("/verifyCode", VERIFY_CODE)
  .post("/resetPassword", RESET_PASSWORD_UPDATE)
  .post("/sponsor/track", TRACK_SPONSOR_STATS)
  .post("/video/track", TRACK_VIDEO_ANALYTICS)
  .post("/app-open",protectRoutes, INCREMENT_APP_OPEN)
  .post("/app-state",protectRoutes, UPDATE_APP_STATE)
  .get("/featured-playlists", FIND_ALL_FEATURED_PLAYLISTS)
  .get("/block_unblock_user/:userId", protectRoutes, BLOCK_UNBLOCK)
  .post("/verify-credentials", VERIFY_CREDENTIALS)
  .get("/blockedUsersList", protectRoutes, BLOCKED_USERS_LIST)
  .get("/currentUser", protectRoutes, GET_LOGED_USER)
  .get("/", protectRoutes, FIND_ALL)
  .get("/influencers", protectRoutes, FIND_TAG_INFLUENCERS)
  .get("/check-username", CHECK_USERNAME)
  .get("/check-email", CHECK_EMAIL)
  .get("/featured", protectRoutes, FIND_ALL_FEATURED)
  .get("/searchfeatured/:name", protectRoutes, SEARCH_FEATURED_USERS)
  .get(
    "/follow_unfollow_playlist/:playListId",
    protectRoutes,
    FOLLOW_UNFOLLOW_PLAYLIST
  )
  .get("/connectycube/:connectyCubeId", FIND_BY_CONNECTYCUBE_ID)
  .delete("/:id", DELETE_BY_ID)
  .patch("/follow_unfollow/:userId", protectRoutes, FOLLOW_UNFOLLOW)
  .get("/connections/:userId/:type", protectRoutes, GET_SOCIAL_CONNECTIONS)
  .get("/tabstats/:id", protectRoutes, GET_USER_TABS_STATS)
  .get("/:id", protectRoutes, FIND_ONE)
  .patch("/:id", UPDATE_BY_ID);

module.exports = router;
