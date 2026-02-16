// const express = require("express");
// const router = express.Router();
// const { imageHandler, VideoHandler } = require("./service");
// const { singleUpload } = require("./../../helpers/multerSetup");

// router.post("/uploadImage", singleUpload, async (req, res) => {
//   try {
//     const { secure_url, public_id } = await imageHandler(req, res);

//     res.status(200).json({ success: true, url: secure_url, public_id });
//   } catch (error) {
//     console.error("Error uploading image:", error);
//     res.status(500).json({ success: false, error: "Image upload failed" });
//   }
// });

// router.post("/uploadVideo", singleUpload, async (req, res) => {
//   try {
//     const { secure_url, public_id } = await VideoHandler(req, res);

//     res.status(200).json({ success: true, url: secure_url, public_id });
//   } catch (error) {
//     console.error("Error uploading video:", error);
//     res.status(500).json({ success: false, error: "video upload failed" });
//   }
// });

// module.exports = router;

var express = require("express");
const { upload, uploadVideo } = require("./service");
const singleUpload = upload.single("image");
const singleVideoUpload = uploadVideo.single("video");
var router = express.Router();

router.post("/uploadVideo", async function (req, res) {
  const uploadVideo = (req, res) => {
    return new Promise((resolve, reject) => {
      singleVideoUpload(req, res, (err) => {
        if (err) {
          console.log(err);
          return reject(err);
        }
        resolve();
      });
    });
  };

  try {
    await uploadVideo(req, res);

    res.status(200).json({
      success: true,
      url: req.file.location,
      s3BucketId: req.file.key,
      public_id: req.file.location,
    });
  } catch (err) {
    console.log("error", err);
    res.status(500).json({
      success: false,
      errors: {
        title: "Video Upload Error",
        message: err?.message,
        error: err?.stack,
      },
    });
  }
});

router.post("/uploadImage", async function (req, res) {
  const uploadImage = (req, res) => {
    return new Promise((resolve, reject) => {
      singleUpload(req, res, (err) => {
        if (err) {
          return reject(err);
        }
        resolve();
      });
    });
  };

  try {
    await uploadImage(req, res);
    res.status(200).json({
      success: true,
      url: req.file.location,
      s3BucketId: req.file.key,
      public_id: req.file.location,
    });
  } catch (error) {
    return res.json({
      success: false,
      errors: {
        title: "Image Upload Error",
        message: error?.message,
        error: error?.stack,
      },
    });
  }
});

module.exports = router;
