const express = require("express");
const {
  LOGIN_ADMIN,
  CREATE_ADMIN,
  GET_ADMIN_PROFILE,
  UPDATE_ADMIN,
  REFRESH_TOKEN,
  LOGOUT_ADMIN,
} = require("./service");
const { verifyAdmin } = require("../../../middleware/verify");

const router = express.Router();

router
  .post("/create", CREATE_ADMIN) // POST /auth/create
  .post("/login", LOGIN_ADMIN)
  .post("/refresh", REFRESH_TOKEN) // POST /auth/refresh
  .post("/logout", verifyAdmin, LOGOUT_ADMIN) // POST /auth/logout
  .get("/getProfile", verifyAdmin, GET_ADMIN_PROFILE) // GET /auth/getProfile
  .put("/update", verifyAdmin, UPDATE_ADMIN); // PUT /auth/update

module.exports = router;
