const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../model/User")
const protect = require("../middleware/auth")


const router = express.Router();

const createToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "7d" });

const publicUser = (user) => ({ id: user._id, name: user.name, email: user.email });

// register
router.post("/register", async(req, res) => {
  try {
    const { name, email, password } = req.body;

    if(!name || !email || !password) {
      return res.status(400).json({message:"Name, email and password are required"});
    }
    if(password.length < 6) {
      return res.status(400).json({message:"Password must be at least 6 characters"});
    }

    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if(existing) {
      return res.status(409).json({message:"An account with this email already exists"});
    }

    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, password: hashed });

    res.status(201).json({ token: createToken(user._id), user: publicUser(user) });
  } catch(error) {
    if(error.code === 11000) {
      return res.status(409).json({message:"An account with this email already exists"});
    }
    res.status(400).json({message:error.message})
  }
})

// login
router.post("/login", async(req, res) => {
  try {
    const { email, password } = req.body;

    if(!email || !password) {
      return res.status(400).json({message:"Email and password are required"});
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() }).select("+password");
    if(!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({message:"Invalid email or password"});
    }

    res.status(200).json({ token: createToken(user._id), user: publicUser(user) });
  } catch(error) {
    res.status(500).json({message:error.message})
  }
})

// current user
router.get("/me", protect, async(req, res) => {
  try {
    const user = await User.findById(req.userId);
    if(!user) {
      return res.status(401).json({message:"User not found"});
    }
    res.status(200).json({ user: publicUser(user) });
  } catch(error) {
    res.status(500).json({message:error.message})
  }
})

module.exports = router;
