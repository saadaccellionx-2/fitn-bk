const { ADMIN_NOTIFICATION } = require("../../models");
const handleError = require("../../utils/errorHandler");

module.exports = {
  CREATE: async (req, res) => {
    try {
      const payload = req.body;

      const name = payload?.data?.["Full Name:"]?.[0] || payload?.data?.["Full Name"]?.[0];      

      await ADMIN_NOTIFICATION.create({
        title: "New Influencer Application",
        body: `${
          name || "A User"
        } submitted a request to become an influencer.`,
        type: "form_submission",
        relatedItem: null,
      });

      return res.status(200).json({ message: "Webhook received", name });
    } catch (error) {
      console.error(error);
      return handleError(error, res);
    }
  },
};
