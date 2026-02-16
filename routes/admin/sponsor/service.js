const {
  getWeekDays,
  getWeeksInMonth,
  getMonthsInYear,
  getYearsRange,
} = require("../../../helpers/dateRang");
const {
  SPONSORS_MODEL,
  VIDEO_MODEL,
  SPONSOR_ANALYTICS,
} = require("../../../models");
const handleError = require("../../../utils/errorHandler");

const generateUniqueUsername = async (name) => {
  if (!name || typeof name !== "string") return null;

  // Clean up name: Remove extra spaces, non-alphabetic characters
  name = name.trim().replace(/[^a-zA-Z ]/g, "");
  if (!name) return null;

  const nameParts = name.split(" ").filter((part) => part.length > 0);
  let firstName =
    nameParts.length > 0 ? nameParts[0].toLowerCase().substring(0, 4) : "user";
  let lastName =
    nameParts.length > 1 ? nameParts[1].toLowerCase().charAt(0) : "";

  // If name is too short, use a fallback
  if (firstName.length < 2) firstName = "user";
  if (lastName.length === 0) lastName = firstName.charAt(0);

  let username;
  let isUnique = false;

  while (!isUnique) {
    const randomNum = Math.floor(100 + Math.random() * 900); // 3-digit random number
    username = `@${firstName}${lastName}${randomNum}`;

    const existingUser = await SPONSORS_MODEL.findOne({ username });
    if (!existingUser) {
      isUnique = true;
    }
  }

  return username;
};

