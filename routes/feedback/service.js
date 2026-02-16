const { FEEDBACK_MODEL } = require("../../models");
const handleError = require("../../utils/errorHandler");
module.exports = {
  CREATE: async (req, res) => {
    try {
      const user = req.user;
      req.body.user = user._id;
      const category = await FEEDBACK_MODEL.create(req.body);
      return res.status(201).json({
        message: "sent successfully",
        data: category,
      });
    } catch (error) {
      return handleError(error, res);
    }
  },

  FIND_ALL: async (req, res) => {
    try {
      const data = await FEEDBACK_MODEL.find({}).populate(
        "user",
        "name profilePic"
      );
      if (!data.length) {
        return res.status(404).json({
          status: "error",
          message: "No feedbacks found",
        });
      }
      return res.status(200).json({
        message: "feedback retrieved successfully",
        data: data,
      });
    } catch (error) {
      return handleError(error, res);
    }
  },
};
