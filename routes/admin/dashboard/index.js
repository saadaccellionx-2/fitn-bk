const express = require("express");
const {
  GET_DASHBOARD_TOTAL,
  GET_DASHBOARD_MONTH_SEGMENTS,
  GET_USERS_ANALYTICS,
  GET_DASHBOARD_NEW_USERS,
  GET_DEVICE_STATS,
  GET_USER_INFLUENCER_ANALYTICS,
  GET_APP_STATE_STATS,
  GET_USERS_ACTIVE_STATS,
  GET_USERS_ACTIVITY_STATS,
  GET_USERS_OPEN_ACTIVE_ANALYTICS,
  GET_USERS_GEO_CITY_STATS,
  GET_USERS_GEO_COUNTRY_STATS,
  GET_USERS_GROWTH_CUMULATIVE_ANALYTICS,
} = require("./service");

const router = express.Router();

router.get("/total", GET_DASHBOARD_TOTAL);
router.get("/users", GET_DASHBOARD_NEW_USERS);
router.get("/monthly-segments", GET_DASHBOARD_MONTH_SEGMENTS);
//analytics routes
router.get("/user-influencer-analytics", GET_USER_INFLUENCER_ANALYTICS);
router.get("/users-analytics", GET_USERS_ANALYTICS);
router.get("/app-active-analytics", GET_USERS_OPEN_ACTIVE_ANALYTICS);
//stats routes
router.get("/device-stats", GET_DEVICE_STATS);
router.get("/app-state-stats", GET_APP_STATE_STATS);
router.get("/users-active-stats", GET_USERS_ACTIVE_STATS);
router.get("/users-activity-stats", GET_USERS_ACTIVITY_STATS);
router.get("/users-geo-city-stats", GET_USERS_GEO_CITY_STATS);
router.get("/users-geo-country-stats", GET_USERS_GEO_COUNTRY_STATS);
router.get("/users-growth-cumulative", GET_USERS_GROWTH_CUMULATIVE_ANALYTICS);

module.exports = router;
