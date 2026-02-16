const handleError = require("../../../utils/errorHandler");
const {
  INSPIRATION_MODEL,
  VIDEO_MODEL,
  PLAYLIST_MODEL,
  USER_MODEL,
} = require("../../../models");
const { default: mongoose } = require("mongoose");
const parseFilter = require("../../../utils/parseFilter");

const addCloudFrontUrl = (items) => {
  const cloudFrontUrl = process.env.CLOUD_FRONT_URL;

  const replaceWithCloudFront = (url) => {
    if (!url || !url.includes("s3")) return url;
    const parts = url.split("/");
    const fileKey = parts.slice(3).join("/");
    return cloudFrontUrl + fileKey;
  };

  const transform = (item) => {
    if (item?.thumbnailUrl) {
      item.thumbnailUrl = replaceWithCloudFront(item.thumbnailUrl);
    }
    if (item?.imageUrl) {
      item.imageUrl = replaceWithCloudFront(item.imageUrl);
    }
    if (item?.s3BucketId) {
      item.url = cloudFrontUrl + item.s3BucketId;
    }
    if (item?.owner?.profilePic) {
      item.owner.profilePic = replaceWithCloudFront(item.owner.profilePic);
    }
    if (item?.owner?.coverImage) {
      item.owner.coverImage = replaceWithCloudFront(item.owner.coverImage);
    }
    return item;
  };

  return Array.isArray(items)
    ? items.map((item) => transform(item))
    : transform(items);
};

// Helper function to get or create the single inspiration record
const getOrCreateInspiration = async () => {
  let inspiration = await INSPIRATION_MODEL.findOne();
  
  if (!inspiration) {
    // Create the single record if it doesn't exist
    inspiration = await INSPIRATION_MODEL.create({
      tag: "",
      videos: [],
      influencer: null,
      playlists: [],
    });
  }
  
  return inspiration;
};

