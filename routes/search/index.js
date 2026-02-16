var express = require("express");
const { setResponse } = require("../../helpers/response.helper");
const { SEARCH_INPUT_TEXT, SEARCH_QUERY_RESULTS } = require("./service");
const { protectRoutes } = require("../../middleware/verify");
var router = express.Router();

router.get("/searchText", protectRoutes, async (req, res) => {
  try {
    const response = await SEARCH_INPUT_TEXT(req);
    res.send(response);
  } catch (error) {
    console.log(error);

    setResponse(res, { type: "Error", data: error.stack });
  }
});

router.get("/searchResults", protectRoutes, async (req, res) => {
  try {
    const response = await SEARCH_QUERY_RESULTS(req);
    res.send(response);
  } catch (error) {
    console.log(error);

    setResponse(res, { type: "Error", data: error.stack });
  }
});

module.exports = router;
