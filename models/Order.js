const mongoose = require("mongoose");

const OrderSchema = new mongoose.Schema({
  ref: { type: String, required: true, unique: true },
  paystackRef: { type: String, required: true },
  phone: { type: String, required: true },
  network: { type: String, required: true },
  bundle: { type: String, required: true },
  amount: { type: Number, required: true },
  status: { type: String, enum: ["Pending", "Processing", "Delivered", "Completed"], default: "Processing" },
  agentId: { type: mongoose.Schema.Types.ObjectId, ref: "Agent", default: null },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Order", OrderSchema);
