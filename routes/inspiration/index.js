const express = require("express");
const { GET_INSPIRATION } = require("./service");
const { protectRoutes } = require("../../middleware/verify");

const router = express.Router();

router.get("/", protectRoutes, GET_INSPIRATION);

module.exports = router;
