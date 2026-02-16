const {
  USER_MODEL,
  VIDEO_MODEL,
  PLAYLIST_MODEL,
  SPONSOR_ANALYTICS,
  VIDEO_LIKE_MODEL,
  VIDEO_IMPRESSION_MODEL,
  VIDEO_WATCH_TIME_MODEL,
  FOLLOWED_PLAYLIST_MODEL,
  ADMIN_NOTIFICATION,
  USER_ACTIVITY_MODEL,
  USER_ADDRESS_MODEL,
  NOTIFICATION_PREFERENCES_MODEL,
} = require("../../models");
const stytch = require("stytch");
const {
  hashPassword,
  comparewPassword,
  generateAccessToken,
  generateRefreshToken,
} = require("../../helpers/user");
const handleError = require("../../utils/errorHandler");
const parseFilter = require("../../utils/parseFilter");
const axios = require("axios");
const saveOrUpdateUserAddress = require("../../helpers/userAddress");
const { getRequestIp } = require("../../utils/getRequestIp");

const client = new stytch.Client({
  project_id: process.env.STYTCH_PROJECT_ID,
  secret: process.env.STYTCH_SECRET,
  env:
    process.env.STYTCH_ENVIRONMENT === "development"
      ? stytch.envs.test
      : stytch.envs.live,
});

const addCloudFrontToPlaylists = (playlists) => {
  const cloudFrontUrl = process.env.CLOUD_FRONT_URL;

  const replaceWithCloudFront = (url) => {
    if (!url || !url.includes("s3")) return url;
    const parts = url.split("/");
    const fileKey = parts.slice(3).join("/");
    return cloudFrontUrl + fileKey;
  };

  const transformVideo = (video) => {
    if (video?.s3BucketId) {
      video.url = cloudFrontUrl + video.s3BucketId;
    }

    if (video?.thumbnailUrl) {
      video.thumbnailUrl = replaceWithCloudFront(video.thumbnailUrl);
    }

    if (video?.owner?.profilePic) {
      video.owner.profilePic = replaceWithCloudFront(video.owner.profilePic);
    }

    if (video?.owner?.coverImage) {
      video.owner.coverImage = replaceWithCloudFront(video.owner.coverImage);
    }

    return video;
  };

  const transformPlaylist = (playlist) => {
    if (playlist?.imageUrl) {
      playlist.imageUrl = replaceWithCloudFront(playlist.imageUrl);
    }

    if (playlist?.owner?.profilePic) {
      playlist.owner.profilePic = replaceWithCloudFront(
        playlist.owner.profilePic
      );
    }

    if (Array.isArray(playlist?.videos)) {
      playlist.videos = playlist.videos.map((video) => transformVideo(video));
    }

    return playlist;
  };

  return Array.isArray(playlists)
    ? playlists.map((playlist) => transformPlaylist(playlist))
    : transformPlaylist(playlists);
};

const addCloudFrontToUsers = (users) => {
  const cloudFrontUrl = process.env.CLOUD_FRONT_URL;

  const replaceWithCloudFront = (url) => {
    if (!url || !url.includes("s3")) return url;
    const parts = url.split("/");
    const fileKey = parts.slice(3).join("/");
    return cloudFrontUrl + fileKey;
  };

  const transformUser = (user) => {
    if (user?.profilePic) {
      user.profilePic = replaceWithCloudFront(user.profilePic);
    }

    if (user?.coverImage) {
      user.coverImage = replaceWithCloudFront(user.coverImage);
    }

    return user;
  };

  return Array.isArray(users)
    ? users.map((user) => transformUser(user))
    : transformUser(users);
};

const addCloudFrontUrlToUser = (user) => {
  const cloudFrontUrl = process.env.CLOUD_FRONT_URL;

  const replaceWithCloudFront = (url) => {
    if (!url || !url.includes("s3")) return url;

    const parts = url.split("/");
    const fileKey = parts.slice(3).join("/");
    return cloudFrontUrl + fileKey;
  };

  if (user?.profilePic) {
    user.profilePic = replaceWithCloudFront(user.profilePic);
  }

  if (user?.coverImage) {
    user.coverImage = replaceWithCloudFront(user.coverImage);
  }

  return user;
};

