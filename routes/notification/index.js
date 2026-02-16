var express = require("express");
const {
  CREATE,
  FIND_ALL,
  UPDATE_BY_ID,
  DELETE_BY_ID,
  UNREAD_COUNT,
} = require("./service");
const { protectRoutes } = require("../../middleware/verify");
var router = express.Router();

router
  .post("/", protectRoutes, CREATE)
  .get("/", protectRoutes, FIND_ALL)
  .get("/unreadCount", protectRoutes, UNREAD_COUNT)

  .put("/:id", protectRoutes, UPDATE_BY_ID)
  .delete("/:id", protectRoutes, DELETE_BY_ID);

module.exports = router;
