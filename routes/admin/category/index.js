const express = require("express");
const {
  FIND_ALL_CATEGORY,
  CREATE_CATEGORY,
  FIND_ONE_CATEGORY,
  UPDATE_BY_ID_CATEGORY,
  DELETE_BY_ID_CATEGORY,
} = require("./service");

const router = express.Router();

router
  .get("/", FIND_ALL_CATEGORY) // GET /categories
  .post("/", CREATE_CATEGORY) // POST /categories
  .get("/:id", FIND_ONE_CATEGORY) // GET /categories/:id
  .put("/:id", UPDATE_BY_ID_CATEGORY) // PUT /categories/:id
  .delete("/:id", DELETE_BY_ID_CATEGORY); // DELETE /categories/:id

module.exports = router;
