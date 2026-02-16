const express = require("express");
const {
  FIND_ALL_NOTIFICATIONS,
  GET_NOTIFICATION_BY_ID,
  MARK_NOTIFICATION_AS_READ,
  MARK_ALL_NOTIFICATIONS_AS_READ,
  DELETE_NOTIFICATION_BY_ID,
  DELETE_ALL_NOTIFICATIONS,
  DELETE_BULK_NOTIFICATIONS,
} = require("./service");
const router = express.Router();

router
  .get("/", FIND_ALL_NOTIFICATIONS) // GET /admin-notifications
  .get("/:id", GET_NOTIFICATION_BY_ID) // GET /admin-notifications/:id
  .patch("/read/:id", MARK_NOTIFICATION_AS_READ) // PATCH /admin-notifications/read/:id
  .patch("/read-all", MARK_ALL_NOTIFICATIONS_AS_READ) // PATCH /admin-notifications/read-all
  .delete("/:id", DELETE_NOTIFICATION_BY_ID) // DELETE /admin-notifications/:id
  .post("/bulk-delete", DELETE_BULK_NOTIFICATIONS) // POST /admin-notifications/bulk-delete
  .delete("/", DELETE_ALL_NOTIFICATIONS); // DELETE /admin-notifications

module.exports = router;
