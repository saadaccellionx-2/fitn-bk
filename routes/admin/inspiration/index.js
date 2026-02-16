const express = require("express");
const {
  GET_INSPIRATION_CONFIG,
  GET_UNIQUE_TAGS_WITH_COUNTS,
  GET_INFLUENCERS_WITH_PLAYLIST_COUNTS,
  UPDATE_TAG_SELECTION,
  UPDATE_INFLUENCER_SELECTION,
  GET_TAG_VIDEOS,
  GET_INFLUENCER_PLAYLISTS,
  TOGGLE_VIDEO_FEATURED,
  TOGGLE_PLAYLIST_FEATURED,
} = require("./service");

const router = express.Router();

router
  .get("/config", GET_INSPIRATION_CONFIG)
  .get("/tags", GET_UNIQUE_TAGS_WITH_COUNTS)
  .get("/influencers", GET_INFLUENCERS_WITH_PLAYLIST_COUNTS)
  .patch("/tag", UPDATE_TAG_SELECTION)
  .patch("/influencer", UPDATE_INFLUENCER_SELECTION)
  .get("/tag-videos", GET_TAG_VIDEOS)
  .get("/influencer-playlists", GET_INFLUENCER_PLAYLISTS)
  .patch("/video/:id/toggle-featured", TOGGLE_VIDEO_FEATURED)
  .patch("/playlist/:id/toggle-featured", TOGGLE_PLAYLIST_FEATURED);

module.exports = router;

