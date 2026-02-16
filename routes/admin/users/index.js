const express = require("express");
const {
  DELETE_USER_BY_ID,
  UPDATE_USER_BY_ID,
  FIND_ALL_USERS,
  FIND_USER_BY_ID,
  FIND_AGE_AND_GENDER_STATS,
  UPDATE_USER_STATUS_BY_ID,
  FIND_USER_FOLLOW_DATA,
  REQUEST_PASSWORD_RESET_FOR_USER,
} = require("./service");

const router = express.Router();

router
  .get("/", FIND_ALL_USERS) // GET /users
  .get("/age-and-gender", FIND_AGE_AND_GENDER_STATS)
  .get("/:id", FIND_USER_BY_ID) // GET /users/influencers
  .get("/followers/:id", FIND_USER_FOLLOW_DATA) 
  .post("/:id/reset-password", REQUEST_PASSWORD_RESET_FOR_USER) // POST /users/:id/reset-password
  .patch("/:id", UPDATE_USER_BY_ID) // PATCH /users/:id
  .patch("/status/:id", UPDATE_USER_STATUS_BY_ID) // PATCH /users/:id
  .delete("/:id", DELETE_USER_BY_ID); // DELETE /users/:id

module.exports = router;
