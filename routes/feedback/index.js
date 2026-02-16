var express = require("express");
const { CREATE, FIND_ALL } = require("./service");
const { protectRoutes } = require("../../middleware/verify");
var router = express.Router();

router.post("/", protectRoutes, CREATE).get("/", FIND_ALL);

module.exports = router;
