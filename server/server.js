const express = require("express")
const cors = require("cors")
require("dotenv").config();

const connectDB = require("./config/db")
const jobRoutes = require("./routes/jobRoutes")
const authRoutes = require("./routes/authRoutes")

const app = express()

// CLIENT_URL can hold one or more comma-separated origins; unset allows all (local dev)
const allowedOrigins = (process.env.CLIENT_URL || "")
  .split(",")
  .map((origin) => origin.trim().replace(/\/+$/, ""))
  .filter(Boolean)

app.use(cors({
  origin: allowedOrigins.length ? allowedOrigins : true
}))
app.use(express.json())

app.use("/api/auth", authRoutes)
app.use("/api/jobs", jobRoutes)
app.get("/", (req, res) => {
  res.send("Job application checker api is running")
})

app.use((req, res) => {
  res.status(404).json({ message: "Route not found" })
})

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET is not set in .env");
    }
    await connectDB();

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`)
    })
  } catch(error) {
    console.log("Failed to start server:", error.message)
    process.exit(1)
  }
}

startServer();