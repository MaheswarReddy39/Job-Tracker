const mongoose = require("mongoose");

const jobSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true
  },

  companyName: {
    type: String,
    required: true,
    trim: true
  },

  role: {
    type: String,
    required: true,
    trim: true
  },

  location: {
    type: String,
    default: ""
  },

  status: {
    type: String,
    enum: ["Applied", "Interview", "Selected", "Rejected"],
    default: "Applied"
  },

  appliedDate: {
    type: Date,
    default: Date.now
  }
},

  { timestamps: true }
)


module.exports = mongoose.model("Job", jobSchema)