module.exports = {
  CREATE_SPONSOR: async (req, res) => {
    try {
      const {
        brandName,
        logo,
        description,
        url,
        displayText,
        videoId,
        coverImage,
        shopText,
        shopImage,
        username,
      } = req.body;

      // Validate required fields (based on schema)
      if (!brandName || !logo || !description || !url) {
        return res.status(400).json({
          status: "error",
          message: "Missing required fields: brandName, logo, description, url",
        });
      }

      // Check if video exists (only if videoId is provided)
      if (videoId) {
        const videoExists = await VIDEO_MODEL.findById(videoId);
        if (!videoExists) {
          return res.status(404).json({
            status: "error",
            message: "Video not found",
          });
        }
      }

      const sponsor = new SPONSORS_MODEL({
        brandName,
        logo,
        description,
        url,
        displayText: displayText || "Sponsored",
        videoId: videoId || null,
        coverImage: coverImage || null,
        shopImage: shopImage || null,
        shopText: shopText || "",
        username: username || (await generateUniqueUsername(brandName)),
      });

      await sponsor.save();

      return res.status(201).json({
        message: "Sponsor created successfully",
        data: sponsor,
      });
    } catch (error) {
      return handleError(error, res);
    }
  },

  FIND_ALL_SPONSOR: async (req, res) => {
    try {
      const {
        pageNum = 1,
        perPage = 10,
        search = "",
        sortBy = "newest",
      } = req.query;

      const itemsPerPage = parseInt(perPage, 10) || 10;
      const pageNumber = parseInt(pageNum, 10) || 1;
      const skip = itemsPerPage * (pageNumber - 1);

      const query = { isDeleted: false };
      if (search) {
        const searchRegex = { $regex: search, $options: "i" };
        query.$or = [
          { brandName: searchRegex },
          { description: searchRegex },
          { username: searchRegex },
        ];
      }

      // Fetch sponsors with pagination and sorting
      const sponsors = await SPONSORS_MODEL.find(query)
        .populate("videoId")
        .sort(sortBy === "newest" ? { createdAt: -1 } : { createdAt: 1 })
        .limit(itemsPerPage)
        .skip(skip);

      // Count total sponsors matching query
      const totalItems = await SPONSORS_MODEL.countDocuments(query);

      if (!sponsors.length) {
        return res.status(200).json({
          status: "success",
          message: "No sponsors found",
        });
      }

      return res.status(200).json({
        message: "Sponsors retrieved successfully",
        data: sponsors,
        pagination: {
          pageNum: pageNumber,
          perPage: itemsPerPage,
          totalItems,
        },
      });
    } catch (error) {
      return handleError(error, res);
    }
  },

  FIND_ONE_SPONSOR: async (req, res) => {
    try {
      const sponsor = await SPONSORS_MODEL.findOne({
        _id: req.params.id,
        isDeleted: false,
      }).populate("videoId");

      if (!sponsor) {
        return res.status(404).json({
          status: "error",
          message: "Sponsor not found",
        });
      }

      return res.status(200).json({
        message: "Sponsor retrieved successfully",
        data: sponsor,
      });
    } catch (error) {
      return handleError(error, res);
    }
  },

  UPDATE_BY_ID_SPONSOR: async (req, res) => {
    try {
      const {
        brandName,
        logo,
        description,
        url,
        displayText,
        videoId,
        coverImage,
        shopImage,
        shopText,
        username,
      } = req.body;

      const sponsor = await SPONSORS_MODEL.findOne({
        _id: req.params.id,
        isDeleted: false,
      });

      if (!sponsor) {
        return res.status(404).json({
          status: "error",
          message: "Sponsor not found",
        });
      }

      // Fix the videoId comparison to handle null/undefined values safely
      if (videoId) {
        // Only check if videoId is provided (not null)
        if (!sponsor.videoId || videoId !== sponsor.videoId.toString()) {
          const videoExists = await VIDEO_MODEL.findById(videoId);
          if (!videoExists) {
            return res.status(404).json({
              status: "error",
              message: "Video not found",
            });
          }
        }
      }

      // Update fields (handle defaults properly)
      sponsor.brandName =
        brandName !== undefined ? brandName : sponsor.brandName;
      sponsor.logo = logo !== undefined ? logo : sponsor.logo;
      sponsor.description =
        description !== undefined ? description : sponsor.description;
      sponsor.url = url !== undefined ? url : sponsor.url;
      sponsor.displayText =
        displayText !== undefined ? displayText : sponsor.displayText;
      sponsor.videoId = videoId !== undefined ? videoId : sponsor.videoId;
      sponsor.coverImage =
        coverImage !== undefined ? coverImage : sponsor.coverImage;
      sponsor.shopImage =
        shopImage !== undefined ? shopImage : sponsor.shopImage;
      sponsor.shopText = shopText !== undefined ? shopText : sponsor.shopText;
      sponsor.username = username !== undefined ? username : sponsor.username;
      sponsor.updatedAt = new Date();

      const updatedSponsor = await sponsor.save();

      return res.status(200).json({
        message: "Sponsor updated successfully",
        data: updatedSponsor,
      });
    } catch (error) {
      return handleError(error, res);
    }
  },

  DELETE_BY_ID_SPONSOR: async (req, res) => {
    try {
      const { id } = req.params;
  
      const sponsor = await SPONSORS_MODEL.findOne({ _id: id });
  
      if (!sponsor) {
        return res.status(404).json(errorResponse("Sponsor not found"));
      }
  
      await VIDEO_MODEL.findOneAndDelete({ _id: sponsor.videoId });
  
      await SPONSORS_MODEL.findOneAndDelete({ _id: id });
  
  
      return res
        .status(200)
        .json(successResponse("Sponsor deleted successfully"));
    } catch (error) {
      return handleError(error, res);
    }
  },

  FOLLOW_UNFOLLOW_SPONSOR: async (req, res) => {
    try {
      const { targetId } = req.params; // Sponsor ID from URL
      const userId = req.user._id; // Get user ID from authenticated user

      const sponsor = await SPONSORS_MODEL.findOne({ _id: targetId });
      if (!sponsor) {
        return res.status(404).json({
          status: "error",
          message: "Sponsor not found",
        });
      }

      const followerIndex = sponsor.followers.findIndex(
        (id) => id.toString() === userId.toString()
      );
      const isUnfollow = followerIndex !== -1;

      if (isUnfollow) {
        sponsor.followers.splice(followerIndex, 1);
      } else {
        // Follow
        sponsor.followers.push(userId);
      }

      // Update the timestamp
      sponsor.updatedAt = new Date();
      await sponsor.save();

      return res.status(200).json({
        message: isUnfollow
          ? "Unfollowed successfully"
          : "Followed successfully",
        data: {
          isFollowing: !isUnfollow,
          followersCount: sponsor.followers.length,
          sponsor: sponsor,
        },
      });
    } catch (error) {
      return handleError(error, res);
    }
  },
  GET_SPONSOR_ANALYTICS: async (req, res) => {
    try {
      const { timeRange, selectedDate } = req.query;
      const { sponsorId } = req.params;
  
      if (!sponsorId) {
        return res.status(400).json({ message: "sponsorId is required" });
      }
  
      if (!timeRange) {
        return res.status(400).json({ message: "timeRange is required" });
      }
  
      const baseFilter = { sponsor: sponsorId };
  
      // All-time stats
      const [
        allTimeImpression,
        allTimeVisitLinks,
        allTimeProfileViews,
        allTimeLikes,
        allTimeUniqueImpressionUserIds,
      ] = await Promise.all([
        SPONSOR_ANALYTICS.countDocuments({
          ...baseFilter,
          eventType: "impression",
        }),
        SPONSOR_ANALYTICS.countDocuments({
          ...baseFilter,
          eventType: "visitLink",
        }),
        SPONSOR_ANALYTICS.countDocuments({
          ...baseFilter,
          eventType: "profileView",
        }),
        SPONSOR_ANALYTICS.countDocuments({
          ...baseFilter,
          eventType: "like",
        }),
        SPONSOR_ANALYTICS.distinct("user", {
          ...baseFilter,
          eventType: "impression",
        }),
      ]);
  
      let data = [];
  
      const getPeriodCounts = async (start, end) => {
        const [impressions, visitLinks, profileViews,likes, uniqueImpressionUserIds] =
          await Promise.all([
            SPONSOR_ANALYTICS.countDocuments({
              ...baseFilter,
              eventType: "impression",
              createdAt: { $gte: start, $lte: end },
            }),
            SPONSOR_ANALYTICS.countDocuments({
              ...baseFilter,
              eventType: "visitLink",
              createdAt: { $gte: start, $lte: end },
            }),
            SPONSOR_ANALYTICS.countDocuments({
              ...baseFilter,
              eventType: "profileView",
              createdAt: { $gte: start, $lte: end },
            }),
            SPONSOR_ANALYTICS.countDocuments({
              ...baseFilter,
              eventType: "like",
              createdAt: { $gte: start, $lte: end },
            }),
            SPONSOR_ANALYTICS.distinct("user", {
              ...baseFilter,
              eventType: "impression",
              createdAt: { $gte: start, $lte: end },
            }),
          ]);
  
        return {
          impressions,
          visitLinks,
          profileViews,
          likes,
          uniqueImpressionUsers: uniqueImpressionUserIds.length,
        };
      };
  
      switch (timeRange) {
        case "today": {
          const now = new Date();
          const start = new Date(now.setHours(0, 0, 0, 0));
          const end = new Date(now.setHours(23, 59, 59, 999));
  
          const counts = await getPeriodCounts(start, end);
          data.push({ name: "Today", ...counts });
          break;
        }
  
        case "weekly": {
          if (!selectedDate)
            return res
              .status(400)
              .json({ message: "selectedDate is required for weekly view" });
  
          const periods = getWeekDays(selectedDate);
          for (const period of periods) {
            const counts = await getPeriodCounts(period.start, period.end);
            data.push({ name: period.name, ...counts });
          }
          break;
        }
  
        case "monthly": {
          if (!selectedDate)
            return res
              .status(400)
              .json({ message: "selectedDate is required for monthly view" });
  
          const date = new Date(selectedDate);
          const year = date.getFullYear();
          const month = date.getMonth() + 1;
          const weeks = getWeeksInMonth(year, month);
  
          for (let i = 0; i < weeks.length; i++) {
            const week = weeks[i];
            const counts = await getPeriodCounts(week.start, week.end);
            data.push({ name: `Week ${i + 1}`, ...counts });
          }
          break;
        }
  
        case "yearly": {
          if (!selectedDate)
            return res
              .status(400)
              .json({ message: "selectedDate is required for yearly view" });
  
          const year = new Date(selectedDate).getFullYear();
          const months = getMonthsInYear(year);
  
          for (const month of months) {
            const counts = await getPeriodCounts(month.start, month.end);
            data.push({ name: month.name, ...counts });
          }
          break;
        }
  
        case "alltime": {
          const years = getYearsRange();
  
          for (const period of years) {
            const counts = await getPeriodCounts(period.start, period.end);
            data.push({ name: period.name, ...counts });
          }
          break;
        }
  
        default:
          return res.status(400).json({
            message:
              "Invalid timeRange. Use: today, weekly, monthly, yearly, or alltime",
          });
      }
  
      return res.status(200).json({
        sponsorId,
        timeRange,
        selectedDate: selectedDate || null,
        allTime: {
          totalImpressions: allTimeImpression,
          totalVisitLinks: allTimeVisitLinks,
          totalProfileViews: allTimeProfileViews,
          totalLikes: allTimeLikes,
          uniqueImpressionUsers: allTimeUniqueImpressionUserIds.length,
        },
        data,
      });
    } catch (error) {
      return handleError(error, res);
    }
  },
  
};
