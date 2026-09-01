require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const Agent = require("./models/Agent");
const Order = require("./models/Order");
const { verifyPaystackTransaction } = require("./paystack");
const { sendSms } = require("./sms");

const app = express();
app.use(express.json());
app.use(cors({ origin: process.env.FRONTEND_URL || "*" }));

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log("Connected to MongoDB"))
  .catch(err => console.error("MongoDB connection error:", err.message));

/* ---------------------------- auth middleware ---------------------------- */
function requireAdmin(req, res, next) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Missing admin token" });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload.role !== "admin") throw new Error("not admin");
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired admin session" });
  }
}
function requireAgent(req, res, next) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Missing agent token" });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload.role !== "agent") throw new Error("not agent");
    req.agentId = payload.id;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired session — log in again" });
  }
}

/* ---------------------------------------------------------------------------
   ORDERS
--------------------------------------------------------------------------- */

// Called right after the Paystack popup succeeds on the frontend.
// Verifies the payment server-side before trusting it, THEN creates the orders.
app.post("/api/orders/verify", async (req, res) => {
  const { reference, items } = req.body;
  if (!reference || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "reference and items are required" });
  }
  const check = await verifyPaystackTransaction(reference);
  if (!check.ok) return res.status(402).json({ error: "Payment could not be verified" });

  const expectedTotalPesewas = Math.round(items.reduce((s, i) => s + Number(i.amount), 0) * 100);
  if (check.amountPesewas !== expectedTotalPesewas) {
    return res.status(402).json({ error: "Paid amount does not match cart total" });
  }

  const created = [];
  for (const item of items) {
    const count = await Order.countDocuments();
    const order = await Order.create({
      ref: `DL-${1000 + count}`,
      paystackRef: reference,
      phone: item.phone,
      network: item.network,
      bundle: item.bundle,
      amount: item.amount,
      status: "Processing"
    });
    created.push(order);
  }
  res.json({ orders: created });
});

// Track order(s) by phone number or ref — public.
app.get("/api/orders", async (req, res) => {
  const q = (req.query.q || "").trim();
  if (!q) return res.json({ orders: [] });
  const orders = await Order.find({
    $or: [{ phone: new RegExp(q, "i") }, { ref: new RegExp(`^${q}$`, "i") }]
  }).sort({ createdAt: -1 }).limit(20);
  res.json({ orders });
});

// Admin: list all orders.
app.get("/api/admin/orders", requireAdmin, async (req, res) => {
  const orders = await Order.find().sort({ createdAt: -1 }).limit(200);
  res.json({ orders });
});

// Admin: move an order to the next status. Sends a real SMS when it hits Delivered.
app.post("/api/admin/orders/:ref/advance", requireAdmin, async (req, res) => {
  const stages = ["Pending", "Processing", "Delivered", "Completed"];
  const order = await Order.findOne({ ref: req.params.ref });
  if (!order) return res.status(404).json({ error: "Order not found" });
  const nextIdx = stages.indexOf(order.status) + 1;
  if (nextIdx >= stages.length) return res.status(400).json({ error: "Already at final status" });
  order.status = stages[nextIdx];
  await order.save();
  if (order.status === "Delivered") {
    await sendSms(order.phone, `Your ${order.network} ${order.bundle} has been delivered. Thank you for choosing DataLane GH.`);
  }
  res.json({ order });
});

/* ---------------------------------------------------------------------------
   AGENTS
--------------------------------------------------------------------------- */

// Called after the Paystack popup succeeds for the GHC50 agent fee.
app.post("/api/agents/register", async (req, res) => {
  const { name, storeName, phone, email, password, reference } = req.body;
  if (!name || !phone || !email || !password || !reference) {
    return res.status(400).json({ error: "All fields are required" });
  }
  const existing = await Agent.findOne({ $or: [{ phone }, { email }] });
  if (existing) return res.status(409).json({ error: "An account with that phone or email already exists" });

  const check = await verifyPaystackTransaction(reference);
  if (!check.ok) return res.status(402).json({ error: "Payment could not be verified" });
  if (check.amountPesewas !== 5000) { // GHC50 = 5000 pesewas
    return res.status(402).json({ error: "Paid amount does not match the GH₵50 agent fee" });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const agent = await Agent.create({ name, storeName: storeName || "", phone, email, passwordHash, paystackRef: reference, status: "pending" });
  res.json({ message: "Payment verified. Your application is awaiting admin approval.", agentId: agent._id });
});

app.post("/api/agents/login", async (req, res) => {
  const { identifier, password } = req.body;
  const agent = await Agent.findOne({ $or: [{ phone: identifier }, { email: identifier }] });
  if (!agent) return res.status(401).json({ error: "No account found" });
  const match = await bcrypt.compare(password, agent.passwordHash);
  if (!match) return res.status(401).json({ error: "Incorrect password" });
  if (agent.status !== "approved") return res.status(403).json({ error: "Your account is still pending admin approval" });

  const token = jwt.sign({ id: agent._id, role: "agent" }, process.env.JWT_SECRET, { expiresIn: "7d" });
  res.json({ token, agent: { name: agent.name, storeName: agent.storeName, phone: agent.phone, email: agent.email, resalePrices: agent.resalePrices, workingHours: agent.workingHours } });
});

app.get("/api/agents/me", requireAgent, async (req, res) => {
  const agent = await Agent.findById(req.agentId);
  if (!agent) return res.status(404).json({ error: "Not found" });
  res.json({ agent: { name: agent.name, storeName: agent.storeName, phone: agent.phone, email: agent.email, resalePrices: agent.resalePrices, workingHours: agent.workingHours } });
});

app.put("/api/agents/me/prices", requireAgent, async (req, res) => {
  const { resalePrices } = req.body;
  const agent = await Agent.findByIdAndUpdate(req.agentId, { resalePrices }, { new: true });
  res.json({ resalePrices: agent.resalePrices });
});

app.put("/api/agents/me/store", requireAgent, async (req, res) => {
  const { storeName, workingHours } = req.body;
  const agent = await Agent.findByIdAndUpdate(req.agentId, { storeName, workingHours }, { new: true });
  res.json({ storeName: agent.storeName, workingHours: agent.workingHours });
});

// Admin: list + approve/reject agent applications.
app.get("/api/admin/agents", requireAdmin, async (req, res) => {
  const agents = await Agent.find().sort({ createdAt: -1 });
  res.json({ agents });
});
app.post("/api/admin/agents/:id/approve", requireAdmin, async (req, res) => {
  const agent = await Agent.findByIdAndUpdate(req.params.id, { status: "approved" }, { new: true });
  res.json({ agent });
});
app.post("/api/admin/agents/:id/reject", requireAdmin, async (req, res) => {
  const agent = await Agent.findByIdAndUpdate(req.params.id, { status: "rejected" }, { new: true });
  res.json({ agent });
});

/* ---------------------------------------------------------------------------
   ADMIN LOGIN
--------------------------------------------------------------------------- */
app.post("/api/admin/login", (req, res) => {
  const { password } = req.body;
  if (password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Wrong password" });
  }
  const token = jwt.sign({ role: "admin" }, process.env.JWT_SECRET, { expiresIn: "12h" });
  res.json({ token });
});

app.get("/", (req, res) => res.send("DataLane GH backend is running."));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`DataLane backend listening on port ${PORT}`));
