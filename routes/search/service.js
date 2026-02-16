const { USER_MODEL, VIDEO_MODEL, PLAYLIST_MODEL } = require("../../models");

module.exports = {
  SEARCH_INPUT_TEXT: async (req) => {
    try {
      const user = req.user;
      const { inputText } = req.query;

      if (!inputText || inputText.trim().length === 0) {
        return {
          type: "success",
          message: "Empty search",
          data: [],
        };
      }

      const searchText = inputText.trim();

      const [users, videos, playlists] = await Promise.all([
        // Search users
        USER_MODEL.find({
          _id: { $nin: user?.blockedUsers || [] },
          $or: [
            { name: { $regex: searchText, $options: "i" } },
            { username: { $regex: searchText, $options: "i" } },
            { email: { $regex: searchText, $options: "i" } },
          ],
          isDeleted: false,
        })
          .select("name username email profilePic role")
          .limit(10), // Increased limit to account for potential duplicates

        // Search videos
        VIDEO_MODEL.find({
          owner: { $nin: user?.blockedUsers || [] },
          isDeleted: false,
          isPrivate: false,
          $or: [
            { name: { $regex: searchText, $options: "i" } },
            { tags: { $regex: searchText, $options: "i" } },
          ],
        })
          .select("name tags")
          .limit(10), // Increased limit to account for potential duplicates

        // Search public playlists
        PLAYLIST_MODEL.find({
          owner: { $nin: user?.blockedUsers || [] },
          isPrivate: false,
          name: { $regex: searchText, $options: "i" },
        })
          .select("name")
          .limit(10), // Increased limit to account for potential duplicates
      ]);

      const suggestions = [];
      const seenTexts = new Map(); // Track seen text regardless of type

      // Helper function to add unique suggestions with type priority
      const addUniqueSuggestion = (text, type, profilePic = "", role = "") => {
        if (!text || typeof text !== "string") return;

        const trimmedText = text.trim();
        const normalizedText = trimmedText.toLowerCase();

        if (seenTexts.has(normalizedText)) {
          // If text already exists, check if we should replace with higher priority type
          const existingItem = seenTexts.get(normalizedText);
          const typePriority = { user: 1, tag: 2, playlist: 3 };

          // Replace if current type has higher priority (lower number = higher priority)
          if (typePriority[type] < typePriority[existingItem.type]) {
            // Remove the old item from suggestions array
            const index = suggestions.findIndex(
              (s) => s.text.toLowerCase() === normalizedText
            );
            if (index !== -1) {
              suggestions[index] = {
                text: trimmedText,
                type,
                profilePic,
                role,
              };
              seenTexts.set(normalizedText, {
                text: trimmedText,
                type,
                profilePic,
                role,
              });
            }
          }
        } else {
          const item = { text: trimmedText, type, profilePic, role };
          suggestions.push(item);
          seenTexts.set(normalizedText, item);
        }
      };

      users.forEach((userItem) => {
        const nameMatch = userItem.name
          ?.toLowerCase()
          .includes(searchText.toLowerCase());
        const usernameMatch = userItem.username
          ?.toLowerCase()
          .includes(searchText.toLowerCase());

        if (nameMatch) {
          addUniqueSuggestion(
            userItem.name,
            "user",
            userItem.profilePic,
            userItem.role
          );
        } else if (usernameMatch) {
          addUniqueSuggestion(
            userItem.username,
            "user",
            userItem.profilePic,
            userItem.role
          );
        }
      });

      // Add tag suggestions from videos
      const tagSet = new Set(); // Temporary set to avoid duplicate tags within videos
      videos.forEach((video) => {
        video.tags?.forEach((tag) => {
          if (
            tag &&
            typeof tag === "string" &&
            tag.toLowerCase().includes(searchText.toLowerCase())
          ) {
            const normalizedTag = tag.trim().toLowerCase();
            if (!tagSet.has(normalizedTag)) {
              tagSet.add(normalizedTag);
              addUniqueSuggestion(tag.trim(), "tag");
            }
          }
        });
      });

      // Add playlist suggestions
      playlists.forEach((playlist) => {
        if (playlist.name) {
          addUniqueSuggestion(playlist.name, "playlist");
        }
      });

      // Sort suggestions by relevance (exact matches first, then partial matches)
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

        // Prioritize users over other types for same relevance
        const typePriority = { user: 1, tag: 2, playlist: 3 };
        if (typePriority[a.type] !== typePriority[b.type]) {
          return typePriority[a.type] - typePriority[b.type];
        }

        // Alphabetical order for similar relevance and type
        return aLower.localeCompare(bLower);
      });

      // Return limited results
      const finalLimit = 15;
      return {
        type: "success",
        message: "Search suggestions found",
        data: sortedSuggestions.slice(0, finalLimit),
      };
    } catch (error) {
      console.error("Search suggestions error:", error);
      throw error;
    }
  },

  SEARCH_QUERY_RESULTS: async (req) => {
    try {
      const user = req.user;
      const { query } = req.query;

      if (!query || query.trim().length === 0) {
        return {
          type: "success",
          message: "Empty search",
          data: {
            users: [],
            videos: [],
            playlists: [],
          },
        };
      }

      const [nameMatchedUsers, tagMatchedVideos, playlists] = await Promise.all(
        [
          USER_MODEL.find({
            _id: { $nin: user?.blockedUsers },
            // role: "influencer",
            $or: [
              { name: { $regex: query, $options: "i" } },
              { username: { $regex: query, $options: "i" } },
            ],
            isDeleted: false,
          }).select("-password"),

          VIDEO_MODEL.aggregate([
            {
              $match: {
                owner: { $nin: user?.blockedUsers || [] },
                isDeleted: false,
                isPrivate: false,
                $or: [
                  { name: { $regex: query, $options: "i" } },
                  { tags: { $regex: query, $options: "i" } },
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
              $sort: {
                createdAt: -1,
              },
            },
            {
              $project: {
                "owner.password": 0,
              },
            },
          ]),

          // Search playlists with influencer owner filter
          PLAYLIST_MODEL.aggregate([
            {
              $match: {
                owner: { $nin: user?.blockedUsers || [] },
                isPrivate: false,
                name: { $regex: query, $options: "i" },
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
              $sort: {
                createdAt: -1,
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
                    $project: {
                      thumbnailUrl: 1,
                    },
                  },
                ],
              },
            },
            {
              $project: {
                "owner.password": 0,
              },
            },
          ]),
        ]
      );

      // Extract owners from matched videos
      const ownersFromVideos = tagMatchedVideos.map((video) => video.owner);

      // Merge users from name match and video tag match
      const userMap = new Map();

      // Add name/username matched users (already filtered by influencer role)
      nameMatchedUsers.forEach((u) => userMap.set(u._id.toString(), u));

      // Add users whose videos matched by tag (already filtered by influencer role)
      ownersFromVideos.forEach((owner) => {
        if (owner && !userMap.has(owner._id.toString())) {
          userMap.set(owner._id.toString(), owner);
        }
      });

      // Final user list with no duplicates
      const users = Array.from(userMap.values());

      return {
        type: "success",
        message: "Search results found",
        data: {
          users,
          videos: tagMatchedVideos,
          playlists,
        },
      };
    } catch (error) {
      throw error;
    }
  },
};
