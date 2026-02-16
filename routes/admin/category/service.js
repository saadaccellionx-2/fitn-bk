const { CATEGORY_MODEL, VIDEO_MODEL } = require("../../../models");
const handleError = require("../../../utils/errorHandler");
const parseFilter = require("../../../utils/parseFilter");

module.exports = {
  CREATE_CATEGORY: async (req, res) => {
    try {
      const category = await CATEGORY_MODEL.create(req.body);
      return res.status(201).json({
        message: "Category created successfully",
        data: category,
      });
    } catch (error) {
      return handleError(error, res);
    }
  },

  FIND_ALL_CATEGORY: async (req, res) => {
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

      const filter = parseFilter(req.query.filter, res);
      if (filter === null) return; // parseFilter handles response on error

      const query = { ...filter };
      if (search) {
        const searchRegex = { $regex: search, $options: "i" };
        query.$or = [{ name: searchRegex }, { description: searchRegex }];
      }

      // Fetch categories with pagination and sorting
      const categories = await CATEGORY_MODEL.find(query)
        .sort(sortBy === "newest" ? { createdAt: -1 } : { createdAt: 1 })
        .limit(itemsPerPage)
        .skip(skip)
        .lean();

      // Count total categories matching query
      const totalItems = await CATEGORY_MODEL.countDocuments(query);

      // Aggregate video counts per category
      let categoryVideoCount = [];
      try {
        categoryVideoCount = await VIDEO_MODEL.aggregate([
          {
            $group: {
              _id: "$category",
              videoCount: { $sum: 1 },
            },
          },
          {
            $lookup: {
              from: "categories",
              localField: "_id",
              foreignField: "_id",
              as: "categoryDetails",
            },
          },
          { $unwind: "$categoryDetails" },
          {
            $project: {
              _id: 0,
              categoryName: "$categoryDetails.name",
              videoCount: 1,
            },
          },
        ]);
      } catch (aggError) {
        console.error("Error aggregating video counts:", aggError);
      }
      console.log(categoryVideoCount);

      if (!categories.length) {
        return res.status(404).json({
          status: "error",
          message: "No categories found",
        });
      }
      const videoCountMap = new Map(
        categoryVideoCount.map((item) => [item.categoryName, item.videoCount])
      );

      const categoriesWithVideoCount = categories.map((category) => ({
        ...category,
        videoCount: videoCountMap.get(category.name) || 0, 
      }));

      return res.status(200).json({
        message: "Categories retrieved successfully",
        data: categoriesWithVideoCount,
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

  FIND_ONE_CATEGORY: async (req, res) => {
    try {
      const category = await CATEGORY_MODEL.findById(req.params.id);
      if (!category) {
        return res.status(404).json({
          status: "error",
          message: "Category not found",
        });
      }

      return res.status(200).json({
        message: "Category retrieved successfully",
        data: category,
      });
    } catch (error) {
      return handleError(error, res);
    }
  },

  UPDATE_BY_ID_CATEGORY: async (req, res) => {
    try {
      const category = await CATEGORY_MODEL.findById(req.params.id);
      if (!category) {
        return res.status(404).json({
          status: "error",
          message: "Category not found",
        });
      }

      category.name = req.body.name || category.name;
      category.description = req.body.description || category.description;

      const updatedCategory = await category.save();
      return res.status(200).json({
        message: "Category updated successfully",
        data: updatedCategory,
      });
    } catch (error) {
      return handleError(error, res);
    }
  },

  DELETE_BY_ID_CATEGORY: async (req, res) => {
    try {
      const category = await CATEGORY_MODEL.findById(req.params.id);
      if (!category) {
        return res.status(404).json({
          status: "error",
          message: "Category not found",
        });
      }

      await category.deleteOne();
      return res.status(200).json({
        message: "Category deleted successfully",
      });
    } catch (error) {
      return handleError(error, res);
    }
  },
};
