const { default: mongoose } = require("mongoose");
const {
  VIDEO_MODEL,
  PLAYLIST_MODEL,
  VIDEO_VIEWS_MODEL,
  SPONSORS_MODEL,
  DOT_NOTIFICATION_MODEL,
  ADMIN_NOTIFICATION,
  USER_MODEL,
  NOTIFICATION_PREFERENCES_MODEL,
} = require("../../models");
const handleError = require("../../utils/errorHandler");
const notificationQueue = require("../../queue/notificationQueue");

const populateVideoFields = [
  {
    path: "owner",
    select:
      "name profilePic connectyCubeId followers following notificationToken role username",
  },
];

const userFeedSessions = new Map();

const SESSION_TTL = 60 * 60 * 1000;

setInterval(() => {
  const now = Date.now();
  for (const [uid, sess] of userFeedSessions) {
    if (now - sess.timestamp > SESSION_TTL) {
      userFeedSessions.delete(uid);
    }
  }
}, 30 * 60 * 1000);

function getUserSession(userId, pageNo) {
  const id = userId?.toString() || "guest";
  const now = Date.now();
  const existing = userFeedSessions.get(id);

  if (!existing || pageNo == 1 || now - existing.timestamp > SESSION_TTL) {
    const session = {
      seenVideos: new Set(),
      seed: Math.floor(Math.random() * 10000),
      timestamp: now,
    };
    userFeedSessions.set(id, session);
    return session;
  }

  existing.timestamp = now;
  return existing;
}

function addSeenVideos(session, videoIds = []) {
  videoIds.forEach((id) => session.seenVideos.add(id));
}

const addCloudFrontUrl = (videos) => {
  const cloudFrontUrl = process.env.CLOUD_FRONT_URL;

  const replaceWithCloudFront = (url) => {
    if (!url || !url.includes("s3")) return url;

    // Get just the file key (everything after last "/")
    const parts = url.split("/");
    const fileKey = parts.slice(3).join("/"); // Remove protocol + bucket

    return cloudFrontUrl + fileKey;
  };

  const transform = (video) => {
    if (video?.s3BucketId) {
      video.url = cloudFrontUrl + video.s3BucketId;
    }

    if (video?.thumbnailUrl) {
      video.thumbnailUrl = replaceWithCloudFront(video.thumbnailUrl);
    }
    if (video?.sponsorInfo?.coverImage) {
      video.sponsorInfo.coverImage = replaceWithCloudFront(
        video.sponsorInfo.coverImage
      );
    }
    if (video?.sponsorInfo?.logo) {
      video.sponsorInfo.logo = replaceWithCloudFront(video.sponsorInfo.logo);
    }
    if (video?.sponsorInfo?.shopImage) {
      video.sponsorInfo.shopImage = replaceWithCloudFront(
        video.sponsorInfo.shopImage
      );
    }

    if (video?.owner?.profilePic) {
      video.owner.profilePic = replaceWithCloudFront(video.owner.profilePic);
    }

    if (video?.owner?.coverImage) {
      video.owner.coverImage = replaceWithCloudFront(video.owner.coverImage);
    }

    return video;
  };

  return Array.isArray(videos)
    ? videos.map((video) => transform(video))
    : transform(videos);
};

const registerVideoViews = async (videoIds, userId) => {
  try {
    // Find videos the user has already viewed
    const existingViews = await VIDEO_VIEWS_MODEL.find({
      video: { $in: videoIds },
      user: userId,
    });

    const viewedVideoIds = new Set(
      existingViews.map((view) => view.video.toString())
    );
    const newViews = videoIds.filter((id) => !viewedVideoIds.has(id));

    if (newViews.length) {
      // Insert new view records
      await VIDEO_VIEWS_MODEL.insertMany(
        newViews.map((videoId) => ({ video: videoId, user: userId }))
      );

      // Increment view count for all new videos
      await VIDEO_MODEL.updateMany(
        { _id: { $in: newViews } },
        { $inc: { viewCount: 1 } }
      );
    }

    return { success: true };
  } catch (error) {}
};

