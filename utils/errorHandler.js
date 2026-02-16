// middlewares/errorMiddleware.js

const handleError = (err, res) => {
  // Duplicate key error
  if (err?.code === 11000) {
    return res.status(400).json({
      message: "Duplicate key error: Record already exists",
    });
  }

  // Validation errors
  if (err.name === "ValidationError") {
    const errorDetails = Object.values(err.errors)
      .map((error) => error.message)
      .join(", ");
    return res.status(400).json({
      message: `Validation error: ${errorDetails}`,
    });
  }

  // Cast errors (invalid data type)
  if (err.name === "CastError") {
    return res.status(400).json({
      message: `Invalid input: ${err.path} received invalid value '${err.value}'`,
    });
  }

  // Resource not found
  if (err?.status === 404) {
    return res.status(404).json({
      message: `Not found: ${err.message || "Resource not found"}`,
    });
  }

  // Unauthorized access
  if (err?.status === 401) {
    return res.status(401).json({
      message: `Unauthorized: ${err.message || "Please authenticate"}`,
    });
  }

  // Default server error
  return res.status(err?.status || 500).json({
    message: `Server error: ${err.message || "An unexpected error occurred"}`,
  });
};

module.exports = handleError;
