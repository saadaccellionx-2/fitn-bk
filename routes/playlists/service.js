const { default: mongoose } = require("mongoose");
const {
  PLAYLIST_MODEL,
  USER_MODEL,
  VIDEO_MODEL,
  ADMIN_NOTIFICATION,
  NOTIFICATION_PREFERENCES_MODEL,
} = require("../../models");
const handleError = require("../../utils/errorHandler");
const cleanUserReferences = require("../../helpers/cleanUserReferences");
const notificationQueue = require("../../queue/notificationQueue");

const addCloudFrontUrlToPlaylists = (playlists) => {
  const cloudFrontUrl = process.env.CLOUD_FRONT_URL;

  const replaceWithCloudFront = (url) => {
    if (!url || !url.includes("s3")) return url;

    const parts = url.split("/");
    const fileKey = parts.slice(3).join("/");
    return cloudFrontUrl + fileKey;
  };

  const transform = (playlist) => {
    // Replace imageUrl
    if (playlist?.imageUrl) {
      playlist.imageUrl = replaceWithCloudFront(playlist.imageUrl);
    }

    // Replace shareImageUrl
    if (playlist?.shareImageUrl) {
      playlist.shareImageUrl = replaceWithCloudFront(playlist.shareImageUrl);
    }

    // Replace owner.profilePic and coverImage if they exist
    if (playlist?.owner?.profilePic) {
      playlist.owner.profilePic = replaceWithCloudFront(
        playlist.owner.profilePic
      );
    }

    if (playlist?.owner?.coverImage) {
      playlist.owner.coverImage = replaceWithCloudFront(
        playlist.owner.coverImage
      );
    }

    return playlist;
  };

  return Array.isArray(playlists)
    ? playlists.map((playlist) => transform(playlist))
    : transform(playlists);
};