module.exports = {
  FIND_ALL: async (req, res) => {
    try {
      const { perPage = 10, pageNo = 1 } = req.query;
      const user = req.user;

      const session = getUserSession(user?._id, Number(pageNo));
      const usedVideoIds = new Set(session.seenVideos);
      const usedObjectIds = Array.from(usedVideoIds).map(
        (id) => new mongoose.Types.ObjectId(id)
      );

      const now = new Date();
      const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const baseMatch = {
        isPrivate: false,
        isDeleted: false,
        owner: { $nin: user?.blockedUsers || [] },
        _id: { $nin: usedObjectIds },
      };

      const basePipeline = [
        {
          $lookup: {
            from: "users",
            localField: "owner",
            foreignField: "_id",
            as: "owner",
          },
        },
        { $unwind: "$owner" },
        { $match: { "owner.role": "influencer" } },
      ];
      const sponsoredVideosNeeded = Math.floor(perPage / 4);
      let sponsoredVideos = await VIDEO_MODEL.aggregate([
        {
          $match: {
            isPrivate: false,
            isDeleted: false,
            owner: { $nin: user?.blockedUsers || [] },
            sponsored: true,
          },
        },
        { $limit: sponsoredVideosNeeded * 2 },
      ]);

      function shuffle(array) {
        for (let i = array.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
      }

      if (sponsoredVideos && sponsoredVideos.length) {
        sponsoredVideos = shuffle(sponsoredVideos).slice(
          0,
          sponsoredVideosNeeded
        );
      }

      if (sponsoredVideos.length > 0) {
        const sponsorIds = sponsoredVideos.map((v) => v._id.toString());
        const sponsorsData = await SPONSORS_MODEL.find({
          isDeleted: false,
          videoId: { $in: sponsorIds },
        }).lean();

        const sponsorsMap = {};
        sponsorsData.forEach((s) => {
          if (s?.videoId) sponsorsMap[s.videoId.toString()] = s;
        });

        sponsoredVideos = sponsoredVideos.map((v) => ({
          ...v,
          sponsorInfo: sponsorsMap[v._id.toString()] || null,
          originalVideoId: v._id.toString(),
        }));

        const originalSponsors = [...sponsoredVideos];
        const finalSponsoredVideos = [];
        while (finalSponsoredVideos.length < sponsoredVideosNeeded) {
          for (const vid of originalSponsors) {
            if (finalSponsoredVideos.length >= sponsoredVideosNeeded) break;
            const dup = {
              ...vid,
              instanceId: `${vid.originalVideoId}_${finalSponsoredVideos.length}`,
            };
            finalSponsoredVideos.push(dup);
          }
        }
        sponsoredVideos = shuffle(finalSponsoredVideos);
      }

      let regularVideos = await VIDEO_MODEL.aggregate([
        {
          $match: {
            ...baseMatch,
            sponsored: { $ne: true },
          },
        },
        ...basePipeline,
        { $sort: { createdAt: -1 } },
        { $limit: perPage * 5 },
      ]);
      const recent = [],
        week = [],
        older = [];
      regularVideos.forEach((v) => {
        if (v.createdAt >= last24Hours) recent.push(v);
        else if (v.createdAt >= last7Days) week.push(v);
        else older.push(v);
      });

      shuffle(recent);
      shuffle(week);
      shuffle(older);

      const weightedPick = [];
      const addVideos = (arr) => {
        for (const v of arr) {
          if (weightedPick.length >= perPage) break;
          weightedPick.push(v);
        }
      };
      addVideos(recent);
      addVideos(week);
      addVideos(older);

      if (weightedPick.length < perPage) {
        const remaining = await VIDEO_MODEL.aggregate([
          { $match: { ...baseMatch, sponsored: { $ne: true } } },
          ...basePipeline,
          { $sample: { size: perPage - weightedPick.length } },
        ]);
        weightedPick.push(...remaining);
      }

      function progressiveInterleaveNoConsecutive(videos) {
        const ownerMap = {};
        videos.forEach((v) => {
          const ownerId = v.owner._id.toString();
          if (!ownerMap[ownerId]) ownerMap[ownerId] = [];
          ownerMap[ownerId].push(v);
        });

        Object.keys(ownerMap).forEach((id) => shuffle(ownerMap[id]));

        const finalFeed = [];
        let lastOwner = null;

        while (
          Object.keys(ownerMap).some((ownerId) => ownerMap[ownerId].length)
        ) {
          let added = false;
          for (const ownerId of shuffle(Object.keys(ownerMap))) {
            if (ownerId !== lastOwner && ownerMap[ownerId].length) {
              finalFeed.push(ownerMap[ownerId].shift());
              lastOwner = ownerId;
              added = true;
              break;
            }
          }
          if (!added) {
            for (const ownerId of Object.keys(ownerMap)) {
              if (ownerMap[ownerId].length) {
                finalFeed.push(ownerMap[ownerId].shift());
                lastOwner = ownerId;
                break;
              }
            }
          }
        }

        return finalFeed;
      }

      const pickedVideos = progressiveInterleaveNoConsecutive(
        weightedPick
      ).slice(0, perPage);

      pickedVideos.forEach((v) => usedVideoIds.add(v._id.toString()));
      addSeenVideos(
        session,
        pickedVideos.map((v) => v._id.toString())
      );

      const result = [];
      let sponsorIndex = 0;

      for (let i = 0; i < pickedVideos.length; i++) {
        result.push(pickedVideos[i]);
        if ((i + 1) % 3 === 0 && sponsorIndex < sponsoredVideos.length) {
          result.push(sponsoredVideos[sponsorIndex]);
          sponsorIndex++;
        }
      }

      while (sponsorIndex < sponsoredVideos.length) {
        result.push(sponsoredVideos[sponsorIndex]);
        sponsorIndex++;
      }

      return res.status(200).json({
        message: "Videos retrieved successfully",
        data: addCloudFrontUrl(result),
      });
    } catch (error) {
      console.error("❌ Error in FIND_ALL:", error);
      return handleError(error, res);
    }
  },

  FIND_ALL_FEATURED: async (req, res) => {
    try {
      const { perPage = 20, pageNo = 1 } = req.query;
      const skip = perPage * (pageNo - 1);
      const user = req.user;

      const videos = await VIDEO_MODEL.aggregate([
        {
          $match: {
            isPrivate: false,
            isDeleted: false,
            owner: { $nin: user?.blockedUsers || [] },
            isFeatured: true,
            $or: [
              { sponsored: false },
              { sponsored: { $exists: false } },
              { sponsored: null },
            ],
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "owner",
            foreignField: "_id",
            as: "owner",
          },
        },
        { $unwind: "$owner" },
        {
          $match: {
            "owner.role": "influencer",
          },
        },
        {
          $sort: { createdAt: -1, _id: -1 },
        },
        // Uncomment if pagination is needed
        // { $skip: skip },
        // { $limit: parseInt(perPage) },
      ]);

      if (!videos.length) {
        return res.status(404).json({
          status: "error",
          message: "No videos found",
        });
      }

      return res.status(200).json({
        message: "Videos retrieved successfully",
        data: addCloudFrontUrl(videos),
      });
    } catch (error) {
      console.log(error);

      return handleError(error, res);
    }
  },

  GET_USER_VIDEOS: async (req, res) => {
    try {
      const ownerId = req.params.id;
      const requesterId = req.user._id;

      const isOwner = ownerId === requesterId.toString();

      const user = await USER_MODEL.findById(ownerId).select("pinnedVideos");
      const pinnedIds = user?.pinnedVideos || [];

      const queryConditions = {
        owner: ownerId,
        isDeleted: false,
      };

      if (!isOwner) {
        queryConditions.isPrivate = false;
      }

      const pinnedVideos =
        pinnedIds.length > 0
          ? await VIDEO_MODEL.find({
              ...queryConditions,
              _id: { $in: pinnedIds },
            })
              .populate(populateVideoFields)
              .sort({ createdAt: -1 })
          : [];

      const otherVideos = await VIDEO_MODEL.find({
        ...queryConditions,
        _id: { $nin: pinnedIds },
      })
        .populate(populateVideoFields)
        .sort({ createdAt: -1 });

      let videos = [...pinnedVideos, ...otherVideos];

      if (isOwner && videos.length > 0) {
        const playlists = await PLAYLIST_MODEL.find({ owner: ownerId });
        const videoPlaylistMap = new Map();
        playlists.forEach((pl) => {
          pl.videos.forEach((vId) => {
            videoPlaylistMap.set(vId.toString(), {
              playlistId: pl._id,
              playlistName: pl.name,
            });
          });
        });

        videos = videos.map((v) => {
          const videoObj = v.toObject();
          const playlistInfo = videoPlaylistMap.get(videoObj._id.toString());
          if (playlistInfo) {
            videoObj.playlistId = playlistInfo.playlistId;
            videoObj.playlistName = playlistInfo.playlistName;
          }
          videoObj.isPinned = pinnedIds.includes(videoObj._id.toString());
          return videoObj;
        });

        return res.status(200).json({
          success: true,
          message: "Videos retrieved successfully",
          data: addCloudFrontUrl(videos),
          isOwner,
        });
      } else {
        videos = videos.map((v) => {
          const videoObj = v.toObject();
          videoObj.isPinned = pinnedIds.includes(videoObj._id.toString());
          return videoObj;
        });

        return res.status(200).json({
          success: true,
          message: "Videos retrieved successfully",
          data: addCloudFrontUrl(videos),
          isOwner,
        });
      }
    } catch (error) {
      return handleError(error, res);
    }
  },
  pinUnpinVideo: async (req, res) => {
    try {
      const userId = req.user._id;
      const { id: videoId } = req.params;

      if (!videoId) {
        return res
          .status(400)
          .json({ success: false, message: "videoId is required" });
      }

      const video = await VIDEO_MODEL.findOne({ _id: videoId, owner: userId });

      if (!video) {
        return res.status(404).json({
          success: false,
          message: "Video not found or not owned by user",
        });
      }

      const user = await USER_MODEL.findById(userId).select("pinnedVideos");
      const isPinned = user.pinnedVideos.includes(videoId);
      const pinnedCount = user.pinnedVideos.length;

      if (isPinned) {
        await USER_MODEL.findByIdAndUpdate(userId, {
          $pull: { pinnedVideos: videoId },
        });

        return res.status(200).json({
          success: true,
          message: "Video unpinned successfully",
        });
      }

      if (pinnedCount >= 3) {
        return res.status(400).json({
          success: false,
          message: "You can only pin up to 3 videos",
        });
      }

      await USER_MODEL.findByIdAndUpdate(userId, {
        $addToSet: { pinnedVideos: videoId },
      });

      return res.status(200).json({
        success: true,
        message: "Video pinned successfully",
      });
    } catch (error) {
      return handleError(error, res);
    }
  },
  pinUnpinVideoInPlaylist: async (req, res) => {
    try {
      const userId = req.user._id;
      const { playlistId, videoId } = req.params;

      if (!playlistId || !videoId) {
        return res.status(400).json({
          success: false,
          message: "playlistId and videoId are required",
        });
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

      if (!playlist.videos.includes(videoId)) {
        return res.status(404).json({
          success: false,
          message: "Video not found in this playlist",
        });
      }

      const pinnedVideos = playlist.pinnedVideos || [];
      const videoIdStr = videoId.toString();
      const isPinned = pinnedVideos.some((id) => id.toString() === videoIdStr);

      if (isPinned) {
        playlist.pinnedVideos = pinnedVideos.filter(
          (id) => id.toString() !== videoIdStr
        );
        await playlist.save();

        return res.status(200).json({
          success: true,
          message: "Video unpinned from playlist successfully",
        });
      }

      if (pinnedVideos.length >= 3) {
        return res.status(400).json({
          success: false,
          message: "You can only pin up to 3 videos in this playlist",
        });
      }

      playlist.pinnedVideos.push(videoId);
      await playlist.save();

      return res.status(200).json({
        success: true,
        message: "Video pinned to playlist successfully",
      });
    } catch (error) {
      return handleError(error, res);
    }
  },

  FIND_ONE: async (req, res) => {
    try {
      const { id } = req.params;
      const user = req.user;

      const video = await VIDEO_MODEL.findOne({
        _id: id,
        // owner: user._id,
      }).populate(populateVideoFields);

      if (!video) {
        return res.status(404).json({
          status: "error",
          message: "Video not found",
        });
      }

      return res.status(200).json({
        message: "Video retrieved successfully",
        data: addCloudFrontUrl(video),
      });
    } catch (error) {
      return handleError(error, res);
    }
  },

  CREATE_VIDEO: async (req, res) => {
    try {
      const user = req.user;
      const { playlistId, ...videoBody } = req.body;

      videoBody.owner = user._id;

      // Create video
      const video = await VIDEO_MODEL.create(videoBody);

      await DOT_NOTIFICATION_MODEL.create({
        type: "video",
        video: video._id,
        createdBy: user._id,
      });

      await ADMIN_NOTIFICATION.create({
        title: "New Video Created",
        body: `A new video uploaded by ${user.name || user.email}.`,
        type: "videos",
        relatedItem: video._id,
      });

      // If playlistId is provided, try to add the video to the playlist
      if (playlistId) {
        const playlist = await PLAYLIST_MODEL.findOne({
          _id: playlistId,
          owner: user._id,
        });

        if (!playlist) {
          return res.status(404).json({
            status: "error",
            message: "Playlist not found",
          });
        }

        playlist.videos.push(video._id);
        await playlist.save();
      }

  if(!videoBody.isPrivate){    // Queue notification job (non-blocking)
      notificationQueue.add('send-content-notification', {
        creatorId: user._id,
        contentType: 'video',
        contentId: video._id,
        contentName: videoBody.title || 'Untitled Video',
        imageUrl: video.thumbnailUrl || videoBody.thumbnailUrl || null,
      }, {
        priority: 2,
        removeOnComplete: true,
      }).catch(err => console.error('Queue error:', err));
}
      return res.status(201).json({
        message: "Video created successfully",
        data: video,
      });
    } catch (error) {
      return handleError(error, res);
    }
  },

  CREATE_VIDEO_SPONSORED: async (req, res) => {
    try {
      const { ...videoBody } = req.body;

      const video = await VIDEO_MODEL.create(videoBody);

      return res.status(201).json({
        message: "Video created successfully",
        data: video,
      });
    } catch (error) {
      return handleError(error, res);
    }
  },

  UPDATE_BY_ID: async (req, res) => {
    try {
      const { id } = req.params;
      const user = req.user;
      const { playlistId, oldPlayListId, ...videoBody } = req.body;

      // Update the video first
      const video = await VIDEO_MODEL.findOneAndUpdate(
        { _id: id, owner: user._id },
        videoBody,
        { new: true }
      ).populate(populateVideoFields);

      if (!video) {
        return res.status(404).json({
          status: "error",
          message: "Video not found",
        });
      }

      if (playlistId) {
        const newPlaylist = await PLAYLIST_MODEL.findOne({
          _id: playlistId,
          owner: user._id,
        });

        if (!newPlaylist) {
          return res.status(404).json({
            status: "error",
            message: "Playlist not found or unauthorized",
          });
        }

        if (oldPlayListId && playlistId !== oldPlayListId) {
          await PLAYLIST_MODEL.findByIdAndUpdate(oldPlayListId, {
            $pull: { videos: id },
          });
        }

        await PLAYLIST_MODEL.findByIdAndUpdate(playlistId, {
          $addToSet: { videos: id }, // ensures no duplicates
        });
      }

      return res.status(200).json({
        message: "Video updated successfully",
        data: video,
      });
    } catch (error) {
      return handleError(error, res);
    }
  },

  DELETE_BY_ID: async (req, res) => {
    try {
      const { id } = req.params;
      const user = req.user;

      const video = await VIDEO_MODEL.findOne({
        _id: id,
        owner: user._id,
      });

      if (!video) {
        return res.status(404).json({
          status: "error",
          message: "Video not found",
        });
      }

      const pinCheck = await USER_MODEL.aggregate([
        { $match: { _id: user._id } },
        {
          $lookup: {
            from: "playlists",
            localField: "_id",
            foreignField: "owner",
            pipeline: [
              {
                $match: {
                  pinnedVideos: new mongoose.Types.ObjectId(id),
                },
              },
              { $project: { name: 1 } },
            ],
            as: "playlistsPinningVideo",
          },
        },
        {
          $project: {
            isPinnedInUser: {
              $in: [new mongoose.Types.ObjectId(id), "$pinnedVideos"],
            },
            playlistsPinningVideo: 1,
          },
        },
      ]);

      const pin = pinCheck[0];

      if (pin.isPinnedInUser) {
        return res.status(400).json({
          status: "error",
          message: "Unpin this video from your profile before deleting.",
          code: "VIDEO_PINNED_IN_USER",
        });
      }

      if (pin.playlistsPinningVideo.length > 0) {
        return res.status(400).json({
          status: "error",
          message: `Video is pinned in "${pin.playlistsPinningVideo[0].name}". Unpin first.`,
          code: "VIDEO_PINNED_IN_PLAYLIST",
          playlistId: pin.playlistsPinningVideo[0]._id,
        });
      }

      await VIDEO_MODEL.findOneAndDelete({
        _id: id,
        owner: user._id,
      });

      await PLAYLIST_MODEL.updateMany(
        { videos: id },
        { $pull: { videos: id } }
      );

      return res.status(200).json({
        message: "Video deleted successfully",
      });
    } catch (error) {
      return handleError(error, res);
    }
  },

  ADD_REMOVE_LIKE: async (req, res) => {
    try {
      const { id } = req.params;
      const user = req.user;

      const video = await VIDEO_MODEL.findOne({
        _id: id,
        isPrivate: false,
      });

      if (!video) {
        return res.status(404).json({
          status: "error",
          message: "Video not found",
        });
      }

      const likeIndex = video.likes.indexOf(user._id);
      if (likeIndex > -1) {
        video.likes.splice(likeIndex, 1);
      } else {
        video.likes.push(user._id);
      }

      const updatedVideo = await video.save();
      await updatedVideo.populate(populateVideoFields);

      return res.status(200).json({
        message: "Video likes updated successfully",
        data: updatedVideo,
      });
    } catch (error) {
      console.log(error);

      return handleError(error, res);
    }
  },

  ADD_COMMENT: async (req, res) => {
    try {
      const { id } = req.params;
      const { comment } = req.body;
      const user = req.user;

      const video = await VIDEO_MODEL.findOne({
        _id: id,
        isPrivate: false,
      });

      if (!video) {
        return res.status(404).json({
          status: "error",
          message: "Video not found",
        });
      }

      video.comments.push({
        comment,
        user: user._id,
      });

      const updatedVideo = await video.save();
      await updatedVideo.populate(populateVideoFields);

      return res.status(200).json({
        message: "Comment added successfully",
        data: updatedVideo,
      });
    } catch (error) {
      return handleError(error, res);
    }
  },
};
