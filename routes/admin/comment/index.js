const express = require("express");
const { DELETE_COMMENT, FIND_ALL_reported_comments, GET_BY_ID_reported_comment, DELETE_reported_comment } = require("./service");

const router = express.Router();

router.get("/reported", FIND_ALL_reported_comments);
router.get("/reported/:id", GET_BY_ID_reported_comment);
router.delete("/reported/:id", DELETE_reported_comment);
router.delete("/:id", DELETE_COMMENT);

module.exports = router;
