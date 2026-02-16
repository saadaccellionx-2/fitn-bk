const mongoose = require("mongoose");
const {
  USER_MODEL: Users,
  VIDEO_MODEL: Videos,
  PLAYLIST_MODEL: Playlists,
} = require("../models");

async function cleanUserReferences() {
  try {
    console.log("Starting to clean user references...");

    // Get list of existing user IDs
    const existingUserIds = await Users.distinct("_id");
    console.log(`Found ${existingUserIds.length} valid users.`);

    // Get list of existing playlist IDs
    const existingPlaylistIds = await Playlists.distinct("_id");
    console.log(`Found ${existingPlaylistIds.length} valid playlists.`);

    // Clean followers references
    const followersResult = await Users.updateMany(
      {},
      { $pull: { followers: { $nin: existingUserIds } } }
    );
    console.log(
      `Cleaned followers references: ${followersResult.modifiedCount} users updated.`
    );

    // Clean following references
    const followingResult = await Users.updateMany(
      {},
      { $pull: { following: { $nin: existingUserIds } } }
    );
    console.log(
      `Cleaned following references: ${followingResult.modifiedCount} users updated.`
    );

    // Clean followingPlayLists references
    const playlistsResult = await Users.updateMany(
      {},
      { $pull: { followingPlayLists: { $nin: existingPlaylistIds } } }
    );
    console.log(
      `Cleaned followingPlayLists references: ${playlistsResult.modifiedCount} users updated.`
    );

    // Clean blockedUsers references
    const blockedResult = await Users.updateMany(
      {},
      { $pull: { blockedUsers: { $nin: existingUserIds } } }
    );
    console.log(
      `Cleaned blockedUsers references: ${blockedResult.modifiedCount} users updated.`
    );

    // Also clean the playlist videos as shown in your original example
    const playlistVideosResult = await Playlists.updateMany(
      {},
      { $pull: { videos: { $nin: await Videos.distinct("_id") } } }
    );
    console.log(
      `Cleaned playlist video references: ${playlistVideosResult.modifiedCount} playlists updated.`
    );

    console.log("All reference cleanup operations completed successfully.");

    return {
      followersUpdated: followersResult.modifiedCount,
      followingUpdated: followingResult.modifiedCount,
      playlistsUpdated: playlistsResult.modifiedCount,
      blockedUsersUpdated: blockedResult.modifiedCount,
      playlistVideosUpdated: playlistVideosResult.modifiedCount,
    };
  } catch (error) {
    console.error("Error cleaning user references:", error);
    throw error;
  }
}

module.exports = cleanUserReferences;
