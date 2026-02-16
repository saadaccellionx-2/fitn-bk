const mongoose = require("mongoose");

const commentReportSchema = new mongoose.Schema(
  {
    comment: {
      type: mongoose.Schema.ObjectId,
      ref: "comments", 
      required: true,
    },
    user: {
      type: mongoose.Schema.ObjectId,
      ref: "users",
      required: true,
    },
    report: {
      detail: {
        type: String,
        required: false,
      },
      reason: {
        type: String,
        required: true,
      },
    },
  },
  { timestamps: true }
);

const CommentReport = mongoose.model("comment_reports", commentReportSchema);
module.exports = CommentReport;
