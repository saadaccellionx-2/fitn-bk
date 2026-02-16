var express = require("express");
const multer = require("multer");
const { uploadFileController, uploadFromUrlController } = require("./service");
var router = express.Router();

const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 1024 * 1024 * 1024 },
});

router.post("/media", upload.single("file"), uploadFileController);
router.post("/fromUrl", express.json(), uploadFromUrlController);

module.exports = router;
