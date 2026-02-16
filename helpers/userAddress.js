const axios = require("axios");
const { USER_ADDRESS_MODEL } = require("../models");
const { isPublicIp } = require("../utils/getRequestIp");

async function saveOrUpdateUserAddress(userId, ip) {
  try {
    const userIP = ip;

    if (!ip || !userId) return;
    if (!isPublicIp(userIP)) {
      return { success: false, ip: userIP, error: "non-public-ip" };
    }

    const response = await axios.get(`https://ipapi.co/${userIP}/json/`);

    const { data } = response;

    const locationData = {
      country: data?.country_name || "",
      region: data?.region || "",
      city: data?.city || "",
      lat: data?.latitude || null,
      lon: data?.longitude || null,
    };

    await USER_ADDRESS_MODEL.updateOne(
      { userId },
      {
        $set: {
          userId,
          ip,
          location: locationData,
          timestamp: new Date(),
        },
      },
      { upsert: true }
    );

    return { success: true, ip, location: locationData };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

module.exports = saveOrUpdateUserAddress;
