var admin = require("firebase-admin");

var serviceAccount = require("../fitn-e47d5-firebase-adminsdk-78s0q-36bd6c6123.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
module.exports.admin = admin;
