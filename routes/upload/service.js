const { Upload } = require("@aws-sdk/lib-storage");
const { s3 } = require("../../config/s3Config");
const handleError = require("../../utils/errorHandler");
const axios = require("axios");

// Optimized upload configuration for different file sizes
const getUploadConfig = (fileSize) => {
  // For files under 100MB - use smaller parts for faster initial response
  if (fileSize < 100 * 1024 * 1024) {
    return {
      queueSize: 4,
      partSize: 5 * 1024 * 1024, // 5MB parts
    };
  }
  // For files 100MB - 1GB - balance speed and memory
  else if (fileSize < 1024 * 1024 * 1024) {
    return {
      queueSize: 6,
      partSize: 10 * 1024 * 1024, // 10MB parts
    };
  }
  // For files over 1GB - use larger parts for efficiency
  else {
    return {
      queueSize: 8,
      partSize: 50 * 1024 * 1024, // 50MB parts
    };
  }
};

module.exports.uploadFileController = async (req, res) => {
  const file = req.file;

  if (!file) {
    return handleError(new Error("No file provided"), res);
  }

  // Check file size limits (adjust as needed)
  const MAX_FILE_SIZE = 5 * 1024 * 1024 * 1024; // 5GB limit
  if (file.size > MAX_FILE_SIZE) {
    return res.status(400).json({
      error: "File too large",
      maxSize: "5GB",
      receivedSize: `${(file.size / (1024 * 1024 * 1024)).toFixed(2)}GB`,
    });
  }

  // Get optimized config based on file size
  const uploadConfig = getUploadConfig(file.size);

  // Generate unique filename to prevent overwrites
  const timestamp = Date.now();
  const filename = `${timestamp}-${file.originalname}`;

  const params = {
    Bucket: "fitn-bucket",
    Key: filename, // Use unique filename
    Body: file.buffer,
    ContentType: file.mimetype, // Set proper content type
  };

  try {
    const uploadParallel = new Upload({
      client: s3,
      queueSize: uploadConfig.queueSize,
      partSize: uploadConfig.partSize,
      leavePartsOnError: false,
      params,
    });

    // Add progress tracking (optional)
    uploadParallel.on("httpUploadProgress", (progress) => {
      const percentage = Math.round((progress.loaded / progress.total) * 100);
      console.log(`Upload progress: ${percentage}%`);
      // You could emit this to client via WebSocket for real-time updates
    });

    const data = await uploadParallel.done();

    res.status(200).json({
      success: true,
      fileUrl: data.Location,
      filKey: data.Key,
      fileSize: file.size,
      uploadConfig: uploadConfig,
    });
  } catch (error) {
    console.error("S3 Upload Error:", error);
    return handleError(error, res);
  }
};

// Alternative version using streams for very large files (memory efficient)
module.exports.uploadLargeFileController = async (req, res) => {
  const file = req.file;

  if (!file) {
    return handleError(new Error("No file provided"), res);
  }

  const timestamp = Date.now();
  const filename = `${timestamp}-${file.originalname}`;

  const params = {
    Bucket: "fitn-bucket",
    Key: filename,
    Body: file.buffer,
    ContentType: file.mimetype,
  };

  try {
    // For very large files, use maximum efficiency settings
    const uploadParallel = new Upload({
      client: s3,
      queueSize: 10, // Maximum concurrent parts
      partSize: 100 * 1024 * 1024, // 100MB parts for maximum efficiency
      leavePartsOnError: false,
      params,
    });

    // Calculate theoretical maximum with these settings
    const maxParts = 10000; // AWS limit
    const maxSize = (100 * 1024 * 1024 * maxParts) / (1024 * 1024 * 1024); // In GB
    console.log(
      `Theoretical max file size with current config: ${maxSize.toFixed(2)}GB`
    );

    const data = await uploadParallel.done();

    res.status(200).json({
      success: true,
      fileUrl: data.Location,
      fileKey: data.Key,
      fileSize: file.size,
      maxTheoretical: `${maxSize.toFixed(2)}GB`,
    });
  } catch (error) {
    console.error("Large File Upload Error:", error);
    return handleError(error, res);
  }
};

// Upload image from external URL to S3
module.exports.uploadFromUrlController = async (req, res) => {
  const { imageUrl } = req.body;

  if (!imageUrl) {
    return res.status(400).json({
      success: false,
      error: "Image URL is required",
    });
  }

  // Validate URL format
  try {
    new URL(imageUrl);
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: "Invalid URL format",
    });
  }

  try {
    // Download image from URL
    const response = await axios.get(imageUrl, {
      responseType: "arraybuffer",
      timeout: 30000, // 30 second timeout
      maxContentLength: 10 * 1024 * 1024, // 10MB max size
      validateStatus: (status) => status === 200,
    });

    const imageBuffer = Buffer.from(response.data);
    const contentType = response.headers["content-type"] || "image/svg+xml";

    // Validate that it's an image
    if (!contentType.startsWith("image/")) {
      return res.status(400).json({
        success: false,
        error: "URL does not point to an image",
      });
    }

    // Check file size limits
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB limit for avatars
    if (imageBuffer.length > MAX_FILE_SIZE) {
      return res.status(400).json({
        success: false,
        error: "Image too large",
        maxSize: "10MB",
        receivedSize: `${(imageBuffer.length / (1024 * 1024)).toFixed(2)}MB`,
      });
    }

    // Get optimized config based on file size
    const uploadConfig = getUploadConfig(imageBuffer.length);

    // Generate unique filename
    const timestamp = Date.now();
    const extension = contentType.includes("svg") ? "svg" : contentType.split("/")[1] || "png";
    const filename = `${timestamp}-avatar.${extension}`;

    const params = {
      Bucket: "fitn-bucket",
      Key: filename,
      Body: imageBuffer,
      ContentType: contentType,
    };

    const uploadParallel = new Upload({
      client: s3,
      queueSize: uploadConfig.queueSize,
      partSize: uploadConfig.partSize,
      leavePartsOnError: false,
      params,
    });

    const data = await uploadParallel.done();

    res.status(200).json({
      success: true,
      fileUrl: data.Location,
      filKey: data.Key,
      fileSize: imageBuffer.length,
    });
  } catch (error) {
    console.error("Upload from URL Error:", error);
    
    if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") {
      return res.status(408).json({
        success: false,
        error: "Request timeout. Please try again.",
      });
    }
    
    if (error.response) {
      return res.status(error.response.status).json({
        success: false,
        error: "Failed to download image from URL",
        details: error.message,
      });
    }

    return handleError(error, res);
  }
};
