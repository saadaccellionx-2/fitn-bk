const { ADMIN_MODEL } = require("../../../models");
const stytch = require("stytch");
const {
  hashPassword,
  generateAccessToken,
  generateRefreshToken,
  comparewPassword,
} = require("../../../helpers/user");
const handleError = require("../../../utils/errorHandler");

const client = new stytch.Client({
  project_id: process.env.STYTCH_PROJECT_ID,
  secret: process.env.STYTCH_SECRET,
  env:
    process.env.STYTCH_ENVIRONMENT === "development"
      ? stytch.envs.test
      : stytch.envs.live,
});

module.exports = {
  CREATE_ADMIN: async (req, res) => {
    try {
      const reqData = req.body;

      if (reqData.password) {
        reqData.password = await hashPassword(reqData.password);
      }

      const existingUser = await ADMIN_MODEL.findOne({ email: reqData.email });
      if (existingUser) {
        return res.status(400).json({
          status: "error",
          message: "Email already exists!",
        });
      }

      const admin = await ADMIN_MODEL.create(reqData);
      return res.status(201).json({
        message: "Admin account created successfully",
        data: admin,
      });
    } catch (error) {
      return handleError(error, res);
    }
  },

  LOGIN_ADMIN: async (req, res) => {
    try {
      const reqData = req.body;
      const user = await ADMIN_MODEL.findOne({ email: reqData.email });

      if (!user) {
        return res.status(401).json({
          status: "error",
          message: "Invalid email or password!",
        });
      }

      const isPaswordCompared = comparewPassword(
        reqData.password,
        user.password
      );

      if (!isPaswordCompared) {
        return res.status(401).json({
          status: "error",
          message: "Invalid email or password!",
        });
      }

      // Generate both access and refresh tokens
      const access_token = generateAccessToken(user);
      const refresh_token = generateRefreshToken(user);

      // Hash and store refresh token in database
      const bcrypt = require("bcryptjs");
      const hashedRefreshToken = await bcrypt.hash(refresh_token, 10);
      user.refreshToken = hashedRefreshToken;
      user.updatedAt = Date.now();
      await user.save();

      user.password = undefined;
      user.refreshToken = undefined;
      const account = JSON.parse(JSON.stringify(user));

      return res.status(200).json({
        message: "Login successful",
        data: { ...account, access_token, refresh_token },
      });
    } catch (error) {
      return handleError(error, res);
    }
  },

  GET_ADMIN_PROFILE: async (req, res) => {
    try {
      const currentUser = req.user;

      if (!currentUser) {
        return res.status(404).json({
          message: "User not found",
        });
      }

      return res.status(200).json(currentUser);
    } catch (error) {
      return handleError(error, res);
    }
  },

  UPDATE_ADMIN: async (req, res) => {
    try {
      const { email, username, password } = req.body;
      const adminId = req.user?._id;

      const admin = await ADMIN_MODEL.findById(adminId);

      if (!admin) {
        return res.status(404).json({
          status: "error",
          message: "Admin not found!",
        });
      }

      if (email && email !== admin.email) {
        const existingEmail = await ADMIN_MODEL.findOne({ email });

        if (existingEmail) {
          return res.status(400).json({
            status: "error",
            message: "Email already exists!",
          });
        }

        admin.email = email;
      }

      if (username) {
        admin.username = username;
      }

      if (password) {
        admin.password = await hashPassword(password);
      }

      admin.updatedAt = Date.now();

      const updatedAdmin = await admin.save();

      return res.status(200).json({
        message: "Admin profile updated successfully",
        data: updatedAdmin,
      });
    } catch (error) {
      return handleError(error, res);
    }
  },

  REFRESH_TOKEN: async (req, res) => {
    try {
      const { refresh_token } = req.body;

      if (!refresh_token) {
        return res.status(401).json({
          status: "error",
          message: "Refresh token is required!",
        });
      }

      // Verify refresh token
      const jwt = require("jsonwebtoken");
      const bcrypt = require("bcryptjs");

      let decoded;
      try {
        decoded = jwt.verify(
          refresh_token,
          process.env.JWT_REFRESH_SECRET_KEY || process.env.JWT_SECRET_KEY
        );
      } catch (err) {
        return res.status(401).json({
          status: "error",
          message: "Invalid or expired refresh token!",
        });
      }

      // Find admin and verify stored refresh token
      const admin = await ADMIN_MODEL.findById(decoded._id);
      if (!admin || !admin.refreshToken) {
        return res.status(401).json({
          status: "error",
          message: "Invalid refresh token!",
        });
      }

      // Compare refresh token with stored hash
      const isValidRefreshToken = await bcrypt.compare(
        refresh_token,
        admin.refreshToken
      );

      if (!isValidRefreshToken) {
        return res.status(401).json({
          status: "error",
          message: "Invalid refresh token!",
        });
      }

      // Generate new access token
      const new_access_token = generateAccessToken(admin);

      // Generate new refresh token and rotate
      const new_refresh_token = generateRefreshToken(admin);
      const hashedRefreshToken = await bcrypt.hash(new_refresh_token, 10);
      admin.refreshToken = hashedRefreshToken;
      admin.updatedAt = Date.now();
      await admin.save();

      return res.status(200).json({
        message: "Token refreshed successfully",
        data: { 
          access_token: new_access_token,
          refresh_token: new_refresh_token
        },
      });
    } catch (error) {
      return handleError(error, res);
    }
  },

  LOGOUT_ADMIN: async (req, res) => {
    try {
      const adminId = req.user?._id;

      const admin = await ADMIN_MODEL.findById(adminId);
      if (!admin) {
        return res.status(404).json({
          status: "error",
          message: "Admin not found!",
        });
      }

      // Clear refresh token from database
      admin.refreshToken = null;
      admin.updatedAt = Date.now();
      await admin.save();

      return res.status(200).json({
        message: "Logout successful",
      });
    } catch (error) {
      return handleError(error, res);
    }
  },
};
