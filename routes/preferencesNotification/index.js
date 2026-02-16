var express = require("express");
const { CREATE_OR_UPDATE, FIND_ONE } = require("./service");
const { protectRoutes } = require("../../middleware/verify");

var router = express.Router();

router
  .post("/", protectRoutes, CREATE_OR_UPDATE)
  .get("/:targetUserId", protectRoutes, FIND_ONE);

module.exports = router;
