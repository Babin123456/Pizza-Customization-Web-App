import Order from "../models/Order.js";
import Cart from "../models/Cart.js";
import Coupon from "../models/Coupon.js";
import { evaluateCoupon } from "./couponController.js";

export const createOrder = async (req, res) => {
  try {
    const { address, phone, paymentMethod = "cod", deliveryFee = 0, couponCode } = req.body;

    if (!address || address.trim().length < 12) {
      return res.status(400).json({ error: "Complete delivery address is required" });
    }

    if (!/^\d{10}$/.test(String(phone || ""))) {
      return res.status(400).json({ error: "Valid 10-digit phone number is required" });
    }

    if (!["cod", "online"].includes(paymentMethod)) {
      return res.status(400).json({ error: "Invalid payment method" });
    }

    const cart = await Cart.findOne({ user: req.user._id });

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ error: "Cart is empty" });
    }

    const subtotal = cart.items.reduce((sum, item) => sum + item.price * item.qty, 0);
    const safeDeliveryFee = Math.max(0, Number(deliveryFee) || 0);

    // Re-validate and recompute any coupon discount on the server. The client
    // cannot be trusted to send a discount amount, so we look the coupon up
    // fresh and run the same engine used by the validate endpoint.
    let discount = 0;
    let appliedCoupon = null;
    if (couponCode && String(couponCode).trim()) {
      const coupon = await Coupon.findOne({
        code: String(couponCode).trim().toUpperCase(),
      });

      // First run the shared engine: it validates active/expiry/min-order and
      // computes the authoritative discount. (It also does an early usage-limit
      // read, but that read is not the enforcement point -- see the atomic
      // claim below.)
      const result = evaluateCoupon(coupon, subtotal);
      if (!result.ok) {
        return res.status(400).json({ error: result.reason });
      }

      // Atomically claim one redemption slot. The global usageLimit is enforced
      // here in a single conditional update, so two orders placed concurrently
      // can never both take the last remaining slot. This closes the TOCTOU
      // race that the previous read-then-save() increment allowed (same bug
      // class as the payment-order binding race fixed in #22). usageLimit === 0
      // means unlimited, so those coupons always pass the filter.
      const claimed = await Coupon.findOneAndUpdate(
        {
          _id: coupon._id,
          $or: [
            { usageLimit: 0 },
            { $expr: { $lt: ["$usedCount", "$usageLimit"] } },
          ],
        },
        { $inc: { usedCount: 1 } },
        { new: true }
      );

      if (!claimed) {
        return res
          .status(400)
          .json({ error: "This coupon has reached its usage limit" });
      }

      discount = result.discount;
      appliedCoupon = claimed;
    }

    const totalAmount = subtotal - discount + safeDeliveryFee;

    let order;
    try {
      order = await Order.create({
        user: req.user._id,
        items: cart.items.map((item) => item.toObject()),
        subtotal,
        deliveryFee: safeDeliveryFee,
        discount,
        couponCode: appliedCoupon ? appliedCoupon.code : null,
        totalAmount,
        address: address.trim(),
        phone: String(phone),
        paymentMethod,
        paymentStatus: paymentMethod === "cod" ? "cod" : "pending",
        orderStatus: "placed",
      });
    } catch (orderErr) {
      // The order failed to persist after we claimed a redemption slot, so
      // release that slot to keep usedCount honest -- a failed order must not
      // burn a coupon use. Best-effort: never let a rollback failure mask the
      // original error.
      if (appliedCoupon) {
        try {
          await Coupon.updateOne(
            { _id: appliedCoupon._id, usedCount: { $gt: 0 } },
            { $inc: { usedCount: -1 } }
          );
        } catch (rollbackErr) {
          console.error(
            "Failed to release coupon slot after order creation error:",
            rollbackErr
          );
        }
      }
      throw orderErr;
    }

    if (paymentMethod === "cod") {
      cart.items = [];
      await cart.save();
    }

    res.status(201).json({
      success: true,
      data: order,
    });
  } catch (error) {
    console.error("Create order error:", error);
    res.status(500).json({ error: "Failed to create order" });
  }
};

export const getMyOrders = async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user._id }).sort("-createdAt");
    res.json({ success: true, data: orders });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch orders" });
  }
};

export const getOrderById = async (req, res) => {
  try {
    const query = { _id: req.params.id };
    if (req.user.role !== "admin") query.user = req.user._id;

    const order = await Order.findOne(query).populate("user", "name email");
    if (!order) return res.status(404).json({ error: "Order not found" });

    res.json({ success: true, data: order });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch order" });
  }
};

export const getAllOrders = async (req, res) => {
  try {
    const orders = await Order.find().populate("user", "name email").sort("-createdAt");
    res.json({ success: true, data: orders });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch orders" });
  }
};

export const updateOrderStatus = async (req, res) => {
  try {
    const allowedStatuses = ["placed", "confirmed", "preparing", "out_for_delivery", "delivered", "cancelled"];
    if (!allowedStatuses.includes(req.body.status)) {
      return res.status(400).json({ error: "Invalid order status" });
    }

    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    order.orderStatus = req.body.status;
    await order.save();

    res.json({ success: true, data: order });
  } catch (error) {
    res.status(500).json({ error: "Failed to update order status" });
  }
};