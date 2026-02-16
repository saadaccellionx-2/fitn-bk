const {
  USER_MODEL,
  VIDEO_MODEL,
  FOLLOWED_PLAYLIST_MODEL,
  PLAYLIST_MODEL,
  USER_ACTIVITY_MODEL,
  USER_ADDRESS_MODEL,
} = require("../../../models");
const handleError = require("../../../utils/errorHandler");
const {
  getWeeksInMonth,
  getWeekDays,
  getMonthsInYear,
  getYearsRange,
  getDaysInMonth,
  getHoursInDay,
  getDaysInRange,
  getWeeksInRange,
} = require("../../../helpers/dateRangeTz");

// Helper function to validate 30-day range (29-31 days, consecutive)
const validate30DayRange = (startDate, endDate) => {
  if (!startDate || !endDate) {
    return { valid: false, message: "startDate and endDate are required for 30day range" };
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  // Ensure start <= end
  if (start > end) {
    return { valid: false, message: "startDate must be before or equal to endDate" };
  }

  // Calculate the difference in days
  const diffTime = end.getTime() - start.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include both start and end days

  // Validate: must be 29, 30, or 31 consecutive days
  if (diffDays < 29) {
    return { valid: false, message: `Date range must be at least 29 days. Current range is ${diffDays} day(s).` };
  }
  if (diffDays > 31) {
    return { valid: false, message: `Date range cannot exceed 31 days. Current range is ${diffDays} day(s).` };
  }

  return { valid: true };
};

module.exports = {
  GET_DASHBOARD_TOTAL: async (req, res) => {
    try {
      const { DateTime } = require("luxon");
      // Parse dates from query params (expected format: ISO string)
      let { startDate, endDate } = req.query;

      const now = DateTime.now().setZone(req.timezone);

      // Validate and convert startDate and endDate or fallback to last 30 days
      let start = startDate ? DateTime.fromISO(startDate, { zone: req.timezone }) : now.minus({ days: 30 }).startOf("day");
      let end = endDate ? DateTime.fromISO(endDate, { zone: req.timezone }) : now;

      // Ensure start <= end
      if (start > end) {
        return res
          .status(400)
          .json({ message: "startDate must be before endDate" });
      }

      const startJS = start.toJSDate();
      const endJS = end.toJSDate();

      // Count total users
      const total = await USER_MODEL.countDocuments({});

      // Count users with role 'user' (excluding deleted users)
      const totalUsers = await USER_MODEL.countDocuments({ role: "user", isDeleted: false });

      // Count users with role 'user' (including deleted users)
      const totalUsersIncludingDeleted = await USER_MODEL.countDocuments({ role: "user" });

      // Count users with role 'influencer' (excluding deleted users)
      const totalInfluencers = await USER_MODEL.countDocuments({
        role: "influencer",
        isDeleted: false,
      });

      // Count users with role 'influencer' (including deleted users)
      const totalInfluencersIncludingDeleted = await USER_MODEL.countDocuments({
        role: "influencer",
      });

      // Count new users with role 'user' created within the given date range (excluding deleted users)
      const newUsers = await USER_MODEL.countDocuments({
        role: "user",
        isDeleted: false,
        createdAt: { $gte: startJS, $lte: endJS },
      });

      const todayStart = now.startOf("day").toJSDate();
      const sevenDaysAgo = now.minus({ days: 7 }).startOf("day").toJSDate();

      const dailyVideos = await VIDEO_MODEL.countDocuments({
        createdAt: { $gte: todayStart, $lte: now.toJSDate() },
        isDeleted: false,
      });

      const weeklyVideos = await VIDEO_MODEL.countDocuments({
        createdAt: { $gte: sevenDaysAgo, $lte: now.toJSDate() },
        isDeleted: false,
      });

      return res.status(200).json({
        total,
        totalUsers,
        totalUsersIncludingDeleted,
        newUsers,
        totalInfluencers,
        totalInfluencersIncludingDeleted,
        dailyVideos,
        weeklyVideos,
      });
    } catch (error) {
      return handleError(error, res);
    }
  },

  GET_DASHBOARD_NEW_USERS: async (req, res) => {
    try {
      const { DateTime } = require("luxon");
      let { startDate, endDate } = req.query;
      const now = DateTime.now().setZone(req.timezone);

      // Convert to DateTime objects or use defaults
      let start = startDate ? DateTime.fromISO(startDate, { zone: req.timezone }) : now.minus({ days: 30 }).startOf("day");
      let end = endDate ? DateTime.fromISO(endDate, { zone: req.timezone }) : now;

      // Ensure valid range
      if (start > end) {
        return res.status(400).json({
          message: "startDate must be before or equal to endDate",
        });
      }

      // Count users with role 'user' created within date range (excluding deleted users)
      const newUsers = await USER_MODEL.countDocuments({
        role: "user",
        isDeleted: false,
        createdAt: { $gte: start.toJSDate(), $lte: end.toJSDate() },
      });

      return res.status(200).json({
        newUsers,
      });
    } catch (error) {
      return handleError(error, res);
    }
  },

  GET_DASHBOARD_MONTH_SEGMENTS: async (req, res) => {
    try {
      const { month } = req.query; // e.g. '2025-01'
      if (!month) {
        return res
          .status(400)
          .json({ message: "Month is required in YYYY-MM format" });
      }

      const [yearStr, monthStr] = month.split("-");
      const year = parseInt(yearStr, 10);
      const mon = parseInt(monthStr, 10);

      if (!year || !mon || mon < 1 || mon > 12) {
        return res.status(400).json({ message: "Invalid month format" });
      }

      const weeks = getWeeksInMonth(year, mon, req.timezone);
      const monthStart = new Date(year, mon - 1, 1);
      const monthEnd = new Date(year, mon, 0, 23, 59, 59, 999);

      // Total visitors in the month
      const visitors = await USER_MODEL.countDocuments({
        createdAt: { $gte: monthStart, $lte: monthEnd },
      });

      // Weekly segments count
      const segments = [];
      for (const week of weeks) {
        const count = await USER_MODEL.countDocuments({
          createdAt: { $gte: week.start, $lte: week.end },
        });
        segments.push(count);
      }

      const response = {
        [month]: {
          visitors,
          segments,
        },
      };

      return res.json(response);
    } catch (error) {
      return handleError(error, res);
    }
  },

  GET_USER_INFLUENCER_ANALYTICS: async (req, res) => {
    try {
      const { timeRange, selectedDate, startDate, endDate } = req.query;

      if (!timeRange) {
        return res.status(400).json({ message: "timeRange is required" });
      }

      const now = new Date();
      let periods = [];
      let data = [];

      // Helper function to process a period with future date handling and optimized queries
      const processPeriod = async (period, periodName) => {
        // For periods entirely in the future, return null values (don't query database)
        if (period.start > now) {
          return {
            period: periodName,
            users: null,
            influencers: null,
          };
        }

        // Cap period.end to now if it extends into the future
        const effectiveEnd = period.end > now ? now : period.end;
        const effectiveStart = period.start;

        // Use aggregation pipeline to get both counts in a single query
        const [result] = await USER_MODEL.aggregate([
          {
            $facet: {
              users: [
                {
                  $match: {
                    role: "user",
                    isDeleted: false,
                    createdAt: { $gte: effectiveStart, $lte: effectiveEnd },
                  },
                },
                { $count: "count" },
              ],
              influencers: [
                {
                  $match: {
                    role: "influencer",
                    isDeleted: false,
                    createdAt: { $gte: effectiveStart, $lte: effectiveEnd },
                  },
                },
                { $count: "count" },
              ],
            },
          },
        ]);

        return {
          period: periodName,
          users: result.users[0]?.count || 0,
          influencers: result.influencers[0]?.count || 0,
        };
      };

      switch (timeRange) {
        case "weekly": {
          if (!selectedDate) {
            return res
              .status(400)
              .json({ message: "selectedDate is required for weekly view" });
          }

          periods = getWeekDays(selectedDate, req.timezone);

          // Process all periods in parallel for better performance
          const periodResults = await Promise.all(
            periods.map((period) => processPeriod(period, period.name))
          );
          data.push(...periodResults);
          break;
        }

        case "monthly": {
          if (!selectedDate) {
            return res
              .status(400)
              .json({ message: "selectedDate is required for monthly view" });
          }

          const date = new Date(selectedDate);
          const year = date.getFullYear();
          const month = date.getMonth() + 1;

          const days = getDaysInMonth(year, month, req.timezone);

          // Process all days in parallel for better performance
          const dayResults = await Promise.all(
            days.map(async (day) => {
              const result = await processPeriod(day, day.name.split(" ")[1]);
              return result;
            })
          );
          data.push(...dayResults);
          break;
        }

        case "yearly": {
          if (!selectedDate) {
            return res
              .status(400)
              .json({ message: "selectedDate is required for yearly view" });
          }

          const date = new Date(selectedDate);
          const year = date.getFullYear();

          periods = getMonthsInYear(year, req.timezone);

          // Process all periods in parallel for better performance
          const periodResults = await Promise.all(
            periods.map((period) => processPeriod(period, period.name))
          );
          data.push(...periodResults);
          break;
        }

        case "daily": {
          if (!selectedDate) {
            return res
              .status(400)
              .json({ message: "selectedDate is required for daily view" });
          }

          periods = getHoursInDay(selectedDate, req.timezone);

          // Process all periods in parallel for better performance
          const periodResults = await Promise.all(
            periods.map((period) => processPeriod(period, period.name))
          );
          data.push(...periodResults);
          break;
        }

        case "alltime": {
          periods = getYearsRange(req.timezone);

          // Process all periods in parallel for better performance
          const periodResults = await Promise.all(
            periods.map((period) => processPeriod(period, period.name))
          );
          data.push(...periodResults);
          break;
        }

        case "30day": {
          // Validate 30-day range
          const validation = validate30DayRange(startDate, endDate);
          if (!validation.valid) {
            return res.status(400).json({ message: validation.message });
          }

          periods = getDaysInRange(startDate, endDate, req.timezone);

          // Process all periods in parallel for better performance
          const periodResults = await Promise.all(
            periods.map((period) => processPeriod(period, period.name))
          );
          data.push(...periodResults);
          break;
        }

        case "3month": {
          if (!startDate || !endDate) {
            return res
              .status(400)
              .json({ message: "startDate and endDate are required for 3month range" });
          }

          periods = getWeeksInRange(startDate, endDate, req.timezone);

          // Process all periods in parallel for better performance
          const periodResults = await Promise.all(
            periods.map((period) => processPeriod(period, period.name))
          );
          data.push(...periodResults);
          break;
        }

        default:
          return res.status(400).json({
            message:
              "Invalid timeRange. Use: daily, weekly, monthly, yearly, 30day, 3month, or alltime",
          });
      }

      return res.status(200).json({
        timeRange,
        selectedDate: selectedDate || null,
        startDate: startDate || null,
        endDate: endDate || null,
        data,
      });
    } catch (error) {
      return handleError(error, res);
    }
  },

  GET_USERS_ANALYTICS: async (req, res) => {
    try {
      const { timeRange, selectedDate, startDate, endDate } = req.query;

      if (!timeRange) {
        return res.status(400).json({ message: "timeRange is required" });
      }

      let periods = [];
      let data = [];
      const totalPlaylistsCount = await PLAYLIST_MODEL.countDocuments();
      const totalVideosCount = await VIDEO_MODEL.countDocuments();
      const totalFollowedPlaylistsCount =
        await FOLLOWED_PLAYLIST_MODEL.countDocuments();

      // Helper function to calculate percentage
      const calculatePercentage = (count, total) => {
        return total > 0 ? ((count / total) * 100).toFixed(2) : 0;
      };

      switch (timeRange) {
        case "weekly": {
          if (!selectedDate) {
            return res
              .status(400)
              .json({ message: "selectedDate is required for weekly view" });
          }

          periods = getWeekDays(selectedDate, req.timezone);

          for (const period of periods) {
            // Playlist and video counts for the week
            const [
              weeklyPlaylistsCount,
              weeklyVideosCount,
              weeklyFollowedPlaylistsCount,
            ] = await Promise.all([
              PLAYLIST_MODEL.countDocuments({
                createdAt: { $gte: period.start, $lte: period.end },
              }),
              VIDEO_MODEL.countDocuments({
                createdAt: { $gte: period.start, $lte: period.end },
              }),
              FOLLOWED_PLAYLIST_MODEL.countDocuments({
                followedAt: { $gte: period.start, $lte: period.end },
              }),
            ]);

            // Calculate percentages
            const playlistPercentage = calculatePercentage(
              weeklyPlaylistsCount,
              totalPlaylistsCount
            );
            const videoPercentage = calculatePercentage(
              weeklyVideosCount,
              totalVideosCount
            );
            const followedPlaylistPercentage = calculatePercentage(
              weeklyFollowedPlaylistsCount,
              totalFollowedPlaylistsCount
            );

            data.push({
              name: period.name,
              playlistsCreated: {
                count: weeklyPlaylistsCount,
                percentage: playlistPercentage,
              },
              videosUploaded: {
                count: weeklyVideosCount,
                percentage: videoPercentage,
              },
              followedPlaylists: {
                count: weeklyFollowedPlaylistsCount,
                percentage: followedPlaylistPercentage,
              },
            });
          }
          break;
        }

        case "monthly": {
          if (!selectedDate) {
            return res
              .status(400)
              .json({ message: "selectedDate is required for monthly view" });
          }

          const date = new Date(selectedDate);
          const year = date.getFullYear();
          const month = date.getMonth() + 1;

          const days = getDaysInMonth(year, month, req.timezone);

          for (const day of days) {
            const [
              monthlyPlaylistsCount,
              monthlyVideosCount,
              monthlyFollowedPlaylistsCount,
            ] = await Promise.all([
              PLAYLIST_MODEL.countDocuments({
                createdAt: { $gte: day.start, $lte: day.end },
              }),
              VIDEO_MODEL.countDocuments({
                createdAt: { $gte: day.start, $lte: day.end },
              }),
              FOLLOWED_PLAYLIST_MODEL.countDocuments({
                followedAt: { $gte: day.start, $lte: day.end },
              }),
            ]);

            const playlistPercentage = calculatePercentage(
              monthlyPlaylistsCount,
              totalPlaylistsCount
            );
            const videoPercentage = calculatePercentage(
              monthlyVideosCount,
              totalVideosCount
            );
            const followedPlaylistPercentage = calculatePercentage(
              monthlyFollowedPlaylistsCount,
              totalFollowedPlaylistsCount
            );

            // Extract day number from name (e.g., "Jan 15" -> "15")
            const dayNumber = day.name.split(" ")[1];
            data.push({
              name: dayNumber,
              playlistsCreated: {
                count: monthlyPlaylistsCount,
                percentage: playlistPercentage,
              },
              videosUploaded: {
                count: monthlyVideosCount,
                percentage: videoPercentage,
              },
              followedPlaylists: {
                count: monthlyFollowedPlaylistsCount,
                percentage: followedPlaylistPercentage,
              },
            });
          }
          break;
        }

        case "yearly": {
          if (!selectedDate) {
            return res
              .status(400)
              .json({ message: "selectedDate is required for yearly view" });
          }

          const date = new Date(selectedDate);
          const year = date.getFullYear();

          periods = getMonthsInYear(year, req.timezone);

          for (const period of periods) {
            const [
              yearlyPlaylistsCount,
              yearlyVideosCount,
              yearlyFollowedPlaylistsCount,
            ] = await Promise.all([
              PLAYLIST_MODEL.countDocuments({
                createdAt: { $gte: period.start, $lte: period.end },
              }),
              VIDEO_MODEL.countDocuments({
                createdAt: { $gte: period.start, $lte: period.end },
              }),
              FOLLOWED_PLAYLIST_MODEL.countDocuments({
                followedAt: { $gte: period.start, $lte: period.end },
              }),
            ]);

            const playlistPercentage = calculatePercentage(
              yearlyPlaylistsCount,
              totalPlaylistsCount
            );
            const videoPercentage = calculatePercentage(
              yearlyVideosCount,
              totalVideosCount
            );
            const followedPlaylistPercentage = calculatePercentage(
              yearlyFollowedPlaylistsCount,
              totalFollowedPlaylistsCount
            );

            data.push({
              name: period.name,
              playlistsCreated: {
                count: yearlyPlaylistsCount,
                percentage: playlistPercentage,
              },
              videosUploaded: {
                count: yearlyVideosCount,
                percentage: videoPercentage,
              },
              followedPlaylists: {
                count: yearlyFollowedPlaylistsCount,
                percentage: followedPlaylistPercentage,
              },
            });
          }
          break;
        }

        case "daily": {
          if (!selectedDate) {
            return res
              .status(400)
              .json({ message: "selectedDate is required for daily view" });
          }

          periods = getHoursInDay(selectedDate, req.timezone);

          for (const period of periods) {
            const [
              dailyPlaylistsCount,
              dailyVideosCount,
              dailyFollowedPlaylistsCount,
            ] = await Promise.all([
              PLAYLIST_MODEL.countDocuments({
                createdAt: { $gte: period.start, $lte: period.end },
              }),
              VIDEO_MODEL.countDocuments({
                createdAt: { $gte: period.start, $lte: period.end },
              }),
              FOLLOWED_PLAYLIST_MODEL.countDocuments({
                followedAt: { $gte: period.start, $lte: period.end },
              }),
            ]);

            const playlistPercentage = calculatePercentage(
              dailyPlaylistsCount,
              totalPlaylistsCount
            );
            const videoPercentage = calculatePercentage(
              dailyVideosCount,
              totalVideosCount
            );
            const followedPlaylistPercentage = calculatePercentage(
              dailyFollowedPlaylistsCount,
              totalFollowedPlaylistsCount
            );

            data.push({
              name: period.name,
              playlistsCreated: {
                count: dailyPlaylistsCount,
                percentage: playlistPercentage,
              },
              videosUploaded: {
                count: dailyVideosCount,
                percentage: videoPercentage,
              },
              followedPlaylists: {
                count: dailyFollowedPlaylistsCount,
                percentage: followedPlaylistPercentage,
              },
            });
          }
          break;
        }

        case "alltime": {
          periods = getYearsRange(req.timezone);

          for (const period of periods) {
            const [
              allTimePlaylistsCount,
              allTimeVideosCount,
              allTimeFollowedPlaylistsCount,
            ] = await Promise.all([
              PLAYLIST_MODEL.countDocuments({
                createdAt: { $gte: period.start, $lte: period.end },
              }),
              VIDEO_MODEL.countDocuments({
                createdAt: { $gte: period.start, $lte: period.end },
              }),
              FOLLOWED_PLAYLIST_MODEL.countDocuments({
                followedAt: { $gte: period.start, $lte: period.end },
              }),
            ]);

            const playlistPercentage = calculatePercentage(
              allTimePlaylistsCount,
              totalPlaylistsCount
            );
            const videoPercentage = calculatePercentage(
              allTimeVideosCount,
              totalVideosCount
            );
            const followedPlaylistPercentage = calculatePercentage(
              allTimeFollowedPlaylistsCount,
              totalFollowedPlaylistsCount
            );

            data.push({
              name: period.name,
              playlistsCreated: {
                count: allTimePlaylistsCount,
                percentage: playlistPercentage,
              },
              videosUploaded: {
                count: allTimeVideosCount,
                percentage: videoPercentage,
              },
              followedPlaylists: {
                count: allTimeFollowedPlaylistsCount,
                percentage: followedPlaylistPercentage,
              },
            });
          }
          break;
        }

        case "30day": {
          // Validate 30-day range
          const validation = validate30DayRange(startDate, endDate);
          if (!validation.valid) {
            return res.status(400).json({ message: validation.message });
          }

          periods = getDaysInRange(startDate, endDate, req.timezone);

          for (const period of periods) {
            const [
              dailyPlaylistsCount,
              dailyVideosCount,
              dailyFollowedPlaylistsCount,
            ] = await Promise.all([
              PLAYLIST_MODEL.countDocuments({
                createdAt: { $gte: period.start, $lte: period.end },
              }),
              VIDEO_MODEL.countDocuments({
                createdAt: { $gte: period.start, $lte: period.end },
              }),
              FOLLOWED_PLAYLIST_MODEL.countDocuments({
                followedAt: { $gte: period.start, $lte: period.end },
              }),
            ]);

            const playlistPercentage = calculatePercentage(
              dailyPlaylistsCount,
              totalPlaylistsCount
            );
            const videoPercentage = calculatePercentage(
              dailyVideosCount,
              totalVideosCount
            );
            const followedPlaylistPercentage = calculatePercentage(
              dailyFollowedPlaylistsCount,
              totalFollowedPlaylistsCount
            );

            data.push({
              name: period.name,
              playlistsCreated: {
                count: dailyPlaylistsCount,
                percentage: playlistPercentage,
              },
              videosUploaded: {
                count: dailyVideosCount,
                percentage: videoPercentage,
              },
              followedPlaylists: {
                count: dailyFollowedPlaylistsCount,
                percentage: followedPlaylistPercentage,
              },
            });
          }
          break;
        }

        case "3month": {
          if (!startDate || !endDate) {
            return res
              .status(400)
              .json({ message: "startDate and endDate are required for 3month range" });
          }

          periods = getWeeksInRange(startDate, endDate, req.timezone);

          for (const period of periods) {
            const [
              weeklyPlaylistsCount,
              weeklyVideosCount,
              weeklyFollowedPlaylistsCount,
            ] = await Promise.all([
              PLAYLIST_MODEL.countDocuments({
                createdAt: { $gte: period.start, $lte: period.end },
              }),
              VIDEO_MODEL.countDocuments({
                createdAt: { $gte: period.start, $lte: period.end },
              }),
              FOLLOWED_PLAYLIST_MODEL.countDocuments({
                followedAt: { $gte: period.start, $lte: period.end },
              }),
            ]);

            const playlistPercentage = calculatePercentage(
              weeklyPlaylistsCount,
              totalPlaylistsCount
            );
            const videoPercentage = calculatePercentage(
              weeklyVideosCount,
              totalVideosCount
            );
            const followedPlaylistPercentage = calculatePercentage(
              weeklyFollowedPlaylistsCount,
              totalFollowedPlaylistsCount
            );

            data.push({
              name: period.name,
              playlistsCreated: {
                count: weeklyPlaylistsCount,
                percentage: playlistPercentage,
              },
              videosUploaded: {
                count: weeklyVideosCount,
                percentage: videoPercentage,
              },
              followedPlaylists: {
                count: weeklyFollowedPlaylistsCount,
                percentage: followedPlaylistPercentage,
              },
            });
          }
          break;
        }

        default:
          return res.status(400).json({
            message:
              "Invalid timeRange. Use: daily, weekly, monthly, yearly, 30day, 3month, or alltime",
          });
      }

      return res.status(200).json({
        timeRange,
        selectedDate: selectedDate || null,
        startDate: startDate || null,
        endDate: endDate || null,
        data,
      });
    } catch (error) {
      return handleError(error, res);
    }
  },
  
  GET_USERS_OPEN_ACTIVE_ANALYTICS: async (req, res) => {
    try {
      const { timeRange, selectedDate, startDate, endDate } = req.query;

      if (!timeRange) {
        return res
          .status(400)
          .json({ message: "timeRange is required" });
      }

      let periods = [];
      let data = [];

      // Get total active users from Activity model (only counting distinct users who opened app)
      const totalActiveUsersInModel = await USER_ACTIVITY_MODEL.countDocuments();

      // Helper function to calculate percentage based on Activity records
      const calculatePercentage = (count, total) => {
        return total > 0 ? ((count / total) * 100).toFixed(2) : 0;
      };

      switch (timeRange) {
        case "weekly": {
          if (!selectedDate) {
            return res
              .status(400)
              .json({ message: "selectedDate is required for weekly view" });
          }

          periods = getWeekDays(selectedDate, req.timezone);

          for (const period of periods) {
            // Query Activity model for the specific date range
            const appOpensData = await USER_ACTIVITY_MODEL.aggregate([
              {
                $match: {
                  createdAt: { $gte: period.start, $lte: period.end },
                },
              },
              {
                $facet: {
                  totalAppOpens: [
                    { $group: { _id: null, sum: { $sum: "$appOpenCount" } } },
                  ],
                  activeUsers: [
                    { $count: "count" },
                  ],
                  totalVisitsSum: [
                    { $group: { _id: null, sum: { $sum: "$totalVisits" } } },
                  ],
                },
              },
            ]);

            const appOpensCount = appOpensData[0]?.totalAppOpens[0]?.sum || 0;
            const activeUsersCount = appOpensData[0]?.activeUsers[0]?.count || 0;
            const totalVisitsCount = appOpensData[0]?.totalVisitsSum[0]?.sum || 0;

            data.push({
              name: period.name,
              appOpens: {
                count: appOpensCount,
                percentage: calculatePercentage(appOpensCount, totalActiveUsersInModel),
              },
              activeUsers: {
                count: activeUsersCount,
                percentage: calculatePercentage(activeUsersCount, totalActiveUsersInModel),
              },
              totalVisits: {
                count: totalVisitsCount,
                percentage: calculatePercentage(totalVisitsCount, totalActiveUsersInModel),
              },
            });
          }
          break;
        }

        case "monthly": {
          if (!selectedDate) {
            return res
              .status(400)
              .json({ message: "selectedDate is required for monthly view" });
          }

          const date = new Date(selectedDate);
          const year = date.getFullYear();
          const month = date.getMonth() + 1;

          const days = getDaysInMonth(year, month, req.timezone);

          for (const day of days) {
            const appOpensData = await USER_ACTIVITY_MODEL.aggregate([
              {
                $match: {
                  createdAt: { $gte: day.start, $lte: day.end },
                },
              },
              {
                $facet: {
                  totalAppOpens: [
                    { $group: { _id: null, sum: { $sum: "$appOpenCount" } } },
                  ],
                  activeUsers: [
                    { $count: "count" },
                  ],
                  totalVisitsSum: [
                    { $group: { _id: null, sum: { $sum: "$totalVisits" } } },
                  ],
                },
              },
            ]);

            const appOpensCount = appOpensData[0]?.totalAppOpens[0]?.sum || 0;
            const activeUsersCount = appOpensData[0]?.activeUsers[0]?.count || 0;
            const totalVisitsCount = appOpensData[0]?.totalVisitsSum[0]?.sum || 0;

            data.push({
              name: day.name.split(" ")[1], // Extract only the day number (e.g., "2" from "Nov 2")
              appOpens: {
                count: appOpensCount,
                percentage: calculatePercentage(appOpensCount, totalActiveUsersInModel),
              },
              activeUsers: {
                count: activeUsersCount,
                percentage: calculatePercentage(activeUsersCount, totalActiveUsersInModel),
              },
              totalVisits: {
                count: totalVisitsCount,
                percentage: calculatePercentage(totalVisitsCount, totalActiveUsersInModel),
              },
            });
          }
          break;
        }

        case "yearly": {
          if (!selectedDate) {
            return res
              .status(400)
              .json({ message: "selectedDate is required for yearly view" });
          }

          const date = new Date(selectedDate);
          const year = date.getFullYear();

          periods = getMonthsInYear(year, req.timezone);

          for (const period of periods) {
            const appOpensData = await USER_ACTIVITY_MODEL.aggregate([
              {
                $match: {
                  createdAt: { $gte: period.start, $lte: period.end },
                },
              },
              {
                $facet: {
                  totalAppOpens: [
                    { $group: { _id: null, sum: { $sum: "$appOpenCount" } } },
                  ],
                  activeUsers: [
                    { $count: "count" },
                  ],
                  totalVisitsSum: [
                    { $group: { _id: null, sum: { $sum: "$totalVisits" } } },
                  ],
                },
              },
            ]);

            const appOpensCount = appOpensData[0]?.totalAppOpens[0]?.sum || 0;
            const activeUsersCount = appOpensData[0]?.activeUsers[0]?.count || 0;
            const totalVisitsCount = appOpensData[0]?.totalVisitsSum[0]?.sum || 0;

            data.push({
              name: period.name,
              appOpens: {
                count: appOpensCount,
                percentage: calculatePercentage(appOpensCount, totalActiveUsersInModel),
              },
              activeUsers: {
                count: activeUsersCount,
                percentage: calculatePercentage(activeUsersCount, totalActiveUsersInModel),
              },
              totalVisits: {
                count: totalVisitsCount,
                percentage: calculatePercentage(totalVisitsCount, totalActiveUsersInModel),
              },
            });
          }
          break;
        }

        case "daily": {
          if (!selectedDate) {
            return res
              .status(400)
              .json({ message: "selectedDate is required for daily view" });
          }

          periods = getHoursInDay(selectedDate, req.timezone);

          for (const period of periods) {
            const appOpensData = await USER_ACTIVITY_MODEL.aggregate([
              {
                $match: {
                  createdAt: { $gte: period.start, $lte: period.end },
                },
              },
              {
                $facet: {
                  totalAppOpens: [
                    { $group: { _id: null, sum: { $sum: "$appOpenCount" } } },
                  ],
                  activeUsers: [
                    { $count: "count" },
                  ],
                  totalVisitsSum: [
                    { $group: { _id: null, sum: { $sum: "$totalVisits" } } },
                  ],
                },
              },
            ]);

            const appOpensCount = appOpensData[0]?.totalAppOpens[0]?.sum || 0;
            const activeUsersCount = appOpensData[0]?.activeUsers[0]?.count || 0;
            const totalVisitsCount = appOpensData[0]?.totalVisitsSum[0]?.sum || 0;

            data.push({
              name: period.name,
              appOpens: {
                count: appOpensCount,
                percentage: calculatePercentage(appOpensCount, totalActiveUsersInModel),
              },
              activeUsers: {
                count: activeUsersCount,
                percentage: calculatePercentage(activeUsersCount, totalActiveUsersInModel),
              },
              totalVisits: {
                count: totalVisitsCount,
                percentage: calculatePercentage(totalVisitsCount, totalActiveUsersInModel),
              },
            });
          }
          break;
        }

        case "alltime": {
          periods = getYearsRange(req.timezone);

          for (const period of periods) {
            const appOpensData = await USER_ACTIVITY_MODEL.aggregate([
              {
                $match: {
                  createdAt: { $gte: period.start, $lte: period.end },
                },
              },
              {
                $facet: {
                  totalAppOpens: [
                    { $group: { _id: null, sum: { $sum: "$appOpenCount" } } },
                  ],
                  activeUsers: [
                    { $count: "count" },
                  ],
                  totalVisitsSum: [
                    { $group: { _id: null, sum: { $sum: "$totalVisits" } } },
                  ],
                },
              },
            ]);

            const appOpensCount = appOpensData[0]?.totalAppOpens[0]?.sum || 0;
            const activeUsersCount = appOpensData[0]?.activeUsers[0]?.count || 0;
            const totalVisitsCount = appOpensData[0]?.totalVisitsSum[0]?.sum || 0;

            data.push({
              name: period.name,
              appOpens: {
                count: appOpensCount,
                percentage: calculatePercentage(appOpensCount, totalActiveUsersInModel),
              },
              activeUsers: {
                count: activeUsersCount,
                percentage: calculatePercentage(activeUsersCount, totalActiveUsersInModel),
              },
              totalVisits: {
                count: totalVisitsCount,
                percentage: calculatePercentage(totalVisitsCount, totalActiveUsersInModel),
              },
            });
          }
          break;
        }

        case "30day": {
          // Validate 30-day range
          const validation = validate30DayRange(startDate, endDate);
          if (!validation.valid) {
            return res.status(400).json({ message: validation.message });
          }

          periods = getDaysInRange(startDate, endDate, req.timezone);

          for (const period of periods) {
            const appOpensData = await USER_ACTIVITY_MODEL.aggregate([
              {
                $match: {
                  createdAt: { $gte: period.start, $lte: period.end },
                },
              },
              {
                $facet: {
                  totalAppOpens: [
                    { $group: { _id: null, sum: { $sum: "$appOpenCount" } } },
                  ],
                  activeUsers: [
                    { $count: "count" },
                  ],
                  totalVisitsSum: [
                    { $group: { _id: null, sum: { $sum: "$totalVisits" } } },
                  ],
                },
              },
            ]);

            const appOpensCount = appOpensData[0]?.totalAppOpens[0]?.sum || 0;
            const activeUsersCount = appOpensData[0]?.activeUsers[0]?.count || 0;
            const totalVisitsCount = appOpensData[0]?.totalVisitsSum[0]?.sum || 0;

            data.push({
              name: period.name,
              appOpens: {
                count: appOpensCount,
                percentage: calculatePercentage(appOpensCount, totalActiveUsersInModel),
              },
              activeUsers: {
                count: activeUsersCount,
                percentage: calculatePercentage(activeUsersCount, totalActiveUsersInModel),
              },
              totalVisits: {
                count: totalVisitsCount,
                percentage: calculatePercentage(totalVisitsCount, totalActiveUsersInModel),
              },
            });
          }
          break;
        }

        case "3month": {
          if (!startDate || !endDate) {
            return res
              .status(400)
              .json({ message: "startDate and endDate are required for 3month range" });
          }

          periods = getWeeksInRange(startDate, endDate, req.timezone);

          for (const period of periods) {
            const appOpensData = await USER_ACTIVITY_MODEL.aggregate([
              {
                $match: {
                  createdAt: { $gte: period.start, $lte: period.end },
                },
              },
              {
                $facet: {
                  totalAppOpens: [
                    { $group: { _id: null, sum: { $sum: "$appOpenCount" } } },
                  ],
                  activeUsers: [
                    { $count: "count" },
                  ],
                  totalVisitsSum: [
                    { $group: { _id: null, sum: { $sum: "$totalVisits" } } },
                  ],
                },
              },
            ]);

            const appOpensCount = appOpensData[0]?.totalAppOpens[0]?.sum || 0;
            const activeUsersCount = appOpensData[0]?.activeUsers[0]?.count || 0;
            const totalVisitsCount = appOpensData[0]?.totalVisitsSum[0]?.sum || 0;

            data.push({
              name: period.name,
              appOpens: {
                count: appOpensCount,
                percentage: calculatePercentage(appOpensCount, totalActiveUsersInModel),
              },
              activeUsers: {
                count: activeUsersCount,
                percentage: calculatePercentage(activeUsersCount, totalActiveUsersInModel),
              },
              totalVisits: {
                count: totalVisitsCount,
                percentage: calculatePercentage(totalVisitsCount, totalActiveUsersInModel),
              },
            });
          }
          break;
        }

        default:
          return res.status(400).json({
            message:
              "Invalid timeRange. Use: daily, weekly, monthly, yearly, 30day, 3month, or alltime",
          });
      }

      return res.status(200).json({
        timeRange,
        selectedDate: selectedDate || null,
        startDate: startDate || null,
        endDate: endDate || null,
        data,
      });
    } catch (error) {
      return handleError(error, res);
    }
  },

  GET_DEVICE_STATS: async (req, res) => {
    try {
      // Single aggregation query to get counts for both device types
      const deviceStats = await USER_MODEL.aggregate([
        {
          $match: {
            device: { $in: ["Apple", "Android"] }
          }
        },
        {
          $group: {
            _id: "$device",
            count: { $sum: 1 }
          }
        }
      ]);

      // Extract counts from aggregation results
      const totalAndroid = deviceStats.find(stat => stat._id === "Android")?.count || 0;
      const totalApple = deviceStats.find(stat => stat._id === "Apple")?.count || 0;
      const total = totalAndroid + totalApple;

      // Calculate percentages
      const androidPercent = total > 0 ? ((totalAndroid / total) * 100).toFixed(0) : "0";
      const applePercent = total > 0 ? ((totalApple / total) * 100).toFixed(0) : "0";

      return res.status(200).json({ total, androidPercent, applePercent });
    } catch (error) {
      return handleError(error, res);
    }
  },

  GET_APP_STATE_STATS: async (req, res) => {
    try {
      const totalActive = await USER_MODEL.countDocuments({
        appState: "active",
      });
      const total = await USER_MODEL.countDocuments({});

      return res.status(200).json({
        total,
        totalActive,
        percentageActive: ((totalActive / total) * 100).toFixed(0),
      });
    } catch (error) {
      return handleError(error, res);
    }
  },

  GET_USERS_ACTIVE_STATS: async (req, res) => {
    try {
      const totalActive = await USER_MODEL.countDocuments({ isActive: true });
      const total = await USER_MODEL.countDocuments({});

      return res.status(200).json({
        total,
        totalActive,
        percentageActive: ((totalActive / total) * 100).toFixed(0),
      });
    } catch (error) {
      return handleError(error, res);
    }
  },

  GET_USERS_ACTIVITY_STATS: async (req, res) => {
    try {
      const { DateTime } = require("luxon");
      let { date, startDate, endDate } = req.query;

      const now = DateTime.now().setZone(req.timezone);
      const todayString = now.toISODate(); // YYYY-MM-DD
      date = date || todayString;

      if (!endDate) endDate = todayString;
      if (!startDate) {
        startDate = now.minus({ days: 30 }).toISODate();
      }

      if (DateTime.fromISO(startDate) > DateTime.fromISO(endDate)) {
        return res.status(400).json({
          success: false,
          message: "startDate must be before or equal to endDate",
        });
      }

      const totalUsers = await USER_MODEL.countDocuments({ isDeleted: false });

      // Aggregate activity in a single query
      const result = await USER_ACTIVITY_MODEL.aggregate([
        {
          $match: {
            date: { $gte: startDate, $lte: endDate },
          },
        },
        {
          $facet: {
            activeUsersPeriod: [
              { $group: { _id: "$userId" } }, // unique users in period
              { $count: "count" },
            ],
            activeUsersDate: [
              { $match: { date } }, // only records for the specific date
              { $count: "count" },
            ],
            totalVisitsPeriod: [
              { $group: { _id: null, sum: { $sum: "$totalVisits" } } },
            ],
            totalVisitsDate: [
              { $match: { date } }, // only records for the specific date
              { $group: { _id: null, sum: { $sum: "$totalVisits" } } },
            ],
          },
        },
      ]);

      const activeUsersPeriod = result[0].activeUsersPeriod[0]?.count || 0;
      const activeUsersDate = result[0].activeUsersDate[0]?.count || 0;
      const totalVisitsPeriod = result[0].totalVisitsPeriod[0]?.sum || 0;
      const totalVisitsDate = result[0].totalVisitsDate[0]?.sum || 0;

      // Helper function to format percentage: 1 digit if > 9, else 2 digits
      const formatPercentage = (value) => {
        if (value > 9) {
          return parseFloat(value).toFixed(1);
        }
        return parseFloat(value).toFixed(2);
      };

      const datePercentRaw =
        totalUsers === 0
          ? 0
          : (activeUsersDate / totalUsers) * 100;
      const periodPercentRaw =
        totalUsers === 0
          ? 0
          : (activeUsersPeriod / totalUsers) * 100;

      const datePercent = formatPercentage(datePercentRaw);
      const periodPercent = formatPercentage(periodPercentRaw);

      // Calculate total visits percentages (relative to total users, like unique visits)
      const totalVisitsTodayPercentRaw =
        totalUsers === 0
          ? 0
          : (totalVisitsDate / totalUsers) * 100;
      const totalVisitsPeriodPercentRaw =
        totalUsers === 0
          ? 0
          : (totalVisitsPeriod / totalUsers) * 100;

      const totalVisitsTodayPercent = formatPercentage(totalVisitsTodayPercentRaw);
      const totalVisitsPeriodPercent = formatPercentage(totalVisitsPeriodPercentRaw);

      return res.status(200).json({
        success: true,
        totalUsers,
        date,
        startDate,
        endDate,
        activeUsersDate,
        activeUsersPeriod,
        totalVisitsDate,
        totalVisitsPeriod,
        datePercent: datePercent,
        periodPercent: periodPercent,
        totalVisitsTodayPercent: totalVisitsTodayPercent,
        totalVisitsPeriodPercent: totalVisitsPeriodPercent,
      });
    } catch (error) {
      handleError(error, res);
    }
  },

  GET_USERS_GEO_CITY_STATS: async (req, res) => {
    try {
      const { country } = req.query;

      const matchStage = {};
      if (country) matchStage["location.country"] = country;

      const pipeline = [
        { $match: matchStage },
        {
          // First group: Group by city only to consolidate all users per city
          $group: {
            _id: {
              country: "$location.country",
              city: "$location.city",
            },
            count: { $sum: 1 },
            // Average the coordinates to get center point for the city
            avgLat: { $avg: "$location.lat" },
            avgLon: { $avg: "$location.lon" },
          },
        },
        {
          // Second group: Group by country and aggregate cities
          $group: {
            _id: "$_id.country",
            cities: {
              $push: {
                city: "$_id.city",
                lat: "$avgLat",
                lon: "$avgLon",
                count: "$count",
              },
            },
            total: { $sum: "$count" },
          },
        },
        {
          $project: {
            _id: 0,
            country: "$_id",
            cities: {
              $map: {
                input: "$cities",
                as: "c",
                in: {
                  city: "$$c.city",
                  coordinates: ["$$c.lon", "$$c.lat"],
                  percentage: {
                    $round: [
                      { $multiply: [{ $divide: ["$$c.count", "$total"] }, 100] },
                      1,
                    ],
                  },
                },
              },
            },
          },
        },
      ];

      let results = await USER_ADDRESS_MODEL.aggregate(pipeline);

      // Extended color palette to support 30+ cities/countries with distinct colors
      const colors = [
        "#00D4FF", "#FFB600", "#00CC88", "#FF4444", "#8B00FF",
        "#2AF59F", "#A23DF5", "#37B7FF", "#FFCD00", "#FF5733",
        "#FF6B6B", "#4ECDC4", "#45B7D1", "#FFA07A", "#98D8C8",
        "#F7DC6F", "#BB8FCE", "#85C1E2", "#F8B88B", "#52C9B5",
        "#63A1DB", "#FF8C94", "#A8E6CF", "#FFD3B6", "#FCBAD3",
        "#AA96DA", "#FDCB6E", "#6C63FF", "#FF6584", "#53D8D8",
        "#FC6E51", "#FECB2E", "#47A025", "#0080FF", "#FF00AA"
      ];

      results = results.map((countryData) => {
        const sorted = countryData.cities.sort((a, b) => b.percentage - a.percentage);
        const colored = sorted.map((c, idx) => ({
          ...c,
          color: colors[idx % colors.length],
        }));
        return { ...countryData, cities: colored };
      });

      return res.status(200).json(results);
    } catch (error) {
      return handleError(error, res);
    }
  },

  GET_USERS_GEO_COUNTRY_STATS: async (req, res) => {
    try {
      const { region } = req.query;

      // Define regions and their countries
      const REGION_COUNTRIES = {
        world: [],
        asia: ["India", "Pakistan", "Bangladesh", "Japan", "China", "Singapore", "Thailand", "Vietnam", "Indonesia", "Malaysia", "Philippines", "South Korea"],
        europe: ["United Kingdom", "Germany", "France", "Spain", "Italy", "Poland", "Netherlands", "Belgium", "Austria", "Switzerland", "Sweden", "Denmark", "Norway"],
        africa: ["Nigeria", "Egypt", "South Africa", "Kenya", "Ethiopia", "Morocco", "Ghana", "Algeria", "Tanzania", "Uganda"],
        "north-america": ["United States", "Canada", "Mexico"],
        "south-america": ["Brazil", "Colombia", "Argentina", "Peru", "Venezuela", "Chile"],
        oceania: ["Australia", "New Zealand", "Fiji", "Papua New Guinea"],
      };

      // Build match stage based on region
      const matchStage = {
        "location.country": { $exists: true, $ne: null, $ne: "" },
      };

      const selectedRegion = region || "world";
      const countriesToFilter = REGION_COUNTRIES[selectedRegion];

      // If region is not world, filter by countries in that region
      if (selectedRegion !== "world" && countriesToFilter && countriesToFilter.length > 0) {
        matchStage["location.country"] = { $in: countriesToFilter };
      }

      const pipeline = [
        {
          $match: matchStage,
        },
        {
          // First group: Group by country only to consolidate all users per country
          $group: {
            _id: "$location.country",
            count: { $sum: 1 },
            // Average the coordinates to get center point for the country
            avgLat: { $avg: "$location.lat" },
            avgLon: { $avg: "$location.lon" },
          },
        },
        {
          // Second group: Get total count for percentage calculation
          $group: {
            _id: null,
            countries: {
              $push: {
                country: "$_id",
                lat: "$avgLat",
                lon: "$avgLon",
                count: "$count",
              },
            },
            total: { $sum: "$count" },
          },
        },
        {
          $project: {
            _id: 0,
            countries: {
              $map: {
                input: "$countries",
                as: "c",
                in: {
                  country: "$$c.country",
                  coordinates: ["$$c.lon", "$$c.lat"],
                  percentage: {
                    $round: [
                      { $multiply: [{ $divide: ["$$c.count", "$total"] }, 100] },
                      2,
                    ],
                  },
                },
              },
            },
          },
        },
      ];

      let results = await USER_ADDRESS_MODEL.aggregate(pipeline);
      const data = results[0] || { countries: [] };

      // Extended color palette to support 30+ countries with distinct colors
      const colors = [
        "#2AF59F", "#A23DF5", "#37B7FF", "#FFCD00", "#FF5733",
        "#FF6B6B", "#4ECDC4", "#45B7D1", "#FFA07A", "#98D8C8",
        "#F7DC6F", "#BB8FCE", "#85C1E2", "#F8B88B", "#52C9B5",
        "#63A1DB", "#FF8C94", "#A8E6CF", "#FFD3B6", "#FCBAD3",
        "#AA96DA", "#FDCB6E", "#6C63FF", "#FF6584", "#53D8D8",
        "#FC6E51", "#FECB2E", "#47A025", "#0080FF", "#FF00AA",
        "#00D4FF", "#FFB600", "#00CC88", "#FF4444", "#8B00FF"
      ];

      const countryData = data.countries
        .sort((a, b) => b.percentage - a.percentage)
        .map((c, idx) => ({
          ...c,
          color: colors[idx % colors.length],
        }));

      return res.status(200).json(countryData);
    } catch (error) {
      return handleError(error, res);
    }
  },

  GET_USERS_GROWTH_CUMULATIVE_ANALYTICS: async (req, res) => {
    try {
      const { timeRange, selectedDate, startDate, endDate, includeDeleted } = req.query;

      if (!timeRange) {
        return res.status(400).json({ message: "timeRange is required" });
      }

      // Parse includeDeleted parameter (default: false)
      const includeDeletedUsers = includeDeleted === "true" || includeDeleted === true;

      const now = new Date();
      let periods = [];
      let data = [];

      // Helper function to process a period with future date handling and optimized queries
      const processPeriod = async (period) => {
        // For periods entirely in the future, return null values (don't query database)
        if (period.start > now) {
          return {
            period: period.name,
            users: null,
            added: 0,
            deleted: 0,
          };
        }

        // Cap period.end to now if it extends into the future
        const effectiveEnd = period.end > now ? now : period.end;
        const effectiveStart = period.start;

        // Build match conditions for cumulative and added queries
        const baseMatch = {
          role: { $in: ["user", "influencer"] },
        };

        // Conditionally add isDeleted filter based on includeDeletedUsers
        if (!includeDeletedUsers) {
          baseMatch.isDeleted = false;
        }

        // Use aggregation pipeline to get all counts in a single query
        const [result] = await USER_MODEL.aggregate([
          {
            $facet: {
              // Cumulative count: all users and influencers created up to effectiveEnd
              cumulative: [
                {
                  $match: {
                    ...baseMatch,
                    createdAt: { $lte: effectiveEnd },
                  },
                },
                { $count: "count" },
              ],
              // Added count: users and influencers created between effectiveStart and effectiveEnd
              added: [
                {
                  $match: {
                    ...baseMatch,
                    createdAt: { $gte: effectiveStart, $lte: effectiveEnd },
                  },
                },
                { $count: "count" },
              ],
              // Deleted users: deleted between effectiveStart and effectiveEnd
              deleted: [
                {
                  $match: {
                    isDeleted: true,
                    updatedAt: { $gte: effectiveStart, $lte: effectiveEnd },
                  },
                },
                { $count: "count" },
              ],
            },
          },
        ]);

        return {
          period: period.name,
          users: result.cumulative[0]?.count || 0,
          added: result.added[0]?.count || 0,
          deleted: result.deleted[0]?.count || 0,
        };
      };

      switch (timeRange) {
        case "weekly": {
          if (!selectedDate) {
            return res
              .status(400)
              .json({ message: "selectedDate is required for weekly view" });
          }

          periods = getWeekDays(selectedDate, req.timezone);

          // Process all periods in parallel for better performance
          const periodResults = await Promise.all(
            periods.map((period) => processPeriod(period))
          );
          // Include all periods (future ones will have null users)
          data.push(...periodResults);
          break;
        }

        case "monthly": {
          if (!selectedDate) {
            return res
              .status(400)
              .json({ message: "selectedDate is required for monthly view" });
          }

          const date = new Date(selectedDate);
          const year = date.getFullYear();
          const month = date.getMonth() + 1;

          const days = getDaysInMonth(year, month, req.timezone);

          // Process all days in parallel for better performance
          const dayResults = await Promise.all(
            days.map(async (day) => {
              const result = await processPeriod(day);
              // Extract day number from name (e.g., "Jan 15" -> "15")
              const dayNumber = day.name.split(" ")[1];
              return {
                ...result,
                period: dayNumber,
              };
            })
          );
          // Include all periods (future ones will have null users)
          data.push(...dayResults);
          break;
        }

        case "yearly": {
          if (!selectedDate) {
            return res
              .status(400)
              .json({ message: "selectedDate is required for yearly view" });
          }

          const date = new Date(selectedDate);
          const year = date.getFullYear();

          periods = getMonthsInYear(year, req.timezone);

          // Process all periods in parallel for better performance
          const periodResults = await Promise.all(
            periods.map((period) => processPeriod(period))
          );
          // Include all periods (future ones will have null users)
          data.push(...periodResults);
          break;
        }

        case "daily": {
          if (!selectedDate) {
            return res
              .status(400)
              .json({ message: "selectedDate is required for daily view" });
          }

          periods = getHoursInDay(selectedDate, req.timezone);

          // Process all periods in parallel for better performance
          const periodResults = await Promise.all(
            periods.map((period) => processPeriod(period))
          );
          // Include all periods (future ones will have null users)
          data.push(...periodResults);
          break;
        }

        case "alltime": {
          periods = getYearsRange(req.timezone);

          // Process all periods in parallel for better performance
          const periodResults = await Promise.all(
            periods.map((period) => processPeriod(period))
          );
          // Include all periods (future ones will have null users)
          data.push(...periodResults);
          break;
        }

        case "30day": {
          // Validate 30-day range
          const validation = validate30DayRange(startDate, endDate);
          if (!validation.valid) {
            return res.status(400).json({ message: validation.message });
          }

          periods = getDaysInRange(startDate, endDate, req.timezone);

          // Process all periods in parallel for better performance
          const periodResults = await Promise.all(
            periods.map((period) => processPeriod(period))
          );
          data.push(...periodResults);
          break;
        }

        case "3month": {
          if (!startDate || !endDate) {
            return res
              .status(400)
              .json({ message: "startDate and endDate are required for 3month range" });
          }

          periods = getWeeksInRange(startDate, endDate, req.timezone);

          // Process all periods in parallel for better performance
          const periodResults = await Promise.all(
            periods.map((period) => processPeriod(period))
          );
          data.push(...periodResults);
          break;
        }

        default:
          return res.status(400).json({
            message:
              "Invalid timeRange. Use: daily, weekly, monthly, yearly, 30day, 3month, or alltime",
          });
      }

      return res.status(200).json({
        timeRange,
        selectedDate: selectedDate || null,
        startDate: startDate || null,
        endDate: endDate || null,
        data,
      });
    } catch (error) {
      return handleError(error, res);
    }
  }
};
