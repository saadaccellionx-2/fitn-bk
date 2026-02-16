const handleError = require("../../utils/errorHandler");
const { INSPIRATION_MODEL } = require("../../models");

module.exports = {
  GET_INSPIRATION: async (req, res) => {
    try {
      const inspiration = await INSPIRATION_MODEL.aggregate([
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
              { $unwind: { path: "$owner", preserveNullAndEmptyArrays: true } },
              { $project: { "owner.password": 0 } },
            ],
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "influencer",
            foreignField: "_id",
            as: "influencer",
          },
        },
        { $unwind: { path: "$influencer", preserveNullAndEmptyArrays: true } },
        {
          $project: {
            "influencer.password": 0,
          },
        },
        {
          $lookup: {
            from: "playlists",
            localField: "playlists",
            foreignField: "_id",
            as: "playlists",
            pipeline: [
              {
                $lookup: {
                  from: "videos",
                  localField: "videos",
                  foreignField: "_id",
                  as: "videos",
                  pipeline: [{ $project: { _id: 1 } }],
                },
              },

              {
                $addFields: {
                  videos: {
                    $map: {
                      input: "$videos",
                      as: "v",
                      in: "$$v._id",
                    },
                  },
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
              { $unwind: { path: "$owner", preserveNullAndEmptyArrays: true } },

              {
                $project: {
                  "owner.password": 0,
                },
              },
            ],
          },
        },
      ]);

      return res.status(200).json({
        message: "Inspiration fetched successfully",
        data: inspiration,
      });
    } catch (error) {
      return handleError(error, res);
    }
  },
};
