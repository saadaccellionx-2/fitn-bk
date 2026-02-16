const express = require("express");
const {
  FIND_ALL_SPONSOR,
  CREATE_SPONSOR,
  FIND_ONE_SPONSOR,
  UPDATE_BY_ID_SPONSOR,
  DELETE_BY_ID_SPONSOR,
  FOLLOW_UNFOLLOW_SPONSOR,
  GET_SPONSOR_ANALYTICS,
} = require("./service");

const router = express.Router();

router
  .get("/", FIND_ALL_SPONSOR) // GET /sponsors
  .post("/", CREATE_SPONSOR) // POST /sponsors

  .get("/sponsors-analytics/:sponsorId", GET_SPONSOR_ANALYTICS)
  .get("/:id", FIND_ONE_SPONSOR) // GET /sponsors/:id

  .put("/:id", UPDATE_BY_ID_SPONSOR) // PUT /sponsors/:id
  .delete("/:id", DELETE_BY_ID_SPONSOR) // DELETE /sponsors/:id
  .patch("/follow_unfollow/:targetId", FOLLOW_UNFOLLOW_SPONSOR); // PATCH /sponsors/follow_unfollow/:targetId

module.exports = router;
