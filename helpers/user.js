const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const hashPassword = (password) =>
  new Promise(async (resolve, reject) => {
    try {
      resolve(await bcrypt.hash(password, 12));
    } catch (error) {
      reject(error);
    }
  });

const comparewPassword = async (clientPass, dbPass) => {
  return bcrypt.compareSync(clientPass, dbPass);
};

const formateData = (data) => {
  data.dob = new Date(data.dob);
  data.contact = parseInt(data.contact);
  return data;
};

const generateAccessToken = (user) => {
  return jwt.sign(
    {
      _id: user?._id,
      email: user?.email,
      role: user?.role,
    },
    process.env.JWT_SECRET_KEY,
    { expiresIn: "30d" }
  );
};

const generateRefreshToken = (user) => {
  return jwt.sign(
    {
      _id: user?._id,
      email: user?.email,
      role: user?.role,
    },
    process.env.JWT_REFRESH_SECRET_KEY || process.env.JWT_SECRET_KEY,
    { expiresIn: "30d" }
  );
};

module.exports = {
  hashPassword,
  comparewPassword,
  formateData,
  generateAccessToken,
  generateRefreshToken,
};
