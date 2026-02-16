var createError = require("http-errors");
var express = require("express");
var path = require("path");
var cookieParser = require("cookie-parser");
const bodyParser = require("body-parser");
var logger = require("morgan");
var cors = require("cors");
const { Info } = require("luxon");

require("dotenv").config();
require("./config/database");
require("./routes/jobs/weeklyPushNotifications");
require("./routes/jobs/inactiveUsersCleanup");

var usersRouter = require("./routes/users");
var uploadRouter = require("./routes/upload");

var playlistRouter = require("./routes/playlists");
var videosRouter = require("./routes/videos");
var notificationRouter = require("./routes/notification");
var preferencesNotificationRouter = require("./routes/preferencesNotification");
var feedbackRouter = require("./routes/feedback");

var categoryRouter = require("./routes/category");
var videoReport = require("./routes/videoReport");
var commentReport = require("./routes/commentReport");
var videoComments = require("./routes/comments");
var bugReportRouter = require("./routes/bugReport");

var adminRouter = require("./routes/admin");
var searchRouter = require("./routes/search");
var sponsorRoutes = require("./routes/sponsor");
var webhookRoutes = require("./routes/wehbook");
var inspirationRouter = require("./routes/inspiration");
var ogRouter = require("./routes/og/playlist");
var authRouter = require("./routes/auth");

var app = express();

app.set("trust proxy", true);

app.use(logger("dev"));
app.use(cors("*"));

app.use(express.json({ limit: "1gb" }));
app.use(express.urlencoded({ limit: "1gb", extended: true }));

app.use(cookieParser());

// Timezone middleware
app.use((req, res, next) => {
  const tz = req.headers["x-timezone"];

  // Validate timezone identifier using Luxon
  if (tz && Info.isValidIANAZone(tz)) {
    req.timezone = tz;
  } else {
    req.timezone = "UTC";
  }
  next();
});

app.get("/", (req, res) => {
  res.json({ message: "Server is running" });
});

// API routes with prefix
const apiRouter = express.Router();

apiRouter.use("/admin", adminRouter);
apiRouter.use("/search", searchRouter);
apiRouter.use("/users", usersRouter);
apiRouter.use("/notification", notificationRouter);
apiRouter.use("/notification-preferences", preferencesNotificationRouter);
apiRouter.use("/feedbacks", feedbackRouter);
apiRouter.use("/upload", uploadRouter);
apiRouter.use("/playlists", playlistRouter);
apiRouter.use("/videos", videosRouter);
apiRouter.use("/comments", videoComments);

apiRouter.use("/categories", categoryRouter);
apiRouter.use("/video_report", videoReport);
apiRouter.use("/comment_report", commentReport);
apiRouter.use("/bug_report", bugReportRouter);
apiRouter.use("/sponsors", sponsorRoutes);
apiRouter.use("/webhook/from-google-sheets", webhookRoutes);
apiRouter.use("/inspiration", inspirationRouter);
apiRouter.use("/og", ogRouter);
apiRouter.use("/auth", authRouter);

// Apply the /api/v1 prefix to all API routes
app.use("/api/v1", apiRouter);

// 404 handler
app.use(function (req, res, next) {
  next(createError(404));
});

// Error handler
app.use(function (err, req, res, next) {
  res.status(err.status || 500).json({
    message: err.message,
    error: req.app.get("env") === "development" ? err : {},
  });
});

module.exports = app;
