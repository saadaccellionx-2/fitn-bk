const express = require("express");
const { GET_BUG_REPORT, UPDATE_BUG_REPORT, DELETE_BUG_REPORT } = require("./service");

const router = express.Router();

router.get("/", GET_BUG_REPORT);
router.patch("/:id", UPDATE_BUG_REPORT);
router.delete("/:id", DELETE_BUG_REPORT);

module.exports = router;