module.exports = {
  GET_INSPIRATION_CONFIG: async (req, res) => {
    try {
      let inspiration = await getOrCreateInspiration();
      
      inspiration = await INSPIRATION_MODEL.findById(inspiration._id)
        .populate("videos")
        .populate("influencer", "name profilePic username")
        .populate("playlists");

      return res.status(200).json({
        message: "Inspiration config retrieved successfully",
        data: inspiration,
      });
    } catch (error) {
      return handleError(error, res);
    }
  },

  GET_UNIQUE_TAGS_WITH_COUNTS: async (req, res) => {
    try {
      const tagsWithCounts = await VIDEO_MODEL.aggregate([
        {
          $match: {
            isDeleted: false,
            tags: { $exists: true, $ne: [] },
          },
        },
        {
          $unwind: "$tags",
        },
        {
          $match: {
            tags: { $ne: null, $ne: "" },
          },
        },
        {
          $group: {
            _id: "$tags",
            videoCount: { $sum: 1 },
          },
        },
        {
          $sort: { videoCount: -1 },
        },
        {
          $project: {
            _id: 0,
            tag: "$_id",
            videoCount: 1,
          },
        },
      ]);

      return res.status(200).json({
        message: "Tags retrieved successfully",
        data: tagsWithCounts,
      });
    } catch (error) {
      return handleError(error, res);
    }
  },

  GET_INFLUENCERS_WITH_PLAYLIST_COUNTS: async (req, res) => {
    try {
      const influencersWithCounts = await PLAYLIST_MODEL.aggregate([
        {
          $match: {
            isPrivate: false,
          },
        },
        {
          $group: {
            _id: "$owner",
            playlistCount: { $sum: 1 },
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "_id",
            foreignField: "_id",
            as: "influencer",
          },
        },
        {
          $unwind: "$influencer",
        },
        {
          $match: {
            "influencer.role": "influencer",
          },
        },
        {
          $project: {
            _id: 0,
            influencerId: "$_id",
            influencer: {
              _id: "$influencer._id",
              name: "$influencer.name",
              username: "$influencer.username",
              profilePic: "$influencer.profilePic",
              followers: { $size: { $ifNull: ["$influencer.followers", []] } },
            },
            playlistCount: 1,
          },
        },
        {
          $sort: { playlistCount: -1 },
        },
      ]);

      return res.status(200).json({
        message: "Influencers retrieved successfully",
        data: influencersWithCounts,
      });
    } catch (error) {
      return handleError(error, res);
    }
  },

  UPDATE_TAG_SELECTION: async (req, res) => {
    try {
      const { tag, videoIds } = req.body;

      if (!tag) {
        return res.status(400).json({
          status: "error",
          message: "Tag is required",
        });
      }

      let topVideoIds = [];

      // If videoIds provided, use them; otherwise auto-select
      if (videoIds && Array.isArray(videoIds) && videoIds.length > 0) {
        // Validate that all videoIds belong to the selected tag
        const videos = await VIDEO_MODEL.find({
          _id: { $in: videoIds },
          tags: tag,
          isDeleted: false,
        }).select("_id");
        
        topVideoIds = videos.map((v) => v._id);
        
        if (topVideoIds.length !== videoIds.length) {
          return res.status(400).json({
            status: "error",
            message: "Some selected videos do not belong to the selected tag",
          });
        }
        
        // Validate minimum 3 videos (or all available if less than 3)
        const allVideosForTag = await VIDEO_MODEL.countDocuments({
          tags: tag,
          isDeleted: false,
        });
        const minRequired = Math.min(3, allVideosForTag);
        
        if (topVideoIds.length < minRequired) {
          return res.status(400).json({
            status: "error",
            message: `Minimum ${minRequired} video(s) required (or all available if less than 3)`,
          });
        }
        
        // Validate maximum 6 videos
        if (topVideoIds.length > 6) {
          return res.status(400).json({
            status: "error",
            message: "Maximum 6 videos allowed",
          });
        }
      } else {
        // Find all videos with this tag, sorted by viewCount
        const allVideos = await VIDEO_MODEL.find({
          tags: tag,
          isDeleted: false,
        })
          .sort({ viewCount: -1 })
          .select("_id");

        const availableCount = allVideos.length;
        // Select min(6, available) but ensure at least 3 (or all if less than 3)
        const selectCount = availableCount < 3 
          ? availableCount 
          : Math.min(6, Math.max(3, availableCount));
        
        topVideoIds = allVideos.slice(0, selectCount).map((v) => v._id);
      }

      // Get current inspiration record
      const currentInspiration = await getOrCreateInspiration();
      
      // Unfeature all previously featured videos
      if (currentInspiration?.videos?.length > 0) {
        await VIDEO_MODEL.updateMany(
          { _id: { $in: currentInspiration.videos } },
          { isFeatured: false }
        );
      }

      // Feature the selected videos
      await VIDEO_MODEL.updateMany(
        { _id: { $in: topVideoIds } },
        { isFeatured: true }
      );

      // Update the single inspiration record
      const inspiration = await INSPIRATION_MODEL.findOneAndUpdate(
        {},
        {
          tag,
          videos: topVideoIds,
        },
        {
          new: true,
          upsert: true,
        }
      )
        .populate("videos")
        .populate("influencer", "name profilePic username")
        .populate("playlists");

      return res.status(200).json({
        message: "Tag selection updated successfully",
        data: inspiration,
      });
    } catch (error) {
      return handleError(error, res);
    }
  },

  UPDATE_INFLUENCER_SELECTION: async (req, res) => {
    try {
      const { influencerId, playlistIds } = req.body;

      if (!influencerId) {
        return res.status(400).json({
          status: "error",
          message: "Influencer ID is required",
        });
      }

      // Verify influencer exists and is an influencer
      const influencer = await USER_MODEL.findOne({
        _id: influencerId,
        role: "influencer",
      });

      if (!influencer) {
        return res.status(404).json({
          status: "error",
          message: "Influencer not found",
        });
      }

      let topPlaylistIds = [];

      // If playlistIds provided, use them; otherwise auto-select top 2
      if (playlistIds && Array.isArray(playlistIds) && playlistIds.length > 0) {
        // Validate that all playlistIds belong to the selected influencer
        const playlists = await PLAYLIST_MODEL.find({
          _id: { $in: playlistIds },
          owner: influencerId,
          isPrivate: false,
        }).select("_id");
        
        topPlaylistIds = playlists.map((p) => p._id);
        
        if (topPlaylistIds.length !== playlistIds.length) {
          return res.status(400).json({
            status: "error",
            message: "Some selected playlists do not belong to the selected influencer",
          });
        }
        
        // Validate maximum 2 playlists
        if (topPlaylistIds.length > 2) {
          return res.status(400).json({
            status: "error",
            message: "Maximum 2 playlists allowed",
          });
        }
      } else {
        // Sort by actual follower count
        const playlistsWithCounts = await PLAYLIST_MODEL.find({
          owner: influencerId,
          isPrivate: false,
        })
          .lean();

        playlistsWithCounts.sort(
          (a, b) =>
            (b.followingPlayLists?.length || 0) -
            (a.followingPlayLists?.length || 0)
        );

        topPlaylistIds = playlistsWithCounts
          .slice(0, 2)
          .map((p) => p._id);
      }

      // Get current inspiration record
      const currentInspiration = await getOrCreateInspiration();
      
      // Unfeature all previously featured playlists
      if (currentInspiration?.playlists?.length > 0) {
        await PLAYLIST_MODEL.updateMany(
          { _id: { $in: currentInspiration.playlists } },
          { isFeatured: false }
        );
      }

      // Feature the selected playlists
      await PLAYLIST_MODEL.updateMany(
        { _id: { $in: topPlaylistIds } },
        { isFeatured: true }
      );

      // Update the single inspiration record
      const inspiration = await INSPIRATION_MODEL.findOneAndUpdate(
        {},
        {
          influencer: influencerId,
          playlists: topPlaylistIds,
        },
        {
          new: true,
          upsert: true,
        }
      )
        .populate("videos")
        .populate("influencer", "name profilePic username")
        .populate("playlists");

      return res.status(200).json({
        message: "Influencer selection updated successfully",
        data: inspiration,
      });
    } catch (error) {
      return handleError(error, res);
    }
  },

  GET_TAG_VIDEOS: async (req, res) => {
    try {
      const {
        pageNum,
        perPage,
        search = "",
        sortBy = "newest",
        tag, // Allow tag to be passed as query param for modal
      } = req.query;

      const filter = parseFilter(req.query.filter, res);
      if (filter === null) return;

      // Check if pagination params are provided
      const hasPagination = pageNum !== undefined && perPage !== undefined;
      const pageNumValue = pageNum !== undefined ? Number(pageNum) : 1;
      const perPageValue = perPage !== undefined ? Number(perPage) : 10;

      // Get tag from query param or from inspiration config
      let selectedTag = tag;
      let savedVideoIds = null; // For page calls, filter to only saved videos
      
      if (!selectedTag) {
        // Page call: get tag from config and filter to saved videos
        const inspiration = await getOrCreateInspiration();
        selectedTag = inspiration?.tag;
        if (inspiration?.videos && inspiration.videos.length > 0) {
          savedVideoIds = inspiration.videos.map((id) => 
            typeof id === 'string' ? new mongoose.Types.ObjectId(id) : id
          );
        }
      }
      // If tag is provided (modal call), savedVideoIds remains null (show all videos)

      if (!selectedTag) {
        return res.status(200).json({
          message: "No tag selected",
          data: [],
          pagination: hasPagination ? {
            pageNum: pageNumValue,
            perPage: perPageValue,
            totalItems: 0,
          } : undefined,
        });
      }

      const query = {
        ...filter,
        tags: selectedTag,
        isDeleted: false,
      };

      // Filter to only saved videos if this is a page call (tag not provided)
      if (savedVideoIds && savedVideoIds.length > 0) {
        query._id = { $in: savedVideoIds };
      }

      if (search) {
        const matchingOwners = await USER_MODEL.find({
          name: { $regex: search, $options: "i" },
        }).select("_id");

        const ownerIds = matchingOwners.map((o) => o._id);

        query.$or = [
          { name: { $regex: search, $options: "i" } },
          { caption: { $regex: search, $options: "i" } },
          { owner: { $in: ownerIds } },
        ];
      }

      const totalItems = await VIDEO_MODEL.countDocuments(query);

      // Build query with conditional pagination
      let videosQuery = VIDEO_MODEL.find(query)
        .sort(sortBy === "newest" ? { createdAt: -1 } : { createdAt: 1 });
      
      // Only apply pagination if params were provided
      if (hasPagination) {
        videosQuery = videosQuery
          .skip((pageNumValue - 1) * perPageValue)
          .limit(perPageValue);
      }

      const videos = await videosQuery
        .populate("owner", ["name", "profilePic", "connectyCubeId"])
        .populate("category");

      return res.status(200).json({
        message: "Videos retrieved successfully",
        data: addCloudFrontUrl(videos),
        pagination: hasPagination ? {
          pageNum: pageNumValue,
          perPage: perPageValue,
          totalItems,
        } : undefined,
      });
    } catch (error) {
      return handleError(error, res);
    }
  },

  GET_INFLUENCER_PLAYLISTS: async (req, res) => {
    try {
      const {
        pageNum,
        perPage,
        search = "",
        sortBy = "newest",
        influencerId, // Allow influencerId to be passed as query param for modal
      } = req.query;

      const filter = parseFilter(req.query.filter, res);
      if (filter === null) return;

      // Check if pagination params are provided
      const hasPagination = pageNum !== undefined && perPage !== undefined;
      const pageNumValue = pageNum !== undefined ? Number(pageNum) : 1;
      const perPageValue = perPage !== undefined ? Number(perPage) : 10;

      // Get influencerId from query param or from inspiration config
      let selectedInfluencerId = influencerId;
      let savedPlaylistIds = null; // For page calls, filter to only saved playlists
      
      if (!selectedInfluencerId) {
        // Page call: get influencerId from config and filter to saved playlists
        const inspiration = await getOrCreateInspiration();
        selectedInfluencerId = inspiration?.influencer
          ? inspiration.influencer.toString()
          : null;
        if (inspiration?.playlists && inspiration.playlists.length > 0) {
          savedPlaylistIds = inspiration.playlists.map((id) => 
            typeof id === 'string' ? new mongoose.Types.ObjectId(id) : id
          );
        }
      }
      // If influencerId is provided (modal call), savedPlaylistIds remains null (show all playlists)

      if (!selectedInfluencerId) {
        return res.status(200).json({
          message: "No influencer selected",
          data: [],
          pagination: hasPagination ? {
            pageNum: pageNumValue,
            perPage: perPageValue,
            totalItems: 0,
          } : undefined,
        });
      }

      const query = {
        ...filter,
        owner: selectedInfluencerId,
        isPrivate: false,
      };

      // Filter to only saved playlists if this is a page call (influencerId not provided)
      if (savedPlaylistIds && savedPlaylistIds.length > 0) {
        query._id = { $in: savedPlaylistIds };
      }

      if (search) {
        query.$or = [
          { name: { $regex: search, $options: "i" } },
        ];
      }

      const totalPlaylists = await PLAYLIST_MODEL.countDocuments(query);

      // Build query with conditional pagination
      let playlistsQuery = PLAYLIST_MODEL.find(query)
        .sort(sortBy === "newest" ? { createdAt: -1 } : { createdAt: 1 });
      
      // Only apply pagination if params were provided
      if (hasPagination) {
        playlistsQuery = playlistsQuery
          .skip((pageNumValue - 1) * perPageValue)
          .limit(perPageValue);
      }

      const playlists = await playlistsQuery
        .populate("owner", "name profilePic role")
        .populate("videos");

      // Add follower count to each playlist
      const playlistsWithCounts = playlists.map((playlist) => {
        const playlistObj = playlist.toObject();
        playlistObj.followerCount =
          playlist.followingPlayLists?.length || 0;
        playlistObj.videoCount = playlist.videos?.length || 0;
        return playlistObj;
      });

      return res.status(200).json({
        message: "Playlists retrieved successfully",
        data: addCloudFrontUrl(playlistsWithCounts),
        pagination: hasPagination ? {
          pageNum: pageNumValue,
          perPage: perPageValue,
          totalItems: totalPlaylists,
        } : undefined,
      });
    } catch (error) {
      return handleError(error, res);
    }
  },

  TOGGLE_VIDEO_FEATURED: async (req, res) => {
    try {
      const { id } = req.params;

      const video = await VIDEO_MODEL.findById(id);
      if (!video) {
        return res.status(404).json({
          status: "error",
          message: "Video not found",
        });
      }

      // Get current inspiration config
      const inspiration = await getOrCreateInspiration();
      if (!inspiration || !inspiration.tag) {
        return res.status(400).json({
          status: "error",
          message: "No tag selected. Please select a tag first.",
        });
      }

      // Check if video belongs to selected tag
      if (!video.tags || !video.tags.includes(inspiration.tag)) {
        return res.status(400).json({
          status: "error",
          message: "Video does not belong to the selected tag",
        });
      }

      const currentFeaturedCount = inspiration.videos?.length || 0;
      const isCurrentlyFeatured = inspiration.videos?.some(
        (vid) => vid.toString() === id
      );

      // If trying to feature and already at max, return error
      if (!isCurrentlyFeatured && currentFeaturedCount >= 6) {
        return res.status(400).json({
          status: "error",
          message: "Maximum 6 featured videos allowed. Please unfeature one first.",
        });
      }

      // Toggle featured status
      if (isCurrentlyFeatured) {
        // Check minimum requirement before unfeaturing
        const allVideosForTag = await VIDEO_MODEL.countDocuments({
          tags: inspiration.tag,
          isDeleted: false,
        });
        const minRequired = Math.min(3, allVideosForTag);
        const currentCount = inspiration.videos?.length || 0;
        
        if (currentCount <= minRequired) {
          return res.status(400).json({
            status: "error",
            message: `Minimum ${minRequired} video(s) required. Cannot unfeature this video.`,
          });
        }
        
        // Unfeature
        await VIDEO_MODEL.findByIdAndUpdate(id, { isFeatured: false });
        inspiration.videos = inspiration.videos.filter(
          (vid) => vid.toString() !== id
        );
      } else {
        // Feature
        await VIDEO_MODEL.findByIdAndUpdate(id, { isFeatured: true });
        inspiration.videos.push(new mongoose.Types.ObjectId(id));
      }

      await inspiration.save();

      return res.status(200).json({
        message: "Video featured status updated successfully",
        data: {
          isFeatured: !isCurrentlyFeatured,
        },
      });
    } catch (error) {
      return handleError(error, res);
    }
  },

  TOGGLE_PLAYLIST_FEATURED: async (req, res) => {
    try {
      const { id } = req.params;

      const playlist = await PLAYLIST_MODEL.findById(id);
      if (!playlist) {
        return res.status(404).json({
          status: "error",
          message: "Playlist not found",
        });
      }

      // Get current inspiration config
      const inspiration = await getOrCreateInspiration();
      if (!inspiration || !inspiration.influencer) {
        return res.status(400).json({
          status: "error",
          message: "No influencer selected. Please select an influencer first.",
        });
      }

      const influencerId = inspiration.influencer.toString();

      // Check if playlist belongs to selected influencer
      if (playlist.owner.toString() !== influencerId.toString()) {
        return res.status(400).json({
          status: "error",
          message: "Playlist does not belong to the selected influencer",
        });
      }

      const currentFeaturedCount = inspiration.playlists?.length || 0;
      const isCurrentlyFeatured = inspiration.playlists?.some(
        (pl) => pl.toString() === id
      );

      // If trying to feature and already at max, return error
      if (!isCurrentlyFeatured && currentFeaturedCount >= 2) {
        return res.status(400).json({
          status: "error",
          message: "Maximum 2 featured playlists allowed. Please unfeature one first.",
        });
      }

      // Toggle featured status
      if (isCurrentlyFeatured) {
        // Unfeature
        await PLAYLIST_MODEL.findByIdAndUpdate(id, { isFeatured: false });
        inspiration.playlists = inspiration.playlists.filter(
          (pl) => pl.toString() !== id
        );
      } else {
        // Feature
        await PLAYLIST_MODEL.findByIdAndUpdate(id, { isFeatured: true });
        inspiration.playlists.push(new mongoose.Types.ObjectId(id));
      }

      await inspiration.save();

      return res.status(200).json({
        message: "Playlist featured status updated successfully",
        data: {
          isFeatured: !isCurrentlyFeatured,
        },
      });
    } catch (error) {
      return handleError(error, res);
    }
  },
};

