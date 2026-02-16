const mongoose = require('mongoose');

const bugReportSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: false
    },
    reportedBy: {
        type: mongoose.Schema.ObjectId,
        ref: 'users',
        required: true
    },
    mediaUrls: [{
        type: String,
        required:false,
    }],
    status: {
        type: String,
        enum: ['resolved', 'not_resolved'],
        default: 'not_resolved'
    },

},{
    timestamps: true
});

const BugReport = mongoose.model('bug_reports', bugReportSchema);
module.exports = BugReport;