module.exports = {
  CREATE: async (req, res) => {
    try {
      user = req.user;
      const playlistData = {
        owner: req.user._id,
        imageUrl: req.body.imageUrl,
        name: req.body.name,
        isPrivate: req.body.isPrivate,
        videos: [],
      };

      userRole = user?.role === "influencer" ? "Influencer" : "User";

      const playlist = await PLAYLIST_MODEL.create(playlistData);

      await ADMIN_NOTIFICATION.create({
        title: "New Playlist Created",
        body: `${userRole} ${
          user.name || user.email
        } created a playlist named "${playlist.name}".`,
        type: "playlists",
        relatedItem: playlist._id,
      });

   if(!playlistData.isPrivate){   // Queue notification job (non-blocking)
      notificationQueue.add('send-content-notification', {
        creatorId: user._id,
        contentType: 'playlist',
        contentId: playlist._id,
        contentName: playlist.name,
        imageUrl: playlist.imageUrl,
      }, {
        priority: 2,
        removeOnComplete: true,
      }).catch(err => console.error('Queue error:', err));}

      return res.status(201).json({
        message: "Playlist created successfully",
        data: playlist,
      });
    } catch (error) {
      return handleError(error, res);
    }
  },

  FIND_ALL: async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const perPage = 100;
      const skip = (page - 1) * perPage;
      const userId = req.query.userId;
      const followedIds = req.query.followedIds;

      let playlists = [];
      let totalPlaylists = 0;

      const user = await USER_MODEL.findById(userId).select("pinnedPlaylists");
      const pinnedIds = user?.pinnedPlaylists?.map((id) => id.toString()) || [];

      if (followedIds !== undefined) {
        const ids = followedIds
          .split(",")
          .filter((id) => mongoose.Types.ObjectId.isValid(id));
        playlists = await PLAYLIST_MODEL.find({
          _id: { $in: ids },
        });
        totalPlaylists = playlists.length;
      } else {
        playlists = await PLAYLIST_MODEL.find({
          owner: userId,
          isPrivate: req.query.isPrivate,
        });
        totalPlaylists = playlists.length;
      }

      const pinnedPlaylists = playlists.filter((pl) =>
        pinnedIds.includes(pl._id.toString())
      );
      const otherPlaylists = playlists.filter(
        (pl) => !pinnedIds.includes(pl._id.toString())
      );

      const mergedPlaylists = [...pinnedPlaylists, ...otherPlaylists];

      const paginatedPlaylists = mergedPlaylists.slice(skip, skip + perPage);

      const allVideoIds = paginatedPlaylists.flatMap((pl) => pl.videos);
      const existingVideos = await VIDEO_MODEL.find(
        { _id: { $in: allVideoIds } },
        { _id: 1 }
      );
      const validVideoIdSet = new Set(
        existingVideos.map((video) => video._id.toString())
      );

      const filteredPlaylists = paginatedPlaylists.map((playlist) => {
        const filteredVideos = playlist.videos.filter((videoId) =>
          validVideoIdSet.has(videoId.toString())
        );
        return {
          ...playlist.toObject(),
          videos: filteredVideos,
          isPinned: pinnedIds.includes(playlist._id.toString()), // add pinned flag
        };
      });

      const transformedPlaylists =
        addCloudFrontUrlToPlaylists(filteredPlaylists);

      return res.status(200).json({
        message: "Playlists retrieved successfully",
        data: {
          playlists: transformedPlaylists,
          pagination: {
            currentPage: page,
            totalPages: Math.ceil(totalPlaylists / perPage),
            totalItems: totalPlaylists,
            perPage,
          },
        },
      });
    } catch (error) {
      console.log("error", error);
      return handleError(error, res);
    }
  },
  pinUnpinPlaylist: async (req, res) => {
    try {
      const userId = req.user._id;
      const { id: playlistId } = req.params;

      if (!playlistId) {
        return res
          .status(400)
          .json({ success: false, message: "playlistId is required" });
      }

      const playlist = await PLAYLIST_MODEL.findOne({
        _id: playlistId,
        owner: userId,
      });
      if (!playlist) {
        return res.status(404).json({
          success: false,
          message: "Playlist not found or not owned by user",
        });
      }

      const user = await USER_MODEL.findById(userId).select("pinnedPlaylists");
      const isPinned = user.pinnedPlaylists.includes(playlistId);
      const pinnedCount = user.pinnedPlaylists.length;

      if (isPinned) {
        await USER_MODEL.findByIdAndUpdate(userId, {
          $pull: { pinnedPlaylists: playlistId },
        });
        return res
          .status(200)
          .json({ success: true, message: "Playlist unpinned successfully" });
      }

      if (pinnedCount >= 2) {
        return res.status(400).json({
          success: false,
          message: "You can only pin up to 2 playlists",
        });
      }

      await USER_MODEL.findByIdAndUpdate(userId, {
        $addToSet: { pinnedPlaylists: playlistId },
      });
      return res
        .status(200)
        .json({ success: true, message: "Playlist pinned successfully" });
    } catch (error) {
      return handleError(error, res);
    }
  },

  FIND_ONE: async (req, res) => {
    try {
      const playlistId = req.params.id;
      const requesterId = req.user._id;

      const playlistRaw = await PLAYLIST_MODEL.findById(playlistId);

      if (!playlistRaw) {
        return res.status(404).json({
          status: "error",
          message: "Playlist not found",
        });
      }

      const isOwner = playlistRaw.owner.toString() === requesterId.toString();

      const pinnedVideoIds = (playlistRaw.pinnedVideos || []).map((id) =>
        id.toString()
      );

      const existingVideos = await VIDEO_MODEL.find({
        _id: { $in: playlistRaw.videos },
      }).select("_id title");

      const existingVideoIds = existingVideos.map((v) => v._id.toString());

      const { page = 1, limit = 12 } = req.query;
      const skip = (page - 1) * limit;
      const limitParsed = parseInt(limit);

      const validVideos = existingVideos.filter((v) =>
        existingVideoIds.includes(v._id.toString())
      );

      const totalVideos = validVideos.length;
      const totalPages =
        totalVideos > 0 ? Math.ceil(totalVideos / limitParsed) : 1;

      const pinnedVideos =
        pinnedVideoIds.length > 0
          ? await VIDEO_MODEL.find({
              _id: {
                $in: pinnedVideoIds.filter((id) =>
                  existingVideoIds.includes(id)
                ),
              },
            })
              .populate({
                path: "owner",
                model: "users",
              })
              .sort({ createdAt: -1 })
          : [];

      const otherVideos = await VIDEO_MODEL.find({
        _id: {
          $in: existingVideoIds,
          $nin: pinnedVideoIds,
        },
      })
        .populate({
          path: "owner",
          model: "users",
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitParsed);

      let videos = [...pinnedVideos, ...otherVideos];

      videos = videos.map((v) => {
        const videoObj = v.toObject();
        videoObj.isPinned = pinnedVideoIds.includes(videoObj._id.toString());
        return videoObj;
      });

      const playlist = await PLAYLIST_MODEL.findById(playlistId).populate({
        path: "owner",
        model: "users",
        select: "username",
      });

      const playlistObj = playlist.toObject();
      playlistObj.videos = videos;

      return res.status(200).json({
        message: "Playlist retrieved successfully",
        data: playlistObj,
        isOwner,
        pagination: {
          totalPages,
          page: parseInt(page),
          limit: limitParsed,
        },
      });
    } catch (error) {
      console.error("Error in FIND_ONE:", error);
      return handleError(error, res);
    }
  },
  UPDATE_BY_ID: async (req, res) => {
    try {
      const playlist = await PLAYLIST_MODEL.findOne({
        _id: req.params.id,
        owner: req.user._id,
      });

      if (!playlist) {
        return res.status(404).json({
          status: "error",
          message: "Playlist not found or unauthorized",
        });
      }

      const updatedPlaylist = await PLAYLIST_MODEL.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true }
      );

      return res.status(200).json({
        message: "Playlist updated successfully",
        data: updatedPlaylist,
      });
    } catch (error) {
      return handleError(error, res);
    }
  },
  UPDATE_SHARE_IMAGE: async (req, res) => {
    try {
      const { shareImageUrl } = req.body;

      if (!shareImageUrl) {
        return res.status(400).json({
          status: "error",
          message: "shareImageUrl is required",
        });
      }

      const updatedPlaylist = await PLAYLIST_MODEL.findByIdAndUpdate(
        req.params.id,
        { shareImageUrl },
        { new: true }
      );

      if (!updatedPlaylist) {
        return res.status(404).json({
          status: "error",
          message: "Playlist not found",
        });
      }

      return res.status(200).json({
        status: "success",
        message: "Playlist share image updated successfully",
        data: updatedPlaylist,
      });
    } catch (error) {
      return handleError(error, res);
    }
  },
  DELETE_BY_ID: async (req, res) => {
    try {
      const playlist = await PLAYLIST_MODEL.findOne({
        _id: req.params.id,
        owner: req.user._id,
      });

      if (!playlist) {
        return res.status(404).json({
          status: "error",
          message: "Playlist not found or unauthorized",
        });
      }

      const playlistId = playlist._id;

      const isPinned = await USER_MODEL.findOne({
        _id: req.user._id,
        pinnedPlaylists: playlistId,
      });

      if (isPinned) {
        return res.status(400).json({
          status: "error",
          message: "Unpin this playlist first.",
          code: "PLAYLIST_PINNED",
        });
      }

      await playlist.deleteOne();

      await USER_MODEL.updateMany(
        { followingPlayLists: playlistId },
        { $pull: { followingPlayLists: playlistId } }
      );

      return res.status(200).json({
        message: "Playlist deleted successfully",
      });
    } catch (error) {
      console.log(error);
      return handleError(error, res);
    }
  },

  TOGGLE_VIDEO: async (req, res) => {
    try {
      const { playlistId, videoId } = req.body;
      const userId = req.user._id;

      if (!playlistId || !videoId) {
        return res.status(400).json({
          status: "error",
          message: "playlistId and videoId are required",
        });
      }

      const playlist = await PLAYLIST_MODEL.findOne({
        _id: playlistId,
        owner: userId,
      });

      if (!playlist) {
        return res.status(404).json({
          status: "error",
          message: "Playlist not found or unauthorized",
        });
      }

      const pinnedVideoIds = (playlist.pinnedVideos || []).map((id) =>
        id.toString()
      );
      const videoIndex = playlist.videos.indexOf(videoId);

      if (videoIndex !== -1) {
        if (pinnedVideoIds.includes(videoId.toString())) {
          return res.status(400).json({
            status: "error",
            message:
              "This video is pinned in the playlist. Please unpin it first.",
          });
        }

        playlist.videos.splice(videoIndex, 1);
        const updatedPlaylist = await playlist.save();

        return res.status(200).json({
          message: "Video removed from playlist successfully",
          data: updatedPlaylist,
        });
      } else {
        playlist.videos.push(videoId);
        const updatedPlaylist = await playlist.save();

        return res.status(200).json({
          message: "Video added to playlist successfully",
          data: updatedPlaylist,
        });
      }
    } catch (error) {
      return handleError(error, res);
    }
  },

  TOGGLE_FOLLOW: async (req, res) => {
    try {
      const user = await USER_MODEL.findById(req.user._id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const playlistId = req.body.playlistId;
      const index = user.followingPlayLists.indexOf(playlistId);

      if (index !== -1) {
        // Unfollow: Remove from the list
        user.followingPlayLists.splice(index, 1);
        await user.save();
        return res.status(200).json({
          message: "Playlist unfollowed successfully",
          data: user.followingPlayLists,
        });
      } else {
        // Follow: Add to the list
        user.followingPlayLists.push(playlistId);
        await user.save();
        return res.status(200).json({
          message: "Playlist followed successfully",
          data: user.followingPlayLists,
        });
      }
    } catch (error) {
      return handleError(error, res);
    }
  },

  FIND_ONE_PUBLIC: async (req, res) => {
    try {
      const playlistId = req.params.id;

      const playlist = await PLAYLIST_MODEL.findById(playlistId)
        .populate({
          path: "owner",
          model: "users",
          select: "name username profilePic coverImage",
        })
        .select("name imageUrl shareImageUrl owner videos createdAt updatedAt");

      if (!playlist) {
        return res.status(404).json({
          status: "error",
          message: "Playlist not found",
        });
      }

      // Count valid videos
      const existingVideos = await VIDEO_MODEL.find({
        _id: { $in: playlist.videos },
      }).select("_id");
      const videoCount = existingVideos.length;

      // Get up to 10 video thumbnails for public display
      const videoThumbnails = await VIDEO_MODEL.find({
        _id: { $in: playlist.videos },
      })
        .select("_id thumbnailUrl viewCount name caption")
        .sort({ createdAt: -1 })
        .limit(10);

      // Transform video thumbnails with CloudFront URLs
      const cloudFrontUrl = process.env.CLOUD_FRONT_URL;
      const replaceWithCloudFront = (url) => {
        if (!url || !url.includes("s3")) return url;
        const parts = url.split("/");
        const fileKey = parts.slice(3).join("/");
        return cloudFrontUrl + fileKey;
      };

      const transformedVideos = videoThumbnails.map((video) => {
        const videoObj = video.toObject();
        if (videoObj.thumbnailUrl) {
          videoObj.thumbnailUrl = replaceWithCloudFront(videoObj.thumbnailUrl);
        }
        return {
          _id: videoObj._id,
          thumbnailUrl: videoObj.thumbnailUrl,
          viewCount: videoObj.viewCount || 0,
          name: videoObj.name,
          caption: videoObj.caption,
        };
      });

      // Transform to public format
      const playlistObj = playlist.toObject();
      playlistObj.videoCount = videoCount;
      playlistObj.videos = transformedVideos; // Include video thumbnails

      // Apply CloudFront URL transformation
      const transformedPlaylist = addCloudFrontUrlToPlaylists(playlistObj);

      return res.status(200).json({
        message: "Playlist retrieved successfully",
        data: transformedPlaylist,
      });
    } catch (error) {
      console.error("Error in FIND_ONE_PUBLIC:", error);
      return handleError(error, res);
    }
  },
};
