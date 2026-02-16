const express = require("express");
const {
  FIND_ALL_PLAYLISTS,
  UPDATE_PLAYLIST_BY_ID,
  DELETE_PLAYLIST_BY_ID,
  FIND_PLAYLIST_BY_ID,
} = require("./service");

const router = express.Router();

router
  .get("/", FIND_ALL_PLAYLISTS) // GET /playlists
  .get("/:id", FIND_PLAYLIST_BY_ID) // GET /playlists
  .patch("/:id", UPDATE_PLAYLIST_BY_ID) // PATCH /playlists/:id
  .delete("/:id", DELETE_PLAYLIST_BY_ID); // DELETE /playlists/:id

module.exports = router;
