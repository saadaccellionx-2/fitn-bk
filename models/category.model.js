const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
    name: {
        type: String,
    },
    description: {
        type: String,
    },
    createdAt: {
        type: Date,
        default: new Date(),
    },
    updatedAt: {
        type: Date,
    }
});

const CATEGORIES = mongoose.model('category', categorySchema);
module.exports = CATEGORIES;