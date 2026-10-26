const express = require("express");
const Job = require("../model/Job")
const protect = require("../middleware/auth")


const router = express.Router();

// every job route needs a logged-in user
router.use(protect);

// post
router.post("/", async(req, res) => {
  try {
    const allowed = ["companyName", "role", "location", "status", "appliedDate"];
    const data = { user: req.userId };
    allowed.forEach((field) => {
      if (req.body[field] !== undefined) data[field] = req.body[field];
    });

    const job = await Job.create(data);
    res.status(201).json(job)
  } catch(error) {
    res.status(400).json({message:error.message})
  }
})

// get
router.get("/", async(req, res) => {
  try {
    const job = await Job.find({ user: req.userId }).sort({createdAt: -1});
    res.status(200).json(job)
  } catch(error) {
    res.status(500).json({message:error.message})
  }
})

// patch
router.patch("/:id", async(req, res) => {
  try {
    const allowed = ["companyName", "role", "location", "status", "appliedDate"];
    const updates = {};
    allowed.forEach((field) => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    const job = await Job.findOneAndUpdate({ _id: req.params.id, user: req.userId },
      updates,
      {new: true, runValidators: true}
    );

    if(!job) {
      return res.status(404).json({message:"Job not found"});
    }

    res.status(200).json(job);
  } catch(error) {
    res.status(400).json({message:error.message})
  }
})

// delete
router.delete("/:id", async(req, res) => {
  try {
    const job = await Job.findOneAndDelete({ _id: req.params.id, user: req.userId });

    if(!job) {
      return res.status(404).json({message:"Job not found"});
    }

    res.status(200).json({message:"Job deleted successfully"});
  } catch(error) {
    res.status(400).json({message:error.message})
  }
})

module.exports = router;