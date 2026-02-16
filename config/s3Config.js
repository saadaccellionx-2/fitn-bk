const { S3Client } = require("@aws-sdk/client-s3");

module.exports.s3 = new S3Client({
  region: "eu-west-2",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY,
    secretAccessKey: process.env.AWS_SECRET_KEY,
  },
});
