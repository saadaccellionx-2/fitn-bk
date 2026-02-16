const { Upload } = require("@aws-sdk/lib-storage");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("ffmpeg-static");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { s3 } = require("../../../config/s3Config");
const handleError = require("../../../utils/errorHandler");

ffmpeg.setFfmpegPath(ffmpegPath);

// Optimized upload configuration
const getUploadConfig = (fileSize) => {
  if (fileSize < 100 * 1024 * 1024) {
    return { queueSize: 4, partSize: 5 * 1024 * 1024 };
  } else if (fileSize < 1024 * 1024 * 1024) {
    return { queueSize: 6, partSize: 10 * 1024 * 1024 };
  } else {
    return { queueSize: 8, partSize: 50 * 1024 * 1024 };
  }
};


const compressVideo = async (inputBuffer, filename) => {
  const inputPath = path.join(os.tmpdir(), `${Date.now()}-${filename}`);
  const outputPath = inputPath.replace(/\.[^/.]+$/, "_compressed.mp4");

  fs.writeFileSync(inputPath, inputBuffer);

  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions([
        "-c:v libx264",
        "-preset fast",
        "-crf 28", 
        "-movflags +faststart", 
      ])
      .on("end", () => {
        const outputBuffer = fs.readFileSync(outputPath);
        fs.unlinkSync(inputPath);
        fs.unlinkSync(outputPath);
        resolve(outputBuffer);
      })
      .on("error", (err) => {
        console.error("Compression error:", err);
        reject(err);
      })
      .save(outputPath);
  });
};


module.exports.uploadFileController = async (req, res) => {
  const file = req.file;

  if (!file) {
    return handleError(new Error("No file provided"), res);
  }

  const MAX_FILE_SIZE = 5 * 1024 * 1024 * 1024; 
  if (file.size > MAX_FILE_SIZE) {
    return res.status(400).json({
      error: "File too large",
      maxSize: "5GB",
      receivedSize: `${(file.size / (1024 * 1024 * 1024)).toFixed(2)}GB`,
    });
  }

  const timestamp = Date.now();
  const originalName = file.originalname;
  const filename = `${timestamp}-${originalName}`;

  try {
    let fileBuffer = file.buffer;
    let contentType = file.mimetype;


    if (file.mimetype.startsWith("video/")) {
      fileBuffer = await compressVideo(file.buffer, file.originalname);
      contentType = "video/mp4";
    }

    const uploadConfig = getUploadConfig(fileBuffer.length);

    const params = {
      Bucket: "fitn-bucket",
      Key: filename,
      Body: fileBuffer,
      ContentType: contentType,
    };

    const uploadParallel = new Upload({
      client: s3,
      queueSize: uploadConfig.queueSize,
      partSize: uploadConfig.partSize,
      leavePartsOnError: false,
      params,
    });

    uploadParallel.on("httpUploadProgress", (progress) => {
      const percentage = Math.round((progress.loaded / progress.total) * 100);
      console.log(`Upload progress: ${percentage}%`);
    });

    const data = await uploadParallel.done();

    res.status(200).json({
      success: true,
      fileUrl: data.Location,
      fileKey: data.Key,
      fileSize: fileBuffer.length,
      uploadConfig,
    });
  } catch (error) {
    console.error("Admin Upload Error:", error);
    return handleError(error, res);
  }
};
