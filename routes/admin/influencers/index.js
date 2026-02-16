const express = require("express");
const { FIND_ALL_INFLUENCERS } = require("./service");

const router = express.Router();

router.get("/", FIND_ALL_INFLUENCERS); // GET /users

module.exports = router;
