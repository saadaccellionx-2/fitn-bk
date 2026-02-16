const { SPONSORS_MODEL, VIDEO_MODEL } = require("../../models");
const handleError = require("../../utils/errorHandler");
successResponse = (message, data = null) => {
  return {
    success: "success",
    message,
    data,
  };
};

errorResponse = (message, statusCode = 400, errors = null) => {
  return {
    success: false,
    message,
    statusCode,
    errors,
  };
};

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

// Create a new sponsor
exports.createSponsor = async (req, res) => {
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

    // Validate required fields
    if (!brandName || !logo || !description || !url || !videoId || !shopText) {
      return res.status(400).json(errorResponse("Missing required fields"));
    }

    // Check if video exists
    const videoExists = await VIDEO_MODEL.findById(videoId);
    if (!videoExists) {
      return res.status(404).json(errorResponse("Video not found"));
    }

    const sponsor = new SPONSORS_MODEL({
      brandName,
      logo,
      description,
      url,
      displayText: displayText || "Sponsored",
      videoId,
      coverImage,
      shopImage,
      shopText,
      username: username || generateUniqueUsername(brandName),
    });

    await sponsor.save();

    return res
      .status(201)
      .json(successResponse("Sponsor created successfully", sponsor));
  } catch (error) {
    return handleError(error, res);
  }
};

// Get all sponsors
exports.getAllSponsors = async (req, res) => {
  try {
    const sponsors = await SPONSORS_MODEL.find({ isDeleted: false })
      .populate("videoId")
      .sort({ createdAt: -1 });
    return res
      .status(200)
      .json(successResponse("Sponsors fetched successfully", sponsors));
  } catch (error) {
    console.error("Error fetching sponsors:", error);
    return res.status(500).json(errorResponse("Failed to fetch sponsors"));
  }
};

// Get sponsor by ID
exports.getSponsorById = async (req, res) => {
  try {
    const { id } = req.params;
    const sponsor = await SPONSORS_MODEL.findOne({
      _id: id,
      isDeleted: false,
    }).populate("videoId");

    if (!sponsor) {
      return res.status(404).json(errorResponse("Sponsor not found"));
    }

    return res
      .status(200)
      .json(successResponse("Sponsor fetched successfully", sponsor));
  } catch (error) {
    return handleError(error, res);
  }
};

// Update sponsor
exports.updateSponsor = async (req, res) => {
  try {
    const { id } = req.params;
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

    const sponsor = await SPONSORS_MODEL.findOne({ _id: id, isDeleted: false });

    if (!sponsor) {
      return res.status(404).json(errorResponse("Sponsor not found"));
    }

    // Fix the videoId comparison to handle null/undefined values safely
    if (videoId) {
      // Only check if videoId is provided (not null)
      if (!sponsor.videoId || videoId !== sponsor.videoId.toString()) {
        const videoExists = await VIDEO_MODEL.findById(videoId);
        if (!videoExists) {
          return res.status(404).json(errorResponse("Video not found"));
        }
      }
    }

    // Update the object now handling null/undefined videoId properly
    const updateData = {
      updatedAt: new Date(),
    };

    // Only include fields that are provided in the request or keep existing values
    if (brandName !== undefined) updateData.brandName = brandName;
    if (logo !== undefined) updateData.logo = logo;
    if (description !== undefined) updateData.description = description;
    if (url !== undefined) updateData.url = url;
    if (displayText !== undefined) updateData.displayText = displayText;
    // Handle videoId specially to allow setting to null
    updateData.videoId = videoId; // This allows videoId to be explicitly set to null
    if (coverImage !== undefined) updateData.coverImage = coverImage;
    if (shopImage !== undefined) updateData.shopImage = shopImage;
    if (shopText !== undefined) updateData.shopText = shopText;
    if (username !== undefined) updateData.username = username;

    const updatedSponsor = await SPONSORS_MODEL.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    ).populate("videoId");

    return res
      .status(200)
      .json(successResponse("Sponsor updated successfully", updatedSponsor));
  } catch (error) {
    console.log(error);
    return handleError(error, res);
  }
};
// Delete sponsor
exports.deleteSponsor = async (req, res) => {
  try {
    const { id } = req.params;

    const sponsor = await SPONSORS_MODEL.findOne({ _id: id });

    if (!sponsor) {
      return res.status(404).json(errorResponse("Sponsor not found"));
    }

    await VIDEO_MODEL.findOneAndDelete({ _id: sponsor.videoId });

    // Soft delete
    await SPONSORS_MODEL.findOneAndDelete({ _id: id });

    // Remove sponsor reference from video

    return res
      .status(200)
      .json(successResponse("Sponsor deleted successfully"));
  } catch (error) {
    return handleError(error, res);
  }
};

// Controller
exports.FOLLOW_UNFOLLOW = async (req, res) => {
  try {
    const { targetId } = req.params; // Sponsor ID from URL
    const userId = req.user._id; // Get user ID from authenticated user

    const sponsor = await SPONSORS_MODEL.findOne({ _id: targetId });
    if (!sponsor) {
      return res.status(404).json({
        success: false,
        message: "sponsor not found!",
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
      success: true,
      message: isUnfollow ? "Unfollowed successfully" : "Followed successfully",
      data: {
        isFollowing: !isUnfollow,
        followersCount: sponsor.followers.length,
        sponsor: sponsor,
      },
    });
  } catch (error) {
    return handleError(error, res);
  }
};
