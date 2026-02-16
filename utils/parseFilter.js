// utils/parseFilter.js
function parseFilter(queryFilter, res = null) {
  if (!queryFilter) return {};

  if (typeof queryFilter === "object") {
    // Already an object
    return queryFilter;
  }

  try {
    return JSON.parse(queryFilter);
  } catch (error) {
    if (res) {
      res.status(400).json({
        status: "error",
        message: "Invalid filter JSON format",
      });
    }
    return null; // Signal error
  }
}

module.exports = parseFilter;
