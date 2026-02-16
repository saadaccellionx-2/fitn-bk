const { FEEDBACK_MODEL } = require("../../../models");
const handleError = require("../../../utils/errorHandler");
const parseFilter = require("../../../utils/parseFilter");

module.exports = {
  FIND_ALL_FEEDBACKS: async (req, res) => {
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

      const searchAsNumber = Number(search);
      const isNumericSearch =
        !isNaN(searchAsNumber) && searchAsNumber >= 1 && searchAsNumber <= 5;

      if (isNumericSearch) {
        query.ratingPoints = searchAsNumber;
      }

      let feedbacks;
      let totalItems;

      if (search) {
        const aggregationPipeline = [
          {
            $lookup: {
              from: "users",
              localField: "user",
              foreignField: "_id",
              as: "userDetails",
            },
          },
          {
            $unwind: "$userDetails",
          },
          {
            $match: {
              ...query,
              $or: isNumericSearch
                ? [
                    { ratingPoints: searchAsNumber },
                    { "userDetails.name": { $regex: search, $options: "i" } },
                  ]
                : [
                    { message: { $regex: search, $options: "i" } },
                    { "userDetails.name": { $regex: search, $options: "i" } },
                  ],
            },
          },
          {
            $addFields: {
              user: {
                _id: "$userDetails._id",
                name: "$userDetails.name",
                profilePic: "$userDetails.profilePic",
              },
            },
          },
          {
            $project: {
              userDetails: 0,
            },
          },
          {
            $sort: sortBy === "newest" ? { createdAt: -1 } : { createdAt: 1 },
          },
        ];

        const countPipeline = [...aggregationPipeline, { $count: "total" }];
        const countResult = await FEEDBACK_MODEL.aggregate(countPipeline);
        totalItems = countResult.length > 0 ? countResult[0].total : 0;

        const resultsPipeline = [
          ...aggregationPipeline,
          { $skip: (pageNum - 1) * perPage },
          { $limit: Number(perPage) },
        ];

        feedbacks = await FEEDBACK_MODEL.aggregate(resultsPipeline);
      } else {
        totalItems = await FEEDBACK_MODEL.countDocuments(query);

        feedbacks = await FEEDBACK_MODEL.find(query)
          .populate("user", "name profilePic")
          .sort(sortBy === "newest" ? { createdAt: -1 } : { createdAt: 1 })
          .skip((pageNum - 1) * perPage)
          .limit(Number(perPage));
      }

      if (!feedbacks.length) {
        return res.status(200).json({
          status: "error",
          message: "No feedbacks found",
        });
      }

      return res.status(200).json({
        message: "Feedbacks retrieved successfully",
        data: feedbacks,
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
  GET_FEEDBACK_BY_ID: async (req, res) => {
  try {
    const feedback = await FEEDBACK_MODEL.findById(req.params.id)
      .populate("user", "name profilePic");

    if (!feedback) {
      return res.status(404).json({
        status: "error",
        message: "Feedback not found",
      });
    }

    return res.status(200).json({
      type: "success",
      message: "Feedback retrieved successfully",
      data: feedback,
    });
  } catch (error) {
    return handleError(error, res);
  }
},
};
