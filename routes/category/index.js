const express = require("express");
const {
  CREATE,
  FIND_ONE,
  FIND_ALL,
  UPDATE_BY_ID,
  DELETE_BY_ID,
} = require("./service");

const router = express.Router();

router
  .post("/", CREATE)
  .get("/", FIND_ALL)
  .get("/:id", FIND_ONE)
  .patch("/:id", UPDATE_BY_ID)
  .delete("/:id", DELETE_BY_ID);

module.exports = router;
