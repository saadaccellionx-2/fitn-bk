const express = require("express");
const { CREATE, FIND_ALL, UPDATE_BY_ID, DELETE_BY_ID } = require("./service");
const { protectRoutes } = require("../../middleware/verify");
const router = express.Router();

router
  .post("/",  CREATE)

module.exports = router;
