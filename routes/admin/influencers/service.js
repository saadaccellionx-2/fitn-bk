const handleError = require("../../../utils/errorHandler");
const { USER_MODEL } = require("../../../models");
const parseFilter = require("../../../utils/parseFilter");

module.exports = {
  FIND_ALL_INFLUENCERS: async (req, res) => {
    try {
      const {
        pageNum = 1,
        perPage = 10,
        search = "",
        sortBy = "newest",
      } = req.query;

      const filter = parseFilter(req.query.filter, res);
      if (filter === null) return;

      // Ensure role = influencer is included in filter
      const query = { ...filter, role: "influencer" };

      if (search) {
        query.$or = [
          { name: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } },
          { username: { $regex: search, $options: "i" } },
        ];
      }

      const totalItems = await USER_MODEL.countDocuments(query);
      const users = await USER_MODEL.find(query)
        .sort(sortBy === "newest" ? { createdAt: -1 } : { createdAt: 1 })
        .skip((pageNum - 1) * perPage)
        .limit(Number(perPage));

      if (!users.length) {
        return res.status(404).json({
          status: "error",
          message: "No influencers found",
        });
      }

      return res.status(200).json({
        message: "Influencers retrieved successfully",
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
};