const updateUsersWithMissingUsernames = async () => {
  try {
    // Find all users without a username
    const usersWithoutUsername = await USER_MODEL.find({
      $or: [
        { username: { $exists: false } },
        { username: null },
        { username: "" },
      ],
    });

    // Process each user to generate and set a username
    const updatePromises = usersWithoutUsername.map(async (user) => {
      const username = await generateUniqueUsername(user.name || user.email);
      return USER_MODEL.updateOne({ _id: user._id }, { $set: { username } });
    });

    // Wait for all updates to complete
    await Promise.all(updatePromises);

    console.log(
      `Successfully updated ${updatePromises.length} users with usernames`
    );
    return {
      success: true,
      message: `Updated ${updatePromises.length} users with generated usernames`,
      count: updatePromises.length,
    };
  } catch (error) {
    console.error("Error updating users with usernames:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};

module.exports = {
  CREATE: async (req, res) => {
    try {
      const reqData = req.body;
      const ip = getRequestIp(req);

      if (reqData.password) {
        reqData.password = await hashPassword(reqData.password);
      }
      const user = await USER_MODEL.findOne({ email: reqData.email });
      if (user) {
        return res.status(409).json({
          message: "User already exists",
        });
      }
      const data = await USER_MODEL.create(reqData);

      await ADMIN_NOTIFICATION.create({
        title: "New User Registered",
        body: `A new user registered with name ${data.name || data.email}.`,
        type: "users",
        relatedItem: data._id,
      });
      const account = JSON.parse(JSON.stringify(data));

      await saveOrUpdateUserAddress(data?._id, ip);

      // Generate refresh token
      const refreshToken = generateRefreshToken(data);
      const bcrypt = require("bcryptjs");
      const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);
      await USER_MODEL.findByIdAndUpdate(
        data._id,
        { refreshToken: hashedRefreshToken },
        { runValidators: false }
      );

      return res.status(200).json({
        message: "Account created successfully",
        data: { ...account },
        access_token: generateAccessToken(data),
        refresh_token: refreshToken,
      });
    } catch (error) {
      console.log("erro", error);

      return handleError(error, res);
    }
  },

  // Updated backend endpoint for username checking
  CHECK_USERNAME: async (req, res) => {
    try {
      const { username } = req.query;

      if (!username || typeof username !== "string" || !username.trim()) {
        return res.status(400).json({
          available: false,
          message: "Username is required",
        });
      }

      // Clean and validate username
      const cleanedUsername = username.trim().toLowerCase();

      // Check minimum length (5 characters including @)
      if (cleanedUsername.length < 5) {
        return res.status(400).json({
          available: false,
          message: "Username must be at least 5 characters",
        });
      }

      // Ensure username starts with @ symbol
      if (!cleanedUsername.startsWith("@")) {
        return res.status(400).json({
          available: false,
          message: "Username must start with @",
        });
      }

      // Check if username contains only valid characters (@, alphanumeric, underscore)
      const validUsernameRegex = /^@[a-zA-Z0-9_]{4,}$/;
      if (!validUsernameRegex.test(cleanedUsername)) {
        return res.status(400).json({
          available: false,
          message:
            "Username can only contain letters, numbers, and underscores",
        });
      }

      // Check if username already exists in database
      const existingUser = await USER_MODEL.findOne({
        username: cleanedUsername, // Store and compare with @ symbol
      });

      if (existingUser) {
        return res.status(200).json({
          available: false,
          message: "Username already taken",
        });
      }

      return res.status(200).json({
        available: true,
        message: "Username is available",
      });
    } catch (error) {
      console.log("Username check error:", error);
      return handleError(error, res);
    }
  },

  CHECK_EMAIL: async (req, res) => {
    try {
      const { email } = req.query;

      if (!email || typeof email !== "string" || !email.trim()) {
        return res.status(400).json({
          exists: false,
          message: "Email is required",
        });
      }

      // Clean and validate email
      const cleanedEmail = email.trim().toLowerCase();

      // Basic email validation regex
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(cleanedEmail)) {
        return res.status(400).json({
          exists: false,
          message: "Invalid email format",
        });
      }

      // Check if email already exists in database
      const existingUser = await USER_MODEL.findOne({
        email: cleanedEmail,
      });

      if (existingUser) {
        return res.status(200).json({
          exists: true,
          message: "Email already registered",
        });
      }

      return res.status(200).json({
        exists: false,
        message: "Email is available",
      });
    } catch (error) {
      console.log("Email check error:", error);
      return handleError(error, res);
    }
  },

  LOGIN: async (req, res) => {
    try {
      //await updateVideos();

      const reqData = req.body;
      const user = await USER_MODEL.findOne({ email: reqData.email });
      const ip = getRequestIp(req);

      if (!user) {
        return res.status(404).json({
          message: "User not found",
        });
      }

      if (user.isDeleted) {
        return res.status(403).json({
          message: "Account Disabled. Contact admin support.",
        });
      }

      const isPaswordCompared = await comparewPassword(
        reqData.password,
        user.password
      );

      if (!isPaswordCompared) {
        return res.status(400).json({
          message: "Password not matched",
        });
      }

      if (user.status.status === "active") {
        await saveOrUpdateUserAddress(user?._id, ip);

        // Generate refresh token
        const refreshToken = generateRefreshToken(user);
        const bcrypt = require("bcryptjs");
        const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);
        await USER_MODEL.findByIdAndUpdate(
          user._id,
          { refreshToken: hashedRefreshToken },
          { runValidators: false }
        );

        return res.status(200).json({
          message: "Login successful",
          data: { ...user.toObject() }, // Ensure you're sending a clean object
          access_token: generateAccessToken(user),
          refresh_token: refreshToken,
        });
      }
      if (user.status.status === "inActive") {
        return res.status(403).json({
          message:
            "Your account has been banned. Please contact support for more information.",
        });
      }
      if (
        user.status.status === "suspended5" ||
        user.status.status === "suspended30"
      ) {
        const currentTime = new Date();
        const suspendedUntil = new Date(user.status.suspendedUntil);

        if (currentTime >= suspendedUntil) {
          await USER_MODEL.findOneAndUpdate(
            { _id: user._id },
            {
              "status.status": "active",
              "status.suspendedUntil": null,
            },
            { new: true }
          );
          const account = JSON.parse(JSON.stringify(user));

          // Generate refresh token
          const refreshToken = generateRefreshToken(user);
          const bcrypt = require("bcryptjs");
          const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);
          await USER_MODEL.findByIdAndUpdate(
            user._id,
            { refreshToken: hashedRefreshToken },
            { runValidators: false }
          );

          return res.status(200).json({
            message: "Login successful",
            data: { ...account },
            access_token: generateAccessToken(user),
            refresh_token: refreshToken,
          });
        }

        const timeLeft = suspendedUntil - currentTime;

        const daysLeft = Math.floor(timeLeft / (1000 * 3600 * 24)); // Full days
        const hoursLeft = Math.floor(
          (timeLeft % (1000 * 3600 * 24)) / (1000 * 3600)
        ); // Full hours
        const minutesLeft = Math.floor(
          (timeLeft % (1000 * 3600)) / (1000 * 60)
        ); // Full minutes
        const secondsLeft = Math.floor((timeLeft % (1000 * 60)) / 1000); // Remaining seconds

        let timeLeftMessage = "";

        if (daysLeft > 0) {
          timeLeftMessage += `${daysLeft} day(s) `;
        }
        if (hoursLeft > 0) {
          timeLeftMessage += `${hoursLeft} hour(s) `;
        }
        if (minutesLeft > 0) {
          timeLeftMessage += `${minutesLeft} minute(s) `;
        }
        if (secondsLeft > 0) {
          timeLeftMessage += `${secondsLeft} second(s) `;
        }

        return res.status(403).json({
          message: `Your account is suspended. You can log in in ${timeLeftMessage}.`,
        });
      }

      const account = JSON.parse(JSON.stringify(user));
      await saveOrUpdateUserAddress(user?._id, ip);

      // Generate refresh token
      const refreshToken = generateRefreshToken(user);
      const bcrypt = require("bcryptjs");
      const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);
      await USER_MODEL.findByIdAndUpdate(
        user._id,
        { refreshToken: hashedRefreshToken },
        { runValidators: false }
      );

      return res.status(200).json({
        message: "Login successful",
        data: { ...account },
        access_token: generateAccessToken(user),
        refresh_token: refreshToken,
      });
    } catch (error) {
      return handleError(error, res);
    }
  },

  SEND_CODE: async (req, res) => {
    try {
      const { email } = req.body;
      const resp = await client.otps.email.loginOrCreate({ email });
      if (resp.status_code === 200) {
        return res.status(200).json({
          message: "Verification code sent to your registered email",
          data: resp,
        });
      }
      return res.status(400).json({
        message: "Failed to send verification code",
      });
    } catch (error) {
      return handleError(error, res);
    }
  },

  VERIFY_CODE: async (req, res) => {
    try {
      const { emailId, code, email } = req.body;

      console.log("req.body", req.body);

      if (!emailId || !code) {
        return res.status(400).json({
          message: "Email ID and code are required",
        });
      }
      const params = {
        method_id: emailId,
        code: code,
        session_duration_minutes:
          parseInt(process.env.STYTCH_AUTH_SESSION) || 60,
      };
      const resp = await client.otps.authenticate(params);
      if (resp.status_code === 200) {
        const user = await USER_MODEL.findOne({ email: email });

        if (user) {
          user.emailVerified = true;
          await user.save();
          return res.status(200).json({
            message: "email verification successful",
            data: true,
            userId: user._id,
          });
        } else {
          return res.status(200).json({
            message: "email verification successful",
            data: true,
          });
        }
      }
      return res.status(400).json({
        message: "Invalid or expired verification code",
      });
    } catch (error) {
      console.log("error", error);

      return handleError(error, res);
    }
  },

  VERIFY_CODE_AND_SIGNUP: async (req, res) => {
    try {
      const { emailId, code, email, firstName, lastName, username, password } =
        req.body;
      const ip = getRequestIp(req);

      if (!emailId || !code) {
        return res.status(400).json({
          message: "Email ID and code are required",
        });
      }

      if (!email || !firstName || !lastName || !username || !password) {
        return res.status(400).json({
          message:
            "Email, firstName, lastName, username, and password are required",
        });
      }

      // Verify OTP using Stytch
      const params = {
        method_id: emailId,
        code: code,
        session_duration_minutes:
          parseInt(process.env.STYTCH_AUTH_SESSION) || 60,
      };
      const resp = await client.otps.authenticate(params);

      if (resp.status_code !== 200) {
        return res.status(400).json({
          message: "Invalid or expired verification code",
        });
      }

      // Check if user already exists
      const existingUser = await USER_MODEL.findOne({
        email: email.toLowerCase().trim(),
      });
      if (existingUser) {
        return res.status(409).json({
          message: "User already exists",
        });
      }

      // Check if username already exists
      const cleanedUsername = username.trim().toLowerCase();
      const existingUsername = await USER_MODEL.findOne({
        username: cleanedUsername,
      });
      if (existingUsername) {
        return res.status(409).json({
          message: "Username already taken",
        });
      }

      // Prepare user data
      const userData = {
        email: email.toLowerCase().trim(),
        name: firstName.trim(),
        lastName: lastName.trim(),
        username: cleanedUsername,
        password: await hashPassword(password),
        emailVerified: true,
      };

      // Create user
      const data = await USER_MODEL.create(userData);

      await ADMIN_NOTIFICATION.create({
        title: "New User Registered",
        body: `A new user registered with name ${data.name || data.email}.`,
        type: "users",
        relatedItem: data._id,
      });
      const account = JSON.parse(JSON.stringify(data));

      await saveOrUpdateUserAddress(data?._id, ip);

      // Generate refresh token
      const refreshToken = generateRefreshToken(data);
      const bcrypt = require("bcryptjs");
      const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);
      await USER_MODEL.findByIdAndUpdate(
        data._id,
        { refreshToken: hashedRefreshToken },
        { runValidators: false }
      );

      return res.status(200).json({
        message: "Account created successfully",
        data: { ...account },
        access_token: generateAccessToken(data),
        refresh_token: refreshToken,
      });
    } catch (error) {
      console.log("VERIFY_CODE_AND_SIGNUP error", error);
      return handleError(error, res);
    }
  },

  COMPLETE_SIGNUP: async (req, res) => {
    try {
      const user = req.user; // From protectRoutes middleware
      const {
        hasAcceptedTerms,
        hasAcceptedPrivacyPolicy,
        profilePic,
        dob,
        gender,
      } = req.body;

      if (!user) {
        return res.status(404).json({
          message: "User not found",
        });
      }

      if (
        hasAcceptedTerms === undefined ||
        hasAcceptedPrivacyPolicy === undefined
      ) {
        return res.status(400).json({
          message: "hasAcceptedTerms and hasAcceptedPrivacyPolicy are required",
        });
      }

      // Prepare update data
      const updateData = {
        hasAcceptedTerms: hasAcceptedTerms,
        hasAcceptedPrivacyPolicy: hasAcceptedPrivacyPolicy,
      };

      if (profilePic !== undefined) updateData.profilePic = profilePic;
      if (dob !== undefined) updateData.dob = dob;
      if (gender !== undefined) updateData.gender = gender;

      // Update user
      const updatedUser = await USER_MODEL.findByIdAndUpdate(
        user._id,
        updateData,
        { new: true, select: "-password" }
      );

      return res.status(200).json({
        message: "Signup completed successfully",
        data: addCloudFrontUrlToUser(updatedUser),
      });
    } catch (error) {
      console.log("COMPLETE_SIGNUP error", error);
      return handleError(error, res);
    }
  },

  FIND_ALL: async (req, res) => {
    try {
      console.log("here");

      const {
        perPage = 10,
        pageNo = 1,
        searchString = "",
        isFeatured,
        isDeleted,
        permissions,
        role,
        isVerified,
        inActive,
        accountType,
      } = req.query;

      const skip = perPage * (pageNo - 1);

      const query = {};

      if (searchString) {
        query.$or = [
          { name: { $regex: searchString, $options: "i" } },
          { email: { $regex: searchString, $options: "i" } },
          { username: { $regex: searchString, $options: "i" } },
        ];
      }

      if (isFeatured !== undefined) query.isFeatured = isFeatured === "true";
      if (isDeleted !== undefined) query.isDeleted = isDeleted === "true";
      if (permissions) query.permissions = permissions;
      if (role) query.role = role;
      if (isVerified !== undefined) query.isVerified = isVerified === "true";
      if (inActive !== undefined) query.inActive = inActive === "true";
      if (accountType) query.accountType = accountType;

      const currentUserId = req.user?._id;

      if (currentUserId) {
        query.$and = [
          { _id: { $ne: currentUserId } },
          { blockedUsers: { $ne: currentUserId } },
          {
            _id: {
              $nin: await USER_MODEL.findById(currentUserId).select(
                "blockedUsers"
              ),
            },
          },
        ];
      }

      const users = await USER_MODEL.find(query)
        .select("-password")
        .skip(skip)
        .limit(parseInt(perPage))
        .sort({ createdAt: -1 });

      return res.status(200).json({
        message: "Users retrieved successfully",
        data: addCloudFrontToUsers(users),
      });
    } catch (error) {
      return res.status(500).json({
        message: "Error retrieving users",
        error: error.message,
      });
    }
  },

  RESET_PASSWORD_UPDATE: async (req, res) => {
    try {
      const { email, newPassword } = req.body;

      if (!email || !newPassword) {
        return res.status(400).json({
          message: "Email and new password are required",
        });
      }

      const user = await USER_MODEL.findOne({ email });
      if (!user) {
        return res.status(404).json({
          message: "User not found",
        });
      }

      user.emailVerified = true;
      user.password = await hashPassword(newPassword);
      await user.save();

      return res.status(200).json({
        message: "Password updated successfully",
      });
    } catch (error) {
      return handleError(error, res);
    }
  },

  FIND_ALL_FEATURED: async (req, res) => {
    try {
      const { perPage = 10, pageNo = 1 } = req.query;
      const skip = perPage * (pageNo - 1);
      const user = req.user;

      const featuredUsers = await USER_MODEL.find(
        {
          isFeatured: true,
          _id: { $nin: user?.blockedUsers },
        },
        null,
        {
          sort: { createdAt: -1, _id: -1 },
          limit: parseInt(perPage),
          skip,
        }
      );

      if (!featuredUsers.length) {
        return res.status(404).json({
          status: "error",
          message: "No users found",
        });
      }

      return res.status(200).json({
        message: "users retrieved successfully",
        data: featuredUsers,
      });
    } catch (error) {
      console.log(error);

      return handleError(error, res);
    }
  },

  SEARCH_FEATURED_USERS: async (req, res) => {
    try {
      const { name } = req.params;
      const user = req.user;

      const featuredUsers = await USER_MODEL.find({
        isFeatured: true,
        _id: { $nin: user?.blockedUsers },
        name: { $regex: name, $options: "i" },
      });

      if (!featuredUsers.length) {
        return res.status(404).json({
          message: "No featured users found",
          data: [],
        });
      }

      return res.status(200).json({
        message: "Featured users retrieved successfully",
        data: featuredUsers,
      });
    } catch (error) {
      return handleError(error, res);
    }
  },

  FIND_ONE: async (req, res) => {
    try {
      const { id } = req.params;
      const user = await USER_MODEL.findOne({ _id: id });

      if (!user) {
        return res.status(404).json({
          message: "User not found",
        });
      }

      return res.status(200).json({
        message: "User retrieved successfully",
        data: addCloudFrontUrlToUser(user),
      });
    } catch (error) {
      return handleError(error, res);
    }
  },

  GET_LOGED_USER: async (req, res) => {
    try {
      const currentUser = req.user;
      const ip = getRequestIp(req);

      if (!currentUser) {
        return res.status(404).json({
          message: "User not found",
        });
      }

      if (currentUser.status.status === "inActive") {
        return res.status(200).json({
          message:
            "Your account has been banned. Please contact support for more information.",
        });
      }

      if (
        currentUser.status.status === "suspended5" ||
        currentUser.status.status === "suspended30"
      ) {
        const currentTime = new Date();
        const suspendedUntil = new Date(currentUser.status.suspendedUntil);

        if (currentTime >= suspendedUntil) {
          await USER_MODEL.findOneAndUpdate(
            { _id: currentUser._id },
            {
              "status.status": "active",
              "status.suspendedUntil": null,
            },
            { new: true }
          );

          return res.status(200).json({
            message: "User retrieved successfully",
            data: currentUser,
          });
        }

        const timeLeft = suspendedUntil - currentTime;

        const daysLeft = Math.floor(timeLeft / (1000 * 3600 * 24)); // Full days
        const hoursLeft = Math.floor(
          (timeLeft % (1000 * 3600 * 24)) / (1000 * 3600)
        ); // Full hours
        const minutesLeft = Math.floor(
          (timeLeft % (1000 * 3600)) / (1000 * 60)
        ); // Full minutes
        const secondsLeft = Math.floor((timeLeft % (1000 * 60)) / 1000); // Remaining seconds

        let timeLeftMessage = [];

        if (daysLeft > 0) timeLeftMessage.push(`${daysLeft} day(s)`);
        if (hoursLeft > 0) timeLeftMessage.push(`${hoursLeft} hour(s)`);
        if (minutesLeft > 0) timeLeftMessage.push(`${minutesLeft} minute(s)`);
        if (secondsLeft > 0) timeLeftMessage.push(`${secondsLeft} second(s)`);

        timeLeftMessage = timeLeftMessage.join(" ");

        return res.status(200).json({
          message: `Your account is suspended. You can log in in ${timeLeftMessage}.`,
        });
      }
      await saveOrUpdateUserAddress(currentUser?._id, ip);

      return res.status(200).json({
        message: "User retrieved successfully",
        data: currentUser,
      });
    } catch (error) {
      return handleError(error, res);
    }
  },

  UPDATE_BY_ID: async (req, res) => {
    try {
      const { id } = req.params;
      const { oldPassword, password, email, ...rest } = req.body;

      // Find the user
      const user = await USER_MODEL.findById(id);
      if (!user) {
        return res.status(404).json({
          message: "User not found",
        });
      }

      // If updating password, validate the old password
      if (password) {
        // Validate old password
        const isPasswordValid = await comparewPassword(
          oldPassword,
          user.password
        );
        if (!isPasswordValid) {
          return res.status(400).json({
            message: "Current password is incorrect",
          });
        }

        // Hash the new password
        rest.password = await hashPassword(password);
      }

      // If updating email, update it
      if (email) {
        const user = await USER_MODEL.findOne({ email: email });
        if (user) {
          return res.status(409).json({
            message: "Email already exists",
          });
        }

        rest.email = email;
      }

      // Update the user
      const updatedUser = await USER_MODEL.findByIdAndUpdate(id, rest, {
        new: true,
        select: "-password", // Exclude password from returned data
      });

      return res.status(200).json({
        message: "User updated successfully",
        data: updatedUser,
      });
    } catch (error) {
      return handleError(error, res);
    }
  },

  DELETE_BY_ID: async (req, res) => {
    try {
      const { id } = req.params;

      await Promise.all([
        USER_MODEL.findByIdAndDelete(id),
        VIDEO_MODEL.deleteMany({ owner: id }),
        PLAYLIST_MODEL.deleteMany({ owner: id }),
      ]);

      return res.status(200).json({
        message: "User and associated data deleted successfully",
      });
    } catch (error) {
      return handleError(error, res);
    }
  },

  VERIFY_CREDENTIALS: async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          message: "Email and password are required",
        });
      }

      // Find the user by email
      const user = await USER_MODEL.findOne({ email });

      if (!user) {
        return res.status(401).json({
          message: "Invalid credentials",
          authenticated: false,
        });
      }

      // Verify the password
      const passwordMatch = await comparewPassword(password, user.password);

      if (!passwordMatch) {
        return res.status(401).json({
          message: "Invalid credentials",
          authenticated: false,
        });
      }

      // Return success
      return res.status(200).json({
        message: "Credentials verified successfully",
        authenticated: true,
        userId: user._id,
      });
    } catch (error) {
      return handleError(error, res);
    }
  },

  BLOCK_UNBLOCK: async (req, res) => {
    try {
      const user = req.user;
      const userId = req.params.userId;

      if (!user) {
        return res.status(404).json({
          message: "User not found",
        });
      }

      const isBlocked = user.blockedUsers.includes(userId);

      if (isBlocked) {
        user.blockedUsers = user.blockedUsers.filter((id) => id != userId);
      } else {
        user.blockedUsers.push(userId);
        user.followers = user.followers.filter((id) => id != userId);
        user.following = user.following.filter((id) => id != userId);
      }

      await user.save();

      return res.status(200).json({
        message: isBlocked
          ? "User unblocked successfully"
          : "User blocked successfully",
        data: user,
      });
    } catch (error) {
      return handleError(error, res);
    }
  },

  FOLLOW_UNFOLLOW_PLAYLIST: async (req, res) => {
    try {
      const userId = req.user._id;
      const playListId = req.params.playListId;

      const user = await USER_MODEL.findById(userId);
      const playlist = await PLAYLIST_MODEL.findById(playListId);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (!playlist) {
        return res.status(404).json({ message: "Playlist not found" });
      }

      const isFollowing = user.followingPlayLists?.includes(playListId);

      if (isFollowing) {
        // Unfollow: Remove from user's following list
        user.followingPlayLists = user.followingPlayLists.filter(
          (id) => id.toString() !== playListId
        );

        // Also remove user from playlist's followingPlayLists
        playlist.followingPlayLists = playlist.followingPlayLists.filter(
          (entry) => entry.user.toString() !== userId.toString()
        );

        await FOLLOWED_PLAYLIST_MODEL.deleteOne({
          userId: userId,
          playlistId: playListId,
        });
      } else {
        // Follow: Add to user's following list
        user.followingPlayLists = user.followingPlayLists || [];
        user.followingPlayLists.push(playListId);

        // Add user and date to playlist's followingPlayLists
        playlist.followingPlayLists = playlist.followingPlayLists || [];
        playlist.followingPlayLists.push({
          user: userId,
          date: new Date(),
        });

        const followedPlaylist = new FOLLOWED_PLAYLIST_MODEL({
          userId: userId,
          playlistId: playListId,
          ownerId: playlist.owner,
        });
        await followedPlaylist.save();
      }

      await user.save();
      await playlist.save();

      return res.status(200).json({
        message: isFollowing
          ? "Playlist unfollowed successfully"
          : "Playlist followed successfully",
        data: user,
      });
    } catch (error) {
      console.error("Error in FOLLOW_UNFOLLOW_PLAYLIST:", error);
      return handleError(error, res);
    }
  },

  BLOCKED_USERS_LIST: async (req, res) => {
    try {
      const user = await USER_MODEL.findOne({ _id: req.user._id }).populate(
        "blockedUsers"
      );

      if (!user) {
        return res.status(404).json({
          message: "User not found",
          data: [],
        });
      }

      return res.status(200).json({
        message: "Blocked users retrieved successfully",
        data: user.blockedUsers,
      });
    } catch (error) {
      return handleError(error, res);
    }
  },

  FOLLOW_UNFOLLOW: async (req, res) => {
    try {
      const userId = req.params.userId; // User to be followed/unfollowed
      const requesterId = req.user._id; // Logged-in user (follower)

      // Validate if user is trying to follow themselves
      if (userId === requesterId.toString()) {
        return res.status(400).json({
          success: false,
          message: "You cannot follow yourself!",
        });
      }

      // 1. Check current follow state using lean() for performance
      const requesterUser = await USER_MODEL.findById(requesterId)
        .select('following')
        .lean();

      if (!requesterUser) {
        return res.status(404).json({
          success: false,
          message: "User not found!",
        });
      }

      const isFollowing = requesterUser.following.some(
        id => id.toString() === userId
      );

      // 2. Use ATOMIC operations (not .save())
      if (isFollowing) {
        // UNFOLLOW
        await Promise.all([
          USER_MODEL.updateOne(
            { _id: requesterId },
            { $pull: { following: userId } }
          ),
          USER_MODEL.updateOne(
            { _id: userId },
            { $pull: { followers: requesterId } }
          ),
          NOTIFICATION_PREFERENCES_MODEL.deleteOne({
            userId: requesterId,
            targetUserId: userId,
          }),
        ]);
      } else {
        // FOLLOW
        await Promise.all([
          USER_MODEL.updateOne(
            { _id: requesterId },
            { $addToSet: { following: userId } }
          ),
          USER_MODEL.updateOne(
            { _id: userId },
            { $addToSet: { followers: requesterId } }
          ),
          NOTIFICATION_PREFERENCES_MODEL.updateOne(
            { userId: requesterId, targetUserId: userId },
            {
              $set: {
                'preferences.newVideo': true,
                'preferences.newPlaylist': true,
              },
            },
            { upsert: true }
          ),
        ]);
      }

      // 3. Fetch and return updated user
      const updatedUser = await USER_MODEL.findById(requesterId)
        .select('-password -refreshToken')
        .lean();

      return res.status(200).json({
        success: true,
        message: isFollowing
          ? "Unfollowed successfully"
          : "Followed successfully",
        data: {
          ...updatedUser,
          following: updatedUser.following.map((id) => id.toString()),
          followers: updatedUser.followers.map((id) => id.toString()),
        },
      });
    } catch (error) {
      console.error("Follow/Unfollow Error:", error);
      return res.status(500).json({
        success: false,
        message: "Something went wrong",
        error: error.message,
      });
    }
  },

  GET_SOCIAL_CONNECTIONS: async (req, res) => {
    try {
      const { userId, type } = req.params; // type can be 'followers' or 'following'

      if (type !== "followers" && type !== "following") {
        return res.status(400).json({
          message: "Invalid type parameter. Must be 'followers' or 'following'",
        });
      }

      const user = await USER_MODEL.findById(userId).populate(type);

      if (user && user[type].length > 0) {
        return res.status(200).json({
          message: `${type} list retrieved successfully`,
          data: user[type],
        });
      }

      return res.status(404).json({ message: `No ${type} available` });
    } catch (error) {
      return handleError(error, res);
    }
  },

  GET_USER_TABS_STATS: async (req, res) => {
    try {
      const userId = req.params.id;
      const currentUser = req.user;

      // Check if user exists
      const user = await USER_MODEL.findById(userId);
      if (!user) {
        return res.status(404).json({
          message: "User not found",
        });
      }

      // Determine if current user is the profile owner
      const isOwnProfile =
        currentUser && currentUser._id.toString() === userId.toString();

      // Video query conditions
      const videoConditions = {
        owner: userId,
        isDeleted: false,
      };

      // If not the profile owner, only show public videos
      if (!isOwnProfile) {
        videoConditions.isPrivate = false;
      }

      // Get counts for all tabs in parallel
      const [publicPlaylists, privatePlaylists, videos] = await Promise.all([
        // Count public playlists
        PLAYLIST_MODEL.countDocuments({
          owner: userId,
          isPrivate: false,
        }),

        // Count private playlists (only if viewing own profile)
        isOwnProfile
          ? PLAYLIST_MODEL.countDocuments({
            owner: userId,
            isPrivate: true,
          })
          : 0,

        // Count videos - all for owner, only public for others
        VIDEO_MODEL.countDocuments(videoConditions),
      ]);

      const followedPlaylistIds = user.followingPlayLists || [];
      const existingFollowedCount = await PLAYLIST_MODEL.countDocuments({
        _id: { $in: followedPlaylistIds },
        isDeleted: false,
      });

      return res.status(200).json({
        message: "User stats retrieved successfully",
        data: {
          public: publicPlaylists,
          private: privatePlaylists,
          followed: existingFollowedCount,
          videos: videos,
          isOwnProfile: isOwnProfile, // Include this flag for the frontend
        },
      });
    } catch (error) {
      return handleError(error, res);
    }
  },
  TRACK_SPONSOR_STATS: async (req, res) => {
    try {
      const {
        userId,
        sponsorId,
        impression,
        visitLink,
        profileView,
        source,
        like,
      } = req.body;

      if (!userId || !sponsorId) {
        return res
          .status(400)
          .json({ message: "userId and sponsorId are required" });
      }

      const eventsToTrack = [];

      if (impression === true) {
        eventsToTrack.push("impression");
      }
      if (visitLink === true) {
        eventsToTrack.push("visitLink");
      }
      if (profileView === true) {
        eventsToTrack.push("profileView");
      }

      if (like === true) {
        const existingLike = await SPONSOR_ANALYTICS.findOne({
          user: userId,
          sponsor: sponsorId,
          eventType: "like",
        });

        if (existingLike) {
          await existingLike.deleteOne(); // If already liked → remove the like
          return res.status(200).json({ message: "Like removed" });
        } else {
          const newLike = await SPONSOR_ANALYTICS.create({
            user: userId,
            sponsor: sponsorId,
            eventType: "like",
          });
          return res.status(201).json({
            message: "Like added",
            data: newLike,
          });
        }
      }

      if (eventsToTrack.length === 0) {
        return res.status(400).json({ message: "No valid events to track" });
      }

      const createdEvents = await Promise.all(
        eventsToTrack.map((eventType) => {
          return SPONSOR_ANALYTICS.create({
            user: userId,
            sponsor: sponsorId,
            eventType,
          });
        })
      );

      return res.status(201).json({
        message: "Sponsor analytics events recorded",
        data: createdEvents,
      });
    } catch (err) {
      console.error("Sponsor Analytics Error:", err);
      return res.status(500).json({
        message: "Server error",
        error: err.message || err,
      });
    }
  },

  TRACK_VIDEO_ANALYTICS: async (req, res) => {
    try {
      const { userId, videoId, like, impression, watchDuration } = req.body;

      if (!videoId) {
        return res.status(400).json({ message: "videoId is required" });
      }

      const video = await VIDEO_MODEL.findById(videoId);
      if (!video) {
        return res.status(404).json({ message: "Video not found" });
      }

      const userIdStr = String(userId);

      const now = new Date();

      if (like === true) {
        try {
          await VIDEO_LIKE_MODEL.create({
            video: videoId,
            user: userId,
            date: now,
          });
        } catch (err) {
          if (err.code !== 11000) {
            throw err;
          }
        }
        if (!video.likes.includes(userIdStr)) {
          video.likes.push(userIdStr);
          await video.save();
        }
      } else if (like === false) {
        await VIDEO_LIKE_MODEL.deleteOne({ video: videoId, user: userIdStr });
        video.likes = video.likes.filter((id) => id !== userIdStr);
        await video.save();
      }

      if (impression === true) {
        await VIDEO_IMPRESSION_MODEL.create({
          video: videoId,
          user: userId,
          date: now,
        });
        await VIDEO_MODEL.findByIdAndUpdate(
          videoId,
          { $inc: { viewCount: 1 } },
          { new: true }
        );
      }

      if (
        watchDuration &&
        typeof watchDuration === "number" &&
        watchDuration >= 0
      ) {
        await VIDEO_WATCH_TIME_MODEL.create({
          video: videoId,
          user: userId,
          date: now,
          duration: watchDuration,
        });
      }

      return res.status(200).json({
        message: "Video analytics updated successfully",
      });
    } catch (err) {
      console.error("Video Analytics Error:", err);
      return res.status(500).json({
        message: "Server error",
        error: err.message || err,
      });
    }
  },
  INCREMENT_APP_OPEN: async (req, res) => {
    try {
      const user = req.user;

      if (!user) {
        return res.status(401).json({
          status: "error",
          message: "Unauthorized",
        });
      }

      let newCount = (user.appOpenCount || 0) + 1;

      if (newCount >= 5) {
        newCount = 0;
      }

      const updatedUser = await USER_MODEL.findByIdAndUpdate(
        user._id,
        {
          $set: {
            appOpenCount: newCount,
            lastAppOpenedAt: new Date(),
            appState: "active",
          },
        },
        { new: true, runValidators: true }
      );

      if (!updatedUser) {
        return res.status(404).json({
          status: "error",
          message: "User not found",
        });
      }

      const today = new Date().toISOString().split("T")[0];

      await USER_ACTIVITY_MODEL.findOneAndUpdate(
        { userId: user._id, date: today },
        {
          $inc: { appOpenCount: 1, totalVisits: 1 },
          $set: { lastActive: new Date() },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      return res.status(200).json({
        message: "App open count updated successfully",
        data: {
          appOpenCount: updatedUser.appOpenCount,
          lastAppOpenedAt: updatedUser.lastAppOpenedAt,
          appState: updatedUser.appState,
        },
      });
    } catch (error) {
      console.error(error);
      return handleError(error, res);
    }
  },
  UPDATE_APP_STATE: async (req, res) => {
    try {
      const user = req.user;
      const { device, appState } = req.body;

      if (!user) {
        return res.status(401).json({
          status: "error",
          message: "Unauthorized",
        });
      }

      const updateData = {};

      // Validate and fix permissions if it has an invalid value
      const validPermissions = ["null", "requested", "approved", "rejected"];
      if (
        user.permissions &&
        !validPermissions.includes(String(user.permissions))
      ) {
        updateData.permissions = "null";
      }

      if (device) updateData.device = device;
      if (appState) updateData.appState = appState;

      const updatedUser = await USER_MODEL.findByIdAndUpdate(
        user._id,
        { $set: updateData },
        { new: true, runValidators: true }
      );

      if (!updatedUser) {
        return res.status(404).json({
          status: "error",
          message: "User not found",
        });
      }

      if (appState === "active") {
        const today = new Date().toISOString().split("T")[0];

        await USER_ACTIVITY_MODEL.findOneAndUpdate(
          { userId: user._id, date: today },
          {
            $inc: { totalVisits: 1 },
            $set: { lastActive: new Date() },
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
      }

      return res.status(200).json({
        status: "success",
        message: "Updated successfully.",
        data: {
          device: updatedUser.device,
          appState: updatedUser.appState,
        },
      });
    } catch (error) {
      console.error("UPDATE_APP_STATE_ERROR:", error);
      return handleError(error, res);
    }
  },

  FIND_ALL_FEATURED_PLAYLISTS: async (req, res) => {
    try {
      const { perPage = 20, pageNo = 1 } = req.query;
      const skip = perPage * (pageNo - 1);
      const user = req.user;

      const playlists = await PLAYLIST_MODEL.aggregate([
        {
          $match: {
            isPrivate: false,
            isFeatured: true,
            owner: { $nin: user?.blockedUsers || [] },
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
          $lookup: {
            from: "videos",
            localField: "videos",
            foreignField: "_id",
            as: "videos",
            pipeline: [
              {
                $lookup: {
                  from: "users",
                  localField: "owner",
                  foreignField: "_id",
                  as: "owner",
                },
              },
              { $unwind: "$owner" },
            ],
          },
        },
        {
          $project: {
            "owner.password": 0,
            "videos.owner.password": 0,
          },
        },
        {
          $sort: { createdAt: -1, _id: -1 },
        },
        { $skip: parseInt(skip) },
        { $limit: parseInt(perPage) },
      ]);

      if (!playlists.length) {
        return res.status(404).json({
          status: "error",
          message: "No featured playlists found",
        });
      }

      return res.status(200).json({
        message: "Featured playlists retrieved successfully",
        data: addCloudFrontToPlaylists(playlists),
      });
    } catch (error) {
      console.error(error);
      return handleError(error, res);
    }
  },
  FIND_TAG_INFLUENCERS: async (req, res) => {
    try {
      const { search = "" } = req.query;

      // Apply any additional filters (e.g., role = influencer)
      const filter = parseFilter(req.query.filter, res);
      if (filter === null) return;

      // Ensure we are only querying influencers
      const query = { ...filter, role: "influencer" };

      // If there's a search term, apply it to search by name, email, or username
      if (search) {
        query.$or = [
          { name: { $regex: search, $options: "i" } }, // Case-insensitive search by name
          { email: { $regex: search, $options: "i" } }, // Case-insensitive search by email
          { username: { $regex: search, $options: "i" } }, // Case-insensitive search by username
        ];
      }

      // Fetch influencers from the database
      const users = await USER_MODEL.find(query);

      if (!users.length) {
        return res.status(200).json({
          status: "error",
          message: "No influencers found",
        });
      }

      return res.status(200).json({
        message: "Influencers retrieved successfully",
        data: users,
      });
    } catch (error) {
      console.error(error);

      return handleError(error, res);
    }
  },
  FIND_BY_CONNECTYCUBE_ID: async (req, res) => {
    try {
      const { connectyCubeId } = req.params;

      if (!connectyCubeId) {
        return res.status(400).json({
          message: "connectyCubeId is required",
        });
      }

      const user = await USER_MODEL.findOne({ connectyCubeId });

      if (!user) {
        return res.status(404).json({
          message: "User not found",
        });
      }

      return res.status(200).json({
        message: "User fetched successfully",
        data: user,
      });
    } catch (error) {
      console.error("Error fetching user by ConnectyCube ID:", error);
      return handleError(error, res);
    }
  },

  REFRESH_TOKEN: async (req, res) => {
    try {
      const { refresh_token } = req.body;

      if (!refresh_token) {
        return res.status(400).json({
          status: "error",
          message: "Refresh token is required",
        });
      }

      const jwt = require("jsonwebtoken");
      const bcrypt = require("bcryptjs");

      // Verify refresh token (use same secret as generation)
      let decoded;
      try {
        const secretKey =
          process.env.JWT_REFRESH_SECRET_KEY || process.env.JWT_SECRET_KEY;
        if (!secretKey) {
          return res.status(500).json({
            message: "Server configuration error",
          });
        }
        decoded = jwt.verify(refresh_token, secretKey);
      } catch (error) {
        if (error.name === "TokenExpiredError") {
          return res.status(401).json({
            message: "Refresh token has expired",
          });
        }
        if (error.name === "JsonWebTokenError") {
          return res.status(401).json({
            message: "Invalid refresh token signature",
          });
        }
        return res.status(401).json({
          message: "Invalid refresh token",
        });
      }

      if (!decoded || !decoded._id) {
        return res.status(401).json({
          message: "Invalid token payload",
        });
      }

      // Find user by token payload
      const user = await USER_MODEL.findOne({ _id: decoded._id });

      if (!user) {
        return res.status(404).json({
          message: "User not found",
        });
      }

      if (user.isDeleted) {
        return res.status(403).json({
          message: "Account Disabled. Contact admin support.",
        });
      }

      // Validate stored refresh token hash if it exists
      if (user.refreshToken) {
        try {
          const isTokenValid = await bcrypt.compare(
            refresh_token,
            user.refreshToken
          );
          if (!isTokenValid) {
            return res.status(401).json({
              message: "Refresh token does not match stored token",
            });
          }
        } catch (compareError) {
          console.error("Error comparing refresh token:", compareError);
          // If comparison fails, still allow refresh but log the error
        }
      }

      // Generate new access token (using JWT_SECRET_KEY)
      const newAccessToken = generateAccessToken(user);

      // Generate new refresh token and update DB
      const newRefreshToken = generateRefreshToken(user);
      const hashedRefreshToken = await bcrypt.hash(newRefreshToken, 10);
      await USER_MODEL.findByIdAndUpdate(
        user._id,
        { refreshToken: hashedRefreshToken },
        { runValidators: false }
      );

      return res.status(200).json({
        message: "Token refreshed successfully",
        access_token: newAccessToken,
        refresh_token: newRefreshToken,
      });
    } catch (error) {
      console.error("Refresh token error:", error);
      return handleError(error, res);
    }
  },

  LOGOUT: async (req, res) => {
    try {
      const user = req.user; // From protectRoutes middleware

      if (user) {
        // Invalidate refresh token by clearing it from database
        await USER_MODEL.findByIdAndUpdate(
          user._id,
          { refreshToken: null },
          { runValidators: false }
        );
      }

      return res.status(200).json({
        message: "Logged out successfully",
      });
    } catch (error) {
      console.error("Logout error:", error);
      return handleError(error, res);
    }
  },
};
