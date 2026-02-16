const { CATEGORY_MODEL } = require("../../models");
const handleError = require("../../utils/errorHandler");

module.exports = {
  CREATE: async (req, res) => {
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

  FIND_ALL: async (req, res) => {
    try {
      const categories = await CATEGORY_MODEL.find().sort({ name: 1 });;
      if (!categories.length) {
        return res.status(404).json({
          status: "error",
          message: "No categories found",
        });
      }
      return res.status(200).json({
        message: "Categories retrieved successfully",
        data: categories,
      });
    } catch (error) {
      return handleError(error, res);
    }
  },

  FIND_ONE: async (req, res) => {
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

  UPDATE_BY_ID: async (req, res) => {
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

  DELETE_BY_ID: async (req, res) => {
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
