const handleError = require("../../../utils/errorHandler");
const { PLAYLIST_MODEL, USER_MODEL } = require("../../../models");
const parseFilter = require("../../../utils/parseFilter");

module.exports = {
  FIND_ALL_PLAYLISTS: async (req, res) => {
    try {
      const {
        pageNum = 1,
        perPage = 10,
        search = "",
        sortBy = "newest",
        userId,
      } = req.query;

      // Parse filter object safely
      const filter = parseFilter(req.query.filter, res);
      if (filter === null) return;

      const query = { ...filter };

      const followedPlaylists = req.query.followedPlaylists === "true";

      if (followedPlaylists) {
        if (!userId) {
          return res.status(400).json({
            status: "error",
            message: "userId is required to get followed playlists",
          });
        }

        const user = await USER_MODEL.findById(userId).select(
          "followingPlayLists"
        );
        if (!user || !user.followingPlayLists.length) {
          return res.status(200).json({
            status: "success",
            message: "No playlists followed by this user",
            data: [],
            pagination: {
              pageNum: Number(pageNum),
              perPage: Number(perPage),
              totalItems: 0,
            },
          });
        }

        query._id = { $in: user.followingPlayLists };
      } else if (userId) {
        query.owner = userId;
      }

      if (search) {
        const matchedUsers = await USER_MODEL.find({
          $or: [
            { name: { $regex: search, $options: "i" } },
            { username: { $regex: search, $options: "i" } },
          ],
        }).select("_id");

        const matchedUserIds = matchedUsers.map((u) => u._id);

        query.$or = [
          { name: { $regex: search, $options: "i" } },
          { owner: { $in: matchedUserIds } },
        ];
      }

      // Pagination
      const pageNumber = Number(pageNum) || 1;
      const itemsPerPage = Number(perPage) || 10;
      const skip = (pageNumber - 1) * itemsPerPage;

      const totalPlaylists = await PLAYLIST_MODEL.countDocuments(query);

      const playlists = await PLAYLIST_MODEL.find(query)
        .sort(sortBy === "newest" ? { createdAt: -1 } : { createdAt: 1 })
        .skip(skip)
        .limit(itemsPerPage)
        .populate("videos")
        .populate("owner", "name profilePic role");

      if (!playlists.length) {
        return res.status(200).json({
          status: "error",
          message: "No playlists found",
        });
      }

      return res.status(200).json({
        message: "Playlists retrieved successfully",
        data: playlists,
        pagination: {
          pageNum: pageNumber,
          perPage: itemsPerPage,
          totalItems: totalPlaylists,
        },
      });
    } catch (error) {
      return handleError(error, res);
    }
  },
  FIND_PLAYLIST_BY_ID: async (req, res) => {
    try {
      const { id } = req.params;

      const playlist = await PLAYLIST_MODEL.findById(id)
        .populate("videos")
        .populate("owner", "name profilePic");

      if (!playlist) {
        return res.status(404).json({
          status: "error",
          message: "Playlist not found",
        });
      }

      return res.status(200).json({
        message: "Playlist retrieved successfully",
        data: playlist,
      });
    } catch (error) {
      return handleError(error, res);
    }
  },

  DELETE_PLAYLIST_BY_ID: async (req, res) => {
    try {
      const { id } = req.params;

      const playlist = await PLAYLIST_MODEL.findOneAndDelete({
        _id: id,
      });

      if (!playlist) {
        return res.status(404).json({
          status: "error",
          message: "Playlist not found",
        });
      }

      return res.status(200).json({
        message: "Playlist deleted successfully",
        data: playlist,
      });
    } catch (error) {
      return handleError(error, res);
    }
  },

  UPDATE_PLAYLIST_BY_ID: async (req, res) => {
    try {
      const { id } = req.params;

      const updatedPlaylist = await PLAYLIST_MODEL.findOneAndUpdate(
        { _id: id },
        req.body,
        {
          new: true,
        }
      );

      if (!updatedPlaylist) {
        return res.status(404).json({
          status: "error",
          message: "Playlist not found",
        });
      }

      return res.status(200).json({
        message: "Playlist updated successfully",
        data: updatedPlaylist,
      });
    } catch (error) {
      return handleError(error, res);
    }
  },
};
