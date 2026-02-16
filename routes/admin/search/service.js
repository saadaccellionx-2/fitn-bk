const {
  CATEGORY_MODEL,
  USER_MODEL,
  VIDEO_MODEL,
  PLAYLIST_MODEL,
  SPONSORS_MODEL,
  FEEDBACK_MODEL,
  VIDEO_REPORT_MODEL,
  COMMENT_REPORT_MODEL,
} = require("../../../models");

const extractUsernamesAndText = (caption = "") => {
  const regex = /{[^}]*}/g;
  const matches = caption.match(regex);
  const name = [];
  let cleanedCaption = caption;

  if (matches) {
    matches.forEach((match) => {
      try {
        const obj = JSON.parse(match);
        if (obj?.name) {
          name.push(obj.name);
        }
        cleanedCaption = cleanedCaption.replace(match, "");
      } catch (err) {}
    });
  }

  return `${name.join(" ")} ${cleanedCaption.trim()}`.trim();
};

module.exports = {
  ADMIN_SEARCH_INPUT_TEXT: async (req) => {
    try {
      const { inputText } = req.query;

      if (!inputText || inputText.trim().length === 0) {
        return {
          type: "success",
          message: "Empty search",
          data: [],
        };
      }

      const searchText = inputText.trim();

      const [
        categories,
        users,
        influencers,
        videos,
        playlists,
        sponsors,
        feedback,
        videoReports,
        commentReports,
      ] = await Promise.all([
        // Search categories
        CATEGORY_MODEL.find({
          $or: [
            { name: { $regex: searchText, $options: "i" } },
            { description: { $regex: searchText, $options: "i" } },
          ],
        })
          .select("name description")
          .limit(5),

        // Search users (role: user)
        USER_MODEL.find({
          role: "user",
          $or: [
            { name: { $regex: searchText, $options: "i" } },
            // { username: { $regex: searchText, $options: "i" } },
            { email: { $regex: searchText, $options: "i" } },
          ],
          isDeleted: false,
        })
          .select("name email")
          .limit(5),

        // Search influencers (role: influencer)
        USER_MODEL.find({
          role: "influencer",
          $or: [
            { name: { $regex: searchText, $options: "i" } },
            // { username: { $regex: searchText, $options: "i" } },
            { email: { $regex: searchText, $options: "i" } },
          ],
          isDeleted: false,
        })
          .select("name email")
          .limit(5),

        // Search videos
        VIDEO_MODEL.find({
          isDeleted: false,
          $or: [
            { name: { $regex: searchText, $options: "i" } },
            { caption: { $regex: searchText, $options: "i" } },
            { tags: { $regex: searchText, $options: "i" } },
          ],
        })
          .select("name caption tags")
          .limit(5),

        // Search playlists
        PLAYLIST_MODEL.find({
          name: { $regex: searchText, $options: "i" },
        })
          .populate("owner", "role")
          .select("name owner")
          .limit(5),
        // Search sponsors
        SPONSORS_MODEL.find({
          isDeleted: false,
          $or: [
            { brandName: { $regex: searchText, $options: "i" } },
            { description: { $regex: searchText, $options: "i" } },
            { username: { $regex: searchText, $options: "i" } },
          ],
        })
          .select("brandName description username")
          .limit(5),

        // Search feedback
        FEEDBACK_MODEL.find({
          message: { $regex: searchText, $options: "i" },
        })
          .populate("user", "name username")
          .select("message ratingPoints")
          .limit(5),

        // Search reports
        VIDEO_REPORT_MODEL.find({
          $or: [
            { "report.reason": { $regex: searchText, $options: "i" } },
            { "report.detail": { $regex: searchText, $options: "i" } },
          ],
        })
          .populate("video", "name")
          .populate("user", "name username")
          .select("report")
          .limit(5),

        COMMENT_REPORT_MODEL.find({
          $or: [
            { "report.reason": { $regex: searchText, $options: "i" } },
            { "report.detail": { $regex: searchText, $options: "i" } },
          ],
        })
          .populate("comment", "text")
          .populate("user", "name username")
          .select("report")
          .limit(5),
      ]);

      const suggestions = [];
      const seenTexts = new Map();

      // Helper function to add unique suggestions with type priority
      const addUniqueSuggestion = (text, type, id = null) => {
        if (!text || typeof text !== "string") return;

        const trimmedText = text.trim();
        const normalizedText = trimmedText.toLowerCase();

        if (seenTexts.has(normalizedText)) {
          const existingItem = seenTexts.get(normalizedText);
          const typePriority = {
            category: 1,
            user: 2,
            influencer: 3,
            sponsor: 4,
            playlist: 5,
            video: 6,
            tag: 7,
            feedback: 8,
            report: 9,
          };

          if (typePriority[type] < typePriority[existingItem.type]) {
            const index = suggestions.findIndex(
              (s) => s.text.toLowerCase() === normalizedText
            );
            if (index !== -1) {
              suggestions[index] = { text: trimmedText, type: type, id: id };
              seenTexts.set(normalizedText, {
                text: trimmedText,
                type: type,
                id: id,
              });
            }
          }
        } else {
          const item = { text: trimmedText, type: type, id: id };
          suggestions.push(item);
          seenTexts.set(normalizedText, item);
        }
      };

      // Add category suggestions
      categories.forEach((category) => {
        if (category.name) {
          addUniqueSuggestion(category.name, "category", category._id);
        }
      });

      // Add user suggestions
      users.forEach((user) => {
        if (user.username) {
          addUniqueSuggestion(user.username, "user", user._id);
        } else if (user.name) {
          addUniqueSuggestion(user.name, "user", user._id);
        }
      });

      // Add influencer suggestions
      influencers.forEach((influencer) => {
        if (influencer.username) {
          addUniqueSuggestion(
            influencer.username,
            "influencer",
            influencer._id
          );
        } else if (influencer.name) {
          addUniqueSuggestion(influencer.name, "influencer", influencer._id);
        }
      });
      videos.forEach((video) => {
        if (video.name) {
          addUniqueSuggestion(video.name, "video", video._id);
        }
        if (video.caption) {
          const cleanedCaption = extractUsernamesAndText(video.caption);
          addUniqueSuggestion(cleanedCaption, "video", video._id);
        }

        video.tags?.forEach((tag) => {
          if (
            tag &&
            typeof tag === "string" &&
            tag.toLowerCase().includes(searchText.toLowerCase())
          ) {
            addUniqueSuggestion(tag.trim(), "video", video._id);
          }
        });
      });

      // Add playlist suggestions
      const seenPlaylistIds = new Set();

      playlists.forEach((playlist) => {
        if (playlist.name && playlist.owner) {
          const suggestion = {
            text: playlist.name.trim(),
            type: "playlist",
            playlistId: playlist._id,
            id: playlist.owner._id,
            role: playlist.owner.role,
          };

          if (!seenPlaylistIds.has(String(playlist._id))) {
            suggestions.push(suggestion);
            seenPlaylistIds.add(String(playlist._id));
          }
        }
      });

      // Add sponsor suggestions
      sponsors.forEach((sponsor) => {
        if (sponsor.brandName) {
          addUniqueSuggestion(sponsor.brandName, "sponsor", sponsor._id);
        } else if (sponsor.username) {
          addUniqueSuggestion(sponsor.username, "sponsor", sponsor._id);
        }
      });

      // Add feedback suggestions (using user name or rating info)
      feedback.forEach((feedbackItem) => {
        if (feedbackItem.user && feedbackItem.user.name) {
          addUniqueSuggestion(
            `Feedback from ${feedbackItem.user.name}`,
            "feedback",
            feedbackItem._id
          );
        }
      });

      // Add report suggestions
      videoReports.forEach((report) => {
        if (report.report) {
          const { reason, detail } = report.report;

          if (reason) {
            addUniqueSuggestion(reason, "video_report", report._id);
          }

          if (detail) {
            addUniqueSuggestion(detail, "video_report", report._id);
          }
        }
      });
      commentReports.forEach((report) => {
        if (report.report) {
          const { reason, detail } = report.report;

          if (reason) {
            addUniqueSuggestion(reason, "comment_report", report._id);
          }

          if (detail) {
            addUniqueSuggestion(detail, "comment_report", report._id);
          }
        }
      });

      // Sort suggestions by relevance
      const sortedSuggestions = suggestions.sort((a, b) => {
        const aLower = a.text.toLowerCase();
        const bLower = b.text.toLowerCase();
        const searchLower = searchText.toLowerCase();

        // Exact matches first
        const aExact = aLower === searchLower;
        const bExact = bLower === searchLower;
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;

        // Starts with search term
        const aStarts = aLower.startsWith(searchLower);
        const bStarts = bLower.startsWith(searchLower);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;

        // Type priority
        const typePriority = {
          category: 1,
          user: 2,
          influencer: 3,
          sponsor: 4,
          playlist: 5,
          video: 6,
          tag: 7,
          feedback: 8,
          video_report: 9,
          comment_report: 10,
        };
        if (typePriority[a.type] !== typePriority[b.type]) {
          return typePriority[a.type] - typePriority[b.type];
        }

        // Alphabetical order for similar relevance and type
        return aLower.localeCompare(bLower);
      });

      // Return limited results
      const finalLimit = 20;
      return {
        type: "success",
        message: "Admin search suggestions found",
        data: sortedSuggestions.slice(0, finalLimit),
      };
    } catch (error) {
      console.error("Admin search suggestions error:", error);
      throw error;
    }
  },
};
