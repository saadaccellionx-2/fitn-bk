const express = require("express");
const { FIND_ALL_FEEDBACKS, GET_FEEDBACK_BY_ID } = require("./service");

const router = express.Router();

router.get("/", FIND_ALL_FEEDBACKS); // GET /feedbacks
router.get("/:id", GET_FEEDBACK_BY_ID);

module.exports = router;
