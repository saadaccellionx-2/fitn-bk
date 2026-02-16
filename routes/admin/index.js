const express = require("express");
const router = express.Router();

const authRoutes = require("./Auth"); // No middleware
const userRoutes = require("./users");
const influencersRoutes = require("./influencers");

const videoRoutes = require("./videos");
const playlistRoutes = require("./playLists");
const dashboardRoutes = require("./dashboard");
const categoryRoutes = require("./category");
const feedbackRoutes = require("./feedBacks");
const sponsorRoutes = require("./sponsor");
const uploadRoutes = require("./upload");
const searchRoutes = require("./search");
const notificationRoutes = require("./notification");
const commentsRoutes = require("./comment");
const bugReportRoutes = require("./bugReport");
const inspirationRoutes = require("./inspiration");
const queueMonitorRoutes = require("../queueMonitor");

const { verifyAdmin, adminOnly } = require("../../middleware/verify");

router.use("/auth", authRoutes); // public routes

// Admin-only routes
router.use(verifyAdmin);
router.use("/users", userRoutes);
router.use("/influencers", influencersRoutes);
router.use("/videos", videoRoutes);
router.use("/playlists", playlistRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/categories", categoryRoutes);
router.use("/feedbacks", feedbackRoutes);
router.use("/sponsor", sponsorRoutes);
router.use("/upload", uploadRoutes);
router.use("/search", searchRoutes);
router.use("/notifications", notificationRoutes);
router.use("/comments", commentsRoutes);
router.use("/bug-reports", bugReportRoutes);
router.use("/inspiration", inspirationRoutes);
router.use("/", queueMonitorRoutes); // Queue monitoring routes

module.exports = router;
