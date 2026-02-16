const express = require("express");
const { CREATE_BUG_REPORT } = require("./service");
const { protectRoutes } = require("../../middleware/verify");

const router = express.Router();

router.post("/", protectRoutes, CREATE_BUG_REPORT);

module.exports = router;
