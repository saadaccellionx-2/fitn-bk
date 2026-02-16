// const multer = require("multer");

// const { handleUpload } = require("../../helpers/cloudinary.helper");

// const storage = multer.memoryStorage();
// const upload = multer({ storage });
// const myUploadMiddleware = upload.single("file");

// function runMiddleware(req, res, fn) {
//   return new Promise((resolve, reject) => {
//     fn(req, res, (result) => {
//       if (result instanceof Error) {
//         return reject(result);
//       }
//       return resolve(result);
//     });
//   });
// }

// const imageHandler = async (req, res) => {
//   try {
//     const imageFolder = "images";

//     if (!req.file) {
//       // Handle the case where no file is uploaded
//       return res
//         .status(400)
//         .json({ success: false, error: "No file uploaded" });
//     }

//     const b64 = Buffer.from(req.file.buffer).toString("base64");
//     const dataURI = "data:" + req.file.mimetype + ";base64," + b64;
//     const cldRes = await handleUpload(dataURI, imageFolder);

//     return { public_id: cldRes.public_id, secure_url: cldRes.secure_url };
//   } catch (error) {
//     console.error("Error handling image:", error);
//     throw error;
//   }
// };

// const VideoHandler = async (req, res) => {
//   try {
//     const videoFolder = "videos";

//     if (!req.file) {
//       // Handle the case where no file is uploaded
//       return res
//         .status(400)
//         .json({ success: false, error: "No file uploaded" });
//     }

//     const b64 = Buffer.from(req.file.buffer).toString("base64");
//     const dataURI = "data:" + req.file.mimetype + ";base64," + b64;
//     const cldRes = await handleUpload(dataURI, videoFolder);

//     return { public_id: cldRes.public_id, secure_url: cldRes.secure_url };
//   } catch (error) {
//     console.error("Error handling image:", error);
//     throw error;
//   }
// };

// module.exports = { imageHandler, VideoHandler };

const multer = require("multer");
const multerS3 = require("multer-s3");
const { S3Client, DeleteObjectCommand } = require("@aws-sdk/client-s3");

const s3 = new S3Client({
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY,
    secretAccessKey: process.env.AWS_SECRET_KEY,
  },
  region: "eu-west-2",
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype) {
    cb(null, true);
  } else {
    cb(
      new Error("Invalid file type, only JPEG, PNG, and MP4 are allowed!"),
      false
    );
  }
};

var options = { partSize: 5 * 1024 * 1024, queueSize: 10 };

const upload = multer({
  fileFilter: fileFilter,
  limits: { fileSize: 500 * 1024 * 1024 },
  storage: multerS3({
    acl: "public-read",
    s3: s3,
    bucket: "fitn-bucket",
    metadata: function (req, file, cb) {
      cb(null, { fieldName: "TESTING_METADATA" });
    },
    key: function (req, file, cb) {
      let extentionArray = file.originalname.split(".");
      let extention = extentionArray[extentionArray.length - 1];
      cb(null, `${Date.now().toString()}.${extention}`);
    },
  }),
});

const uploadVideo = multer({
  fileFilter: fileFilter,
  limits: { fileSize: 500 * 1024 * 1024 },
  storage: multerS3({
    acl: "public-read",
    s3,
    bucket: "fitn-bucket",
    metadata: function (req, file, cb) {
      cb(null, { fieldName: "TESTING_METADATA" });
    },
    key: function (req, file, cb) {
      let extentionArray = file.originalname.split(".");
      let extention = extentionArray[extentionArray.length - 1];
      cb(null, `${Date.now().toString()}.${extention}`);
    },
  }),
});

const deleteFromAwsBucket = async (url) => {
  // Extract the key from the URL
  const key = url.split("amazonaws.com/")[1];

  // Define the parameters for the S3 delete operation
  const params = {
    Bucket: "fitn-bucket",
    Key: key,
  };

  try {
    const command = new DeleteObjectCommand(params);
    await s3.send(command);
    console.log(`Object ${key} deleted successfully from ${params.Bucket}`);
  } catch (err) {
    console.error(`Error deleting object ${key} from ${params.Bucket}:`, err);
  }
};

module.exports = { upload, uploadVideo, deleteFromAwsBucket };
