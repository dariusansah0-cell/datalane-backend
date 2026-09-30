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

  // BigNash Data Hub delivery tracking — filled in once we dispatch the real bundle.
  bignashOrderId: { type: String, default: null },       // BigNash's internal order id (data.id from their response)
  bignashStatus: { type: String, default: null },        // initiated | pending | processing | completed | failed
  bignashCarrier: { type: String, default: null },       // the carrier code we sent them (MTN / TELECEL / AT)
  bignashCapacityGB: { type: String, default: null },    // the capacity string we sent (e.g. "5")
  deliveryFailureReason: { type: String, default: null },

  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Order", OrderSchema);
