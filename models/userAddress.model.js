const mongoose = require("mongoose");

const userAddressSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "users",
    required: true,
  },
  ip: String,
  location: {
    country: String,
    region: String,
    city: String,
    lat: Number,
    lon: Number,
  },
  timestamp: { type: Date, default: Date.now },
});

userAddressSchema.index({ userId: 1 }, { unique: true });

const UserAddress = mongoose.model("User_Address", userAddressSchema);

module.exports = UserAddress;
