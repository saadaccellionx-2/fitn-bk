var express = require("express");
const { ADMIN_SEARCH_INPUT_TEXT } = require("./service");
const { setResponse } = require("../../../helpers/response.helper");
var router = express.Router();

router.get("/searchText", async (req, res) => {
  try {
    const response = await ADMIN_SEARCH_INPUT_TEXT(req);
    res.send(response);
  } catch (error) {
    console.log("Admin search text error:", error);
    setResponse(res, { type: "Error", data: error.stack });
  }
});

module.exports = router;
