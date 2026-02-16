const handleError = require("../../../utils/errorHandler");
const { USER_MODEL } = require("../../../models");
const parseFilter = require("../../../utils/parseFilter");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const PASSWORD_RESET_TOKEN_MODEL = require("../../../models/passwordResetToken.model");
const { sendPasswordResetEmail } = require("../../../helpers/email.helper");

function calculateAge(dob) {
  const birthDate = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const month = today.getMonth() - birthDate.getMonth();

  if (month < 0 || (month === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  } 

  return age;
}

function getColorForRange(index) {
  const colors = [
    "#EBFFD0,#74FFF6",
    "#69D2FE,#BF43C4",
    "#83FF60,#729EC1",
    "#A06091,#69F48C",
    "#8C00FF,#B786B2",
    "#1EFFB8,#5938C4",
  ];
  return colors[index] || "#000000";
}

module.exports = {
  FIND_ALL_USERS: async (req, res) => {
    try {
      const {
        pageNum = 1,
        perPage = 10,
        search = "",
        sortBy = "newest",
        permissions,
      } = req.query;

      const filter = parseFilter(req.query.filter, res);
      if (filter === null) return;
      const query = { ...filter };

      // Allow direct permissions query param (e.g. ?permissions=approved)
      // to work alongside the JSON `filter` object, without overwriting it.
      if (permissions && !query.permissions) {
        query.permissions = permissions;
      }

      if (search) {
        query.$or = [
          { name: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } },
          { username: { $regex: search, $options: "i" } },
        ];
      }

      const pageNumber = Number(pageNum) || 1;
      const itemsPerPage = Number(perPage) || 10;
      const skip = (pageNumber - 1) * itemsPerPage;

      const sortStage =
        sortBy === "newest" ? { createdAt: -1 } : { createdAt: 1 };

      // For influencer weekly posts window
      const now = new Date();
      const sevenDayStart = new Date();
      sevenDayStart.setDate(now.getDate() - 6);
      sevenDayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      const dataEnrichmentStages = [
        // playlistsCount (owned playlists)
        {
          $lookup: {
            from: "playlists",
            let: { userId: "$_id" },
            pipeline: [
              { $match: { $expr: { $eq: ["$owner", "$$userId"] } } },
              { $count: "count" },
            ],
            as: "playlistsCountAgg",
          },
        },
        {
          $addFields: {
            playlistsCount: {
              $ifNull: [{ $first: "$playlistsCountAgg.count" }, 0],
            },
          },
        },
        { $unset: "playlistsCountAgg" },
      ];

      // Only compute post counts when requesting influencers
      if (filter?.role === "influencer") {
        dataEnrichmentStages.push(
          {
            $lookup: {
              from: "videos",
              let: { userId: "$_id" },
              pipeline: [
                { $match: { $expr: { $eq: ["$owner", "$$userId"] } } },
                { $count: "count" },
              ],
              as: "totalPostsAgg",
            },
          },
          {
            $lookup: {
              from: "videos",
              let: { userId: "$_id" },
              pipeline: [
                {
                  $match: {
                    $expr: { $eq: ["$owner", "$$userId"] },
                    createdAt: { $gte: sevenDayStart, $lte: todayEnd },
                  },
                },
                { $count: "count" },
              ],
              as: "weeklyPostsAgg",
            },
          },
          {
            $addFields: {
              totalPosts: { $ifNull: [{ $first: "$totalPostsAgg.count" }, 0] },
              weeklyPosts: {
                $ifNull: [{ $first: "$weeklyPostsAgg.count" }, 0],
              },
            },
          },
          { $unset: ["totalPostsAgg", "weeklyPostsAgg"] }
        );
      }

      const result = await USER_MODEL.aggregate([
        { $match: query },
        { $sort: sortStage },
        {
          $facet: {
            data: [
              { $skip: skip },
              { $limit: itemsPerPage },
              ...dataEnrichmentStages,
            ],
            totalCount: [{ $count: "count" }],
          },
        },
      ]);

      const users = result?.[0]?.data || [];
      const totalItems = result?.[0]?.totalCount?.[0]?.count || 0;

      res.json({
        data: users,
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

  FIND_USER_BY_ID: async (req, res) => {
    try {
      const user = await USER_MODEL.findById(req.params.id);
      if (!user) {
        return res.status(404).json({
          status: "error",
          message: "User not found",
        });
      }
      return res.status(200).json({
        message: "User retrieved successfully",
        data: user,
      });
    } catch (error) {
      return handleError(error, res);
    }
  },
  FIND_USER_FOLLOW_DATA: async (req, res) => {
    try {
      const { id } = req.params;
      const {
        pageNum = 1,
        perPage = 10,
        search = "",
        sortBy = "newest",
        follower, // boolean: true = fetch followers, false = fetch following
      } = req.query;

      const filterField = follower === "true" ? "followers" : "following"; // determine field

      const user = await USER_MODEL.findById(id).select(filterField).lean();
      if (!user) return res.status(404).json({ message: "User not found" });

      const userIds = user[filterField];
      if (!userIds || userIds.length === 0) {
        return res.json({
          message: `No ${filterField} found`,
          data: [],
          pagination: { pageNum: 1, perPage: 0, totalItems: 0 },
        });
      }

      const matchStage = { _id: { $in: userIds } };
      if (search) {
        matchStage.$or = [
          { name: { $regex: search, $options: "i" } },
          { username: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } },
        ];
      }

      const pipeline = [
        { $match: matchStage },
        {
          $lookup: {
            from: "videos",
            localField: "_id",
            foreignField: "owner",
            as: "posts",
          },
        },
        {
          $addFields: {
            followersCount: { $size: { $ifNull: ["$followers", []] } },
            followingCount: { $size: { $ifNull: ["$following", []] } },
            postCount: { $size: { $ifNull: ["$posts", []] } },
          },
        },
        {
          $project: {
            name: 1,
            email: 1,
            profilePic: 1,
            role: 1,
            followersCount: 1,
            followingCount: 1,
            postCount: 1,
            createdAt: 1,
          },
        },
        { $sort: sortBy === "newest" ? { createdAt: -1 } : { createdAt: 1 } },
        {
          $facet: {
            data: [
              { $skip: (pageNum - 1) * Number(perPage) },
              { $limit: Number(perPage) },
            ],
            totalCount: [{ $count: "count" }],
          },
        },
      ];

      const result = await USER_MODEL.aggregate(pipeline);

      const users = result[0]?.data || [];
      const totalItems = result[0]?.totalCount?.[0]?.count || 0;

      return res.json({
        message: `Fetched ${filterField} successfully`,
        data: users,
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

  UPDATE_USER_BY_ID: async (req, res) => {
    try {
      const { id } = req.params;
      const user = await USER_MODEL.findOneAndUpdate({ _id: id }, req.body, {
        new: true,
      });

      if (!user) {
        return res.status(404).json({
          status: "error",
          message: "User not found",
        });
      }

      return res.status(200).json({
        message: "User updated successfully",
        data: user,
      });
    } catch (error) {
      return handleError(error, res);
    }
  },
  UPDATE_USER_STATUS_BY_ID: async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body; // Get the status from request body
      const suspensionDuration = {
        suspended5: 5 * 24 * 60 * 60 * 1000, // 5 days in milliseconds
        // suspended5: 4 * 60 * 1000, // 5 days in milliseconds
        suspended30: 30 * 24 * 60 * 60 * 1000, // 30 days in milliseconds
        inactive: 0, // For inactive, no suspension end date
      };

      // Determine the suspendedUntil date if the status is "suspended"
      let suspendedUntil = null;
      if (status === "suspended5") {
        suspendedUntil = new Date(Date.now() + suspensionDuration.suspended5);
      } else if (status === "suspended30") {
        suspendedUntil = new Date(Date.now() + suspensionDuration.suspended30);
      }

      // Update the user's status and handle the suspension
      const user = await USER_MODEL.findOneAndUpdate(
        { _id: id },
        {
          "status.status": status === "inactive" ? "inActive" : status, // Set to inactive if the status is "inactive"
          "status.suspendedUntil": suspendedUntil, // Update suspendedUntil if the user is suspended
          updatedAt: new Date(),
        },
        { new: true } // Return the updated user data
      );

      // Check if the user was found and updated
      if (!user) {
        return res.status(404).json({
          status: "error",
          message: "User not found",
        });
      }

      return res.status(200).json({
        message: "User updated successfully",
        data: user,
      });
    } catch (error) {
      return handleError(error, res); // Handle any errors
    }
  },

  DELETE_USER_BY_ID: async (req, res) => {
    try {
      const { id } = req.params;
      const user = await USER_MODEL.findByIdAndDelete({ _id: id });

      if (!user) {
        return res.status(404).json({
          status: "error",
          message: "User not found",
        });
      }

      return res.status(200).json({
        message: "User deleted successfully",
        data: user,
      });
    } catch (error) {
      return handleError(error, res);
    }
  },
  FIND_AGE_AND_GENDER_STATS: async (req, res) => {
    try {
      // Fetch all users
      const users = await USER_MODEL.find();

      // Filter users who have gender data
      const usersWithGender = users.filter(
        (user) =>
          user.gender && (user.gender === "Male" || user.gender === "Female")
      );

      // Filter users who have valid date of birth for age calculation
      const usersWithAge = users.filter(
        (user) => user.dob && calculateAge(user.dob) >= 0
      );

      // Initialize variables for gender
      let genderCount = { male: 0, female: 0 };
      const ageRanges = [
        { range: "13 - 17 Yrs", count: 0 },
        { range: "18 - 24 Yrs", count: 0 },
        { range: "25 - 34 Yrs", count: 0 },
        { range: "35 - 44 Yrs", count: 0 },
        { range: "45 - 54 Yrs", count: 0 },
        { range: "55+ Yrs", count: 0 },
      ];

      usersWithGender.forEach((user) => {
        if (user.gender === "Male") genderCount.male++;
        else if (user.gender === "Female") genderCount.female++;
      });

      usersWithAge.forEach((user) => {
        const age = calculateAge(user.dob);

        if (age >= 13 && age <= 17) ageRanges[0].count++;
        else if (age >= 18 && age <= 24) ageRanges[1].count++;
        else if (age >= 25 && age <= 34) ageRanges[2].count++;
        else if (age >= 35 && age <= 44) ageRanges[3].count++;
        else if (age >= 45 && age <= 54) ageRanges[4].count++;
        else if (age >= 55) ageRanges[5].count++;
      });

      const totalUsersWithGender = usersWithGender.length;
      const totalUsersWithAge = usersWithAge.length;

      let currentAngle = 0;
      const ageData = ageRanges
        .map((range, index) => {
          const percentage =
            totalUsersWithAge > 0
              ? Math.round((range.count / totalUsersWithAge) * 100)
              : 0;

          const startAngle = currentAngle;
          currentAngle += percentage * 3.6;

          return {
            ...range,
            percentage,
            startAngle,
            color: getColorForRange(index),
          };
        })
        .filter((range) => range.count > 0);
      const genderData = [];

      if (totalUsersWithGender > 0) {
        let genderAngle = 0;

        if (genderCount.male > 0) {
          const malePercentage = Math.round(
            (genderCount.male / totalUsersWithGender) * 100
          );
          genderData.push({
            gender: "Male",
            percentage: parseFloat(malePercentage),
            color: "#F83EFF,#6AD3FF",
            startAngle: genderAngle,
          });
          genderAngle += malePercentage * 3.6;
        }

        if (genderCount.female > 0) {
          const femalePercentage = Math.round(
            (genderCount.female / totalUsersWithGender) * 100
          );
          genderData.push({
            gender: "Female",
            percentage: parseFloat(femalePercentage),
            color: "#3DFFB4,#FFA2E9",
            startAngle: genderAngle,
          });
        }
      }

      res.json({
        ageData,
        genderData,
        stats: {
          totalUsers: users.length,
          usersWithGenderData: totalUsersWithGender,
          usersWithAgeData: totalUsersWithAge,
        },
      });
    } catch (error) {
      console.error(error);

      return handleError(error, res);
    }
  },

  REQUEST_PASSWORD_RESET_FOR_USER: async (req, res) => {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          message: "User ID is required",
        });
      }

      // Find user by ID
      const user = await USER_MODEL.findById(id);

      if (!user) {
        return res.status(404).json({
          message: "User not found",
        });
      }

      if (user.isDeleted) {
        return res.status(400).json({
          message: "Cannot reset password for deleted user",
        });
      }

      // Generate secure token
      const randomBytes = crypto.randomBytes(32);
      const token = randomBytes.toString("base64url");

      // Hash the token before storing (bcrypt with 12 rounds)
      const tokenHash = await bcrypt.hash(token, 12);

      // Set expiry to 12 hours from now
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 12);

      // Delete any existing tokens for this user (cleanup - only one active token per user)
      await PASSWORD_RESET_TOKEN_MODEL.deleteMany({
        userId: user._id,
      });

      // Store token hash in database
      await PASSWORD_RESET_TOKEN_MODEL.create({
        userId: user._id,
        tokenHash,
        expiresAt,
      });

      // Build reset URL (token only, no userId) - using open subdomain
      const resetUrlBase =
        process.env.RESET_URL_BASE || "http://localhost:3000";
      const resetUrl = `${resetUrlBase}/auth/reset?token=${encodeURIComponent(
        token
      )}`;

      // Send email (don't await - fire and forget for faster response)
      sendPasswordResetEmail({
        to: user.email,
        resetUrl,
        userName: user.name || user.email,
      }).catch((error) => {
        console.error("Failed to send password reset email:", error);
        // Don't throw - we've already created the token
      });

      return res.status(200).json({
        message: "Password reset email sent successfully",
      });
    } catch (error) {
      return handleError(error, res);
    }
  },
};
