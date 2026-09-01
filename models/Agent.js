const mongoose = require("mongoose");

const AgentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  storeName: { type: String, default: "" },
  phone: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
  paystackRef: { type: String, required: true },
  resalePrices: { type: Map, of: Number, default: {} }, // key = "MTN-5GB" style
  workingHours: { type: mongoose.Schema.Types.Mixed, default: {} }, // { mon: {open:"08:00", close:"20:00", closed:false}, ... }
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Agent", AgentSchema);
