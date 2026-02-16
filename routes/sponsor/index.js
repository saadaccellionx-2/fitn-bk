const express = require("express");
const router = express.Router();
const sponsorController = require("./service");
const { protectRoutes, adminOnly } = require("../../middleware/verify");

// Apply middleware to all routes
// router.use(protectRoutes);

// Create a new sponsor
router.post("/", sponsorController.createSponsor);

// Get all sponsors
router.get("/", sponsorController.getAllSponsors);

// Get sponsor by ID
router.get("/:id", sponsorController.getSponsorById);

// Update sponsor

// Delete sponsor
router.delete("/:id", sponsorController.deleteSponsor);

router.patch(
  "/follow_unfollow/:targetId",
  protectRoutes,
  sponsorController.FOLLOW_UNFOLLOW
);

router.put("/:id", sponsorController.updateSponsor);

module.exports = router;
