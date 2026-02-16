const { default: mongoose } = require("mongoose");
const {
  VIDEO_MODEL,
  VIDEO_REPORT_MODEL,
  SPONSORS_MODEL,
  USER_MODEL,
  PLAYLIST_MODEL,
  VIDEO_LIKE_MODEL,
  VIDEO_WATCH_TIME_MODEL,
  VIDEO_IMPRESSION_MODEL,
  COMMENT_MODEL,
  DOT_NOTIFICATION_MODEL,
} = require("../../../models");
const handleError = require("../../../utils/errorHandler");
const parseFilter = require("../../../utils/parseFilter");

const formatNumber = (num) => {
  if (num >= 1_000_000_000)
    return (num / 1_000_000_000).toFixed(1).replace(/\.0$/, "") + "B";
  if (num >= 1_000_000)
    return (num / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (num >= 1_000) return (num / 1_000).toFixed(1).replace(/\.0$/, "") + "k";
  return num.toString();
};

module.exports = {
  FIND_ALL_VIDEOS: async (req, res) => {
    try {
      const {
        pageNum = 1,
        perPage = 10,
        search = "",
        sortBy = "newest",
      } = req.query;

      const filter = parseFilter(req.query.filter, res);
      if (filter === null) return;

      const query = { ...filter };

      if (search) {
        // Find owner IDs matching search term
        const matchingOwners = await USER_MODEL.find({
          name: { $regex: search, $options: "i" },
        }).select("_id");

        const ownerIds = matchingOwners.map((o) => o._id);

        query.$or = [
          { name: { $regex: search, $options: "i" } },
          { caption: { $regex: search, $options: "i" } },
          { tags: { $regex: search, $options: "i" } },
          { owner: { $in: ownerIds } },
        ];
      }

      const totalItems = await VIDEO_MODEL.countDocuments(query);
      const videos = await VIDEO_MODEL.find(query)
        .sort(sortBy === "newest" ? { createdAt: -1 } : { createdAt: 1 })
        .skip((pageNum - 1) * perPage)
        .limit(Number(perPage))
        .populate("owner", ["name", "profilePic", "connectyCubeId"])
        .populate("category");

      return res.json({
        data: videos,
        pagination: {
          pageNum: Number(pageNum),
          perPage: Number(perPage),
          totalItems,
        },
      });
    } catch (error) {
      return handleError(error, res);
    }
  },
  FIND_ALL_reported_videos: async (req, res) => {
    try {
      const {
        pageNum = 1,
        perPage = 10,
        search = "",
        sortBy = "newest",
      } = req.query;

      const filter = parseFilter(req.query.filter, res);
      if (filter === null) return;

      const query = { ...filter };

      if (search) {
        query.$or = [
          { "report.reason": { $regex: search, $options: "i" } },
          { "report.detail": { $regex: search, $options: "i" } },
        ];
      }

      const totalItems = await VIDEO_REPORT_MODEL.countDocuments(query);

      const reportedVideos = await VIDEO_REPORT_MODEL.find(query)
        .sort(sortBy === "newest" ? { createdAt: -1 } : { createdAt: 1 })
        .skip((pageNum - 1) * perPage)
        .limit(Number(perPage))
        .populate({
          path: "video",
          populate: { path: "category" },
        })
        .populate({
          path: "user",
          select: "name email profilePic",
        });

      const userIds = reportedVideos.map((report) => report.user._id);
      const userReportCounts = await VIDEO_REPORT_MODEL.aggregate([
        { $match: { user: { $in: userIds } } },
        { $group: { _id: "$user", reportCount: { $sum: 1 } } },
      ]);

      const influencerReportCounts = await VIDEO_REPORT_MODEL.aggregate([
        {
          $lookup: {
            from: "videos",
            localField: "video",
            foreignField: "_id",
            as: "videoData",
          },
        },
        { $unwind: "$videoData" },
        { $group: { _id: "$videoData.owner", reportCount: { $sum: 1 } } },
      ]);

      const videoIds = reportedVideos
        .map((report) => report.video?._id || report._doc?.video)
        .filter(Boolean);
      const videoOwnerMap = new Map();

      if (videoIds.length > 0) {
        const videoOwners = await VIDEO_MODEL.find(
          { _id: { $in: videoIds } },
          { _id: 1, owner: 1 }
        ).lean();

        videoOwners.forEach((video) => {
          videoOwnerMap.set(video._id.toString(), video.owner);
        });
      }

      const userReportMap = new Map(
        userReportCounts.map((item) => [item._id.toString(), item.reportCount])
      );

      const influencerReportMap = new Map(
        influencerReportCounts.map((item) => [
          item._id.toString(),
          item.reportCount,
        ])
      );

      const enrichedReportedVideos = await Promise.all(
        reportedVideos.map(async (report) => {
          const userReportCount =
            userReportMap.get(report.user._id.toString()) || 0;

          let influencerReportCount = 0;
          let videoOwnerId = null;

          if (report.video && report.video.owner) {
            videoOwnerId = report.video.owner.toString();
          } else {
            const videoId = report.video?._id || report._doc?.video;
            if (videoId) {
              videoOwnerId = videoOwnerMap.get(videoId.toString());
              if (videoOwnerId) {
                videoOwnerId = videoOwnerId.toString();
              }
            }
          }

          if (videoOwnerId) {
            influencerReportCount = influencerReportMap.get(videoOwnerId) || 0;
          }

          const videoOwnerData = await USER_MODEL.findById(
            videoOwnerId,
            "name email profilePic"
          );

          return {
            ...report.toObject(),
            userReportCount,
            influencerReportCount,
            videoOwner: videoOwnerData,
          };
        })
      );

      return res.json({
        data: enrichedReportedVideos,
        pagination: {
          pageNum: Number(pageNum),
          perPage: Number(perPage),
          totalItems,
        },
      });
    } catch (error) {
      return handleError(error, res);
    }
  },
  GET_BY_ID: async (req, res) => {
    try {
      const reportId = req.params.id;

      const videoReport = await VIDEO_REPORT_MODEL.findById(reportId)
        .populate({
          path: "video",
          populate: { path: "category" },
        })
        .populate({
          path: "user",
          select: "name email profilePic",
        });

      if (!videoReport) {
        return res.status(404).json({
          status: "error",
          message: "Video report not found",
        });
      }

      const userReportCountAgg = await VIDEO_REPORT_MODEL.aggregate([
        { $match: { user: videoReport.user._id } },
        { $group: { _id: "$user", reportCount: { $sum: 1 } } },
      ]);
      const userReportCount =
        userReportCountAgg.length > 0 ? userReportCountAgg[0].reportCount : 0;

      let influencerReportCount = 0;
      let videoOwnerId = null;

      if (videoReport.video && videoReport.video.owner) {
        videoOwnerId = videoReport.video.owner.toString();

        const influencerReportCountAgg = await VIDEO_REPORT_MODEL.aggregate([
          {
            $lookup: {
              from: "videos",
              localField: "video",
              foreignField: "_id",
              as: "videoData",
            },
          },
          { $unwind: "$videoData" },
          { $match: { "videoData.owner": videoReport.video.owner } },
          { $group: { _id: "$videoData.owner", reportCount: { $sum: 1 } } },
        ]);

        influencerReportCount =
          influencerReportCountAgg.length > 0
            ? influencerReportCountAgg[0].reportCount
            : 0;
      }

      let videoOwnerData = null;
      if (videoOwnerId) {
        videoOwnerData = await USER_MODEL.findById(
          videoOwnerId,
          "name email profilePic"
        );
      }

      return res.status(200).json({
        type: "success",
        message: "Video report retrieved successfully",
        data: {
          ...videoReport.toObject(),
          userReportCount,
          influencerReportCount,
          videoOwner: videoOwnerData || null,
        },
      });
    } catch (error) {
      return handleError(error, res);
    }
  },

  DELETE_reported_video: async (req, res) => {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({ message: "Report Video ID is required" });
      }

      const reportedVideo = await VIDEO_REPORT_MODEL.findOne({
        _id: id,
      });

      if (!reportedVideo) {
        return res.status(404).json({ message: "Reported video not found" });
      }

      await VIDEO_REPORT_MODEL.deleteOne({ _id: id });

      return res
        .status(200)
        .json({ message: "Reported video deleted successfully" });
    } catch (error) {
      return handleError(error, res);
    }
  },
  GET_NOTIFICATIONS: async (req, res) => {
    try {
      const { type } = req.query;
      const query = { isRead: false };
      
      if (type) {
        query.type = type;
      }

      const notifications = await DOT_NOTIFICATION_MODEL.find(query);

      res.status(200).json({
        message: "Notifications fetched successfully",
        data: notifications,
      });
    } catch (error) {
      res.status(500).json({ message: "Error fetching notifications", error });
    }
  },
  MARK_ALL_AS_READ: async (req, res) => {
    try {
      const { type } = req.query;
      const query = { isRead: false };
      
      if (type) {
        query.type = type;
      }

      const result = await DOT_NOTIFICATION_MODEL.updateMany(
        query,
        { $set: { isRead: true } }
      );

      res.status(200).json({
        message: "All unread notifications marked as read",
        modifiedCount: result.modifiedCount,
      });
    } catch (error) {
      res.status(500).json({ message: "Error updating notifications", error });
    }
  },
  FIND_VIDEOS_BY_USER: async (req, res) => {
    try {
      const { userId } = req.params;
      if (!userId) {
        return res
          .status(400)
          .json({ message: "userId parameter is required" });
      }

      const {
        pageNum = 1,
        perPage = 10,
        sortBy = "newest",
        search = "",
        filter: filterQuery,
      } = req.query;

      const filter = parseFilter(filterQuery, res);
      if (filter === null) return;

      const query = {
        owner: mongoose.Types.ObjectId(userId),
        isDeleted: false,
        ...filter,
      };

      if (search) {
        query.$or = [
          { name: { $regex: search, $options: "i" } },
          { caption: { $regex: search, $options: "i" } },
          { tags: { $regex: search, $options: "i" } },
        ];
      }

      const totalItems = await VIDEO_MODEL.countDocuments(query);

      const videos = await VIDEO_MODEL.find(query)
        .sort(sortBy === "newest" ? { createdAt: -1 } : { createdAt: 1 })
        .skip((pageNum - 1) * perPage)
        .limit(Number(perPage))
        .populate("owner", ["name", "profilePic", "connectyCubeId"])
        .populate("category");

      return res.json({
        data: videos,
        pagination: {
          pageNum: Number(pageNum),
          perPage: Number(perPage),
          totalItems,
        },
      });
    } catch (error) {
      return handleError(error, res);
    }
  },
  GET_VIDEO_BY_ID: async (req, res) => {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({ message: "Video ID is required" });
      }

      const video = await VIDEO_MODEL.findById(id)
        .populate("owner", ["name", "profilePic", "connectyCubeId"])
        .populate("category")
        .lean();

      if (!video) {
        return res.status(404).json({ message: "Video not found" });
      }

      const comments = await COMMENT_MODEL.find({
        videoId: id,
        isDeleted: false,
      })
        .populate("userId", ["name", "profilePic"])
        .sort({ createdAt: -1 })
        .lean();

      video.comments = comments;

      return res.status(200).json({
        message: "Video retrieved successfully",
        data: video,
      });
    } catch (error) {
      return handleError(error, res);
    }
  },

  UPDATE_VIDEO_BY_ID: async (req, res) => {
    try {
      const { id } = req.params;
      const video = await VIDEO_MODEL.findOneAndUpdate({ _id: id }, req.body, {
        new: true,
      });

      if (!video) {
        return res.status(404).json({
          status: "error",
          message: "Video not found",
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

  DELETE_VIDEO_BY_ID: async (req, res) => {
    try {
      const { id } = req.params;

      // First check if the video exists before doing any operations
      const video = await VIDEO_MODEL.findById(id);
      if (!video) {
        return res.status(404).json({
          status: "error",
          message: "Video not found",
        });
      }

      // Update any sponsors referencing this video to set videoId to null
      try {
        await SPONSORS_MODEL.updateMany(
          { videoId: id },
          { $set: { videoId: null } }
        );
      } catch (error) {
        console.error("Error updating sponsors:", error);
        // Continue with video deletion even if sponsor update fails
      }

      // Now delete the video
      const deletedVideo = await VIDEO_MODEL.findByIdAndDelete(id);
      await PLAYLIST_MODEL.updateMany(
        { videos: id },
        { $pull: { videos: id } }
      );

      return res.status(200).json({
        message: "Video deleted successfully",
        data: deletedVideo,
      });
    } catch (error) {
      return handleError(error, res);
    }
  },

  GET_VIDEO_GRAPH_DATA: async (req, res) => {
    try {
      // Get the total number of videos
      const totalVideos = await VIDEO_MODEL.countDocuments({});

      // Get all videos with only the createdAt field
      const allVideos = await VIDEO_MODEL.aggregate([
        {
          $project: {
            createdAt: 1, // Include only the createdAt field
          },
        },
        {
          $sort: { createdAt: -1 }, // Sort by createdAt in descending order
        },
      ]);

      return res.status(200).json({
        message: "Video graph data retrieved successfully",
        data: {
          totalVideos: totalVideos,
          videos: allVideos,
        },
      });
    } catch (error) {
      return handleError(error, res);
    }
  },

  GET_USER_VIDEO_ANALYTICS: async (req, res) => {
    try {
      const { id: userId } = req.params;
      if (!userId)
        return res.status(400).json({ message: "userId is required" });

      const today = new Date();
      const end = new Date(today.setUTCHours(23, 59, 59, 999));
      const start = new Date(end);
      start.setUTCDate(end.getUTCDate() - 6);
      start.setUTCHours(0, 0, 0, 0);

      const userVideos = await VIDEO_MODEL.find(
        {
          owner: mongoose.Types.ObjectId(userId),
          isDeleted: false,
        },
        { _id: 1 }
      );
      const videoIds = userVideos.map((v) => v._id);

      const fetchDaily = async (Model, matchField, sumField) => {
        const match = {
          [matchField]: { $in: videoIds },
          date: { $gte: start, $lte: end },
        };

        const groupStage = {
          _id: { day: { $dayOfMonth: "$date" } },
          total: sumField ? { $sum: `$${sumField}` } : { $sum: 1 },
        };

        const result = await Model.aggregate([
          { $match: match },
          { $group: groupStage },
          {
            $project: {
              day: { $toString: "$_id.day" },
              total: 1,
              _id: 0,
            },
          },
          { $sort: { day: 1 } },
        ]);
        return result;
      };

      const fillMissingDays = (data, start, end) => {
        const result = [];
        const map = {};

        data.forEach((d) => {
          map[d.day] = d.total;
        });

        let current = new Date(start);
        while (current <= end) {
          const day = current.getUTCDate().toString();
          result.push({
            day,
            total: map[day] || 0,
          });

          current.setUTCDate(current.getUTCDate() + 1);
        }

        return result;
      };

      const trend = (arr) => {
        if (arr.length < 2) return "neutral";
        const yesterday = arr[arr.length - 2].total;
        const today = arr[arr.length - 1].total;

        if (today > yesterday) return "up";
        if (today < yesterday) return "down";
        return "neutral";
      };
      const getTrend = (current, previous) => {
        if (current > previous) return "up";
        if (current < previous) return "down";
        return "neutral";
      };

      const average = (arr) =>
        arr.length ? arr.reduce((sum, d) => sum + d.total, 0) / arr.length : 0;

      const formatTime = (seconds) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        return `${h}h ${m}m`;
      };

      // Monthly video data (past 7 months including current)
      const monthEnd = new Date();
      const monthStart = new Date();
      monthStart.setUTCMonth(monthEnd.getUTCMonth() - 6);
      monthStart.setUTCDate(1);
      monthStart.setUTCHours(0, 0, 0, 0);

      const getMonthName = (idx) =>
        new Date(2000, idx, 1).toLocaleString("en-US", { month: "short" });

      const monthlyRaw = await VIDEO_MODEL.aggregate([
        {
          $match: {
            owner: mongoose.Types.ObjectId(userId),
            isDeleted: false,
            createdAt: { $gte: monthStart, $lte: monthEnd },
          },
        },
        {
          $project: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
            day: { $dayOfMonth: "$createdAt" },
          },
        },
        {
          $project: {
            year: 1,
            month: 1,
            half: {
              $cond: [{ $lte: ["$day", 15] }, "first", "second"],
            },
          },
        },
        {
          $group: {
            _id: {
              year: "$year",
              month: "$month",
              half: "$half",
            },
            total: { $sum: 1 },
          },
        },
      ]);

      const monthMap = {};
      monthlyRaw.forEach((item) => {
        const key = `${item._id.year}-${item._id.month}-${item._id.half}`;
        monthMap[key] = item.total;
      });

      const monthlyData = [];
      let prevVideos = 0;

      const monthCursor = new Date(monthStart);
      while (
        monthCursor.getUTCFullYear() < monthEnd.getUTCFullYear() ||
        (monthCursor.getUTCFullYear() === monthEnd.getUTCFullYear() &&
          monthCursor.getUTCMonth() <= monthEnd.getUTCMonth())
      ) {
        const year = monthCursor.getUTCFullYear();
        const monthNum = monthCursor.getUTCMonth() + 1;
        const monthName = getMonthName(monthCursor.getUTCMonth());

        const firstHalfKey = `${year}-${monthNum}-first`;
        const secondHalfKey = `${year}-${monthNum}-second`;

        const firstHalf = monthMap[firstHalfKey] || 0;
        const secondHalf = monthMap[secondHalfKey] || 0;
        const total = firstHalf + secondHalf;

        monthlyData.push({
          month: monthName,
          year,
          videosCount: total,
          firstHalf,
          secondHalf,
          trend: getTrend(firstHalf + secondHalf, prevVideos),
        });

        prevVideos = total;
        monthCursor.setUTCMonth(monthCursor.getUTCMonth() + 1);
      }

      const currentMonthVideos =
        monthlyData[monthlyData.length - 1]?.videos || 0;
      const prevMonthVideos =
        monthlyData.length >= 2
          ? monthlyData[monthlyData.length - 2].videos
          : 0;
      const trendVideosMonth =
        currentMonthVideos > prevMonthVideos
          ? "up"
          : currentMonthVideos < prevMonthVideos
          ? "down"
          : "neutral";

      const [stats, playlists, videos7d] = await Promise.all([
        VIDEO_MODEL.aggregate([
          {
            $match: {
              owner: mongoose.Types.ObjectId(userId),
              isDeleted: false,
            },
          },
          { $group: { _id: null, totalVideos: { $sum: 1 } } },
        ]),
        PLAYLIST_MODEL.countDocuments({ owner: userId }),
        VIDEO_MODEL.countDocuments({
          owner: mongoose.Types.ObjectId(userId),
          isDeleted: false,
          createdAt: { $gte: start, $lte: end },
        }),
      ]);

      const publicByDayRaw = await fetchDaily(VIDEO_MODEL, "owner", null);
      const likesByDayRaw = await fetchDaily(VIDEO_LIKE_MODEL, "video", null);
      const watchByDayRaw = await fetchDaily(
        VIDEO_WATCH_TIME_MODEL,
        "video",
        "duration"
      );
      const viewsByDayRaw = await fetchDaily(
        VIDEO_IMPRESSION_MODEL,
        "video",
        null
      );

      const playlistFollowDailyRaw = await PLAYLIST_MODEL.aggregate([
        {
          $match: {
            owner: mongoose.Types.ObjectId(userId),
          },
        },
        { $unwind: "$followingPlayLists" },
        {
          $match: {
            "followingPlayLists.date": { $gte: start, $lte: end },
          },
        },
        {
          $group: {
            _id: { day: { $dayOfMonth: "$followingPlayLists.date" } },
            total: { $sum: 1 },
          },
        },
        {
          $project: {
            day: { $toString: "$_id.day" },
            total: 1,
            _id: 0,
          },
        },
        { $sort: { day: 1 } },
      ]);

      // Fill missing days
      const publicByDay = fillMissingDays(publicByDayRaw, start, end);
      const likesByDay = fillMissingDays(likesByDayRaw, start, end);
      const watchByDay = fillMissingDays(watchByDayRaw, start, end);
      const viewsByDay = fillMissingDays(viewsByDayRaw, start, end);
      const playlistFollowDaily = fillMissingDays(
        playlistFollowDailyRaw,
        start,
        end
      );

      // Averages
      const avgPub = average(publicByDay);
      const avgLikes = average(likesByDay);
      const avgWatch = average(watchByDay);
      const avgViews = average(viewsByDay);
      const avgPlaylistFollows = average(playlistFollowDaily);

      return res.json({
        message: "User video analytics",
        userId,
        allTime: {
          totalVideos: stats[0]?.totalVideos || 0,
          totalPlaylists: playlists,
          lastWeekVideos: videos7d,
        },
        dailyAverage: {
          avgPublicVideos: formatNumber(Math.round(avgPub)),
          avgDailyLikes: formatNumber(Math.round(avgLikes)),
          avgDailyWatchTime: formatTime(avgWatch),
          avgDailyViews: formatNumber(Math.round(avgViews)),
          avgPlaylistFollows: formatNumber(Math.round(avgPlaylistFollows)),
          trendPublicVideos: trend(publicByDay),
          trendLikes: trend(likesByDay),
          trendWatchTime: trend(watchByDay),
          trendViews: trend(viewsByDay),
          trendPlaylistFollows: trend(playlistFollowDaily),
        },
        graphData: {
          publicVideos: publicByDay.map((d) => ({
            day: d.day,
            views: d.total,
          })),
          likes: likesByDay.map((d) => ({ day: d.day, views: d.total })),
          watchTime: watchByDay.map((d) => ({ day: d.day, views: d.total })),
          views: viewsByDay.map((d) => ({ day: d.day, views: d.total })),
          playlistFollows: playlistFollowDaily.map((d) => ({
            day: d.day,
            views: d.total,
          })),
        },
        monthlyData: {
          monthlyVideoCounts: monthlyData,
          currentMonthVideos,
          trendVideosMonth,
        },
      });
    } catch (err) {
      return handleError(err, res);
    }
  },
};
