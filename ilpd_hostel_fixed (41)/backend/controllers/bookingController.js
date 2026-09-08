const Booking = require("../models/Booking");
const Room = require("../models/Room");
const Concern = require("../models/Concern");
const Survey = require("../models/Survey");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const {
  ACCOMMODATION_TYPES,
  DEFAULT_ACCOMMODATION_TYPE,
  getAccommodationConfig,
  getBaseRate,
  ACTIVE_BOOKING_STATUSES,
  calculateBillingMonths,
  validateBookingDates,
  validateDateRange,
  CANCELLATION_DEADLINE_DAYS,
  getCancellationDeadline,
  canClientCancelBooking,
  REFUND_DAILY_DIVISOR,
  EDIT_DEADLINE_HOURS,
  calculateStayDays,
  calculateProratedStayPrice,
  calculateUnusedStayRefund,
  canClientEditPendingBooking,
} = require("../utils/bookingRules");

const calculateRefund = (booking, now = new Date()) => calculateUnusedStayRefund(booking, now);

const normalizeRegistration = (input = {}) => ({
  names: String(input.names || "").trim(),
  nationalIdOrPassport: String(input.nationalIdOrPassport || "").trim(),
  nationality: String(input.nationality || "").trim(),
  position: String(input.position || "").trim(),
  addressOrInstitution: String(input.addressOrInstitution || "").trim(),
  purposeOfVisit: String(input.purposeOfVisit || "").trim(),
  phoneNumber: String(input.phoneNumber || "").trim(),
  completedAt: new Date(),
});

const syncBookingRooms = async (booking) => {
  const ids = new Set();
  if (booking?.room) ids.add(String(booking.room._id || booking.room));
  (booking?.occupants || []).forEach((o) => { if (o.room) ids.add(String(o.room._id || o.room)); });
  for (const id of ids) await syncRoomStatus(id);
};


const processRefund = async (booking, refundAmount, reasonMessage) => {
  const requested = Math.max(0, Math.round(Number(refundAmount || 0)));
  if (!requested) return { automatic: false, message: reasonMessage };

  const transactions = Array.isArray(booking.paymentTransactions) ? booking.paymentTransactions : [];
  if (!transactions.length && booking.stripePaymentId) {
    transactions.push({ paymentIntentId: booking.stripePaymentId, amount: Number(booking.totalPrice || 0), refundedAmount: 0 });
  }
  booking.paymentTransactions = transactions;

  // Never refund more than the amount actually paid. Existing manual refunds
  // already owed are reserved so several occupants cannot collectively exceed
  // the original booking payment.
  const alreadyRefunded = transactions.reduce((sum, tx) => sum + Math.max(0, Number(tx.refundedAmount || 0)), 0);
  const existingOwed = Math.max(0, Number(booking.refundAmountOwed || 0));
  const totalPaid = transactions.reduce((sum, tx) => sum + Math.max(0, Number(tx.amount || 0)), 0);
  const remainingRefundCapacity = Math.max(0, totalPaid - alreadyRefunded - existingOwed);
  let remaining = Math.min(requested, remainingRefundCapacity);
  let automaticallyRefunded = 0;

  for (const tx of transactions) {
    if (!remaining || !tx.paymentIntentId) break;
    const available = Math.max(0, Number(tx.amount || 0) - Number(tx.refundedAmount || 0));
    const toRefund = Math.min(remaining, Math.round(available));
    if (!toRefund) continue;
    try {
      await stripe.refunds.create({ payment_intent: tx.paymentIntentId, amount: toRefund });
      tx.refundedAmount = Number(tx.refundedAmount || 0) + toRefund;
      automaticallyRefunded += toRefund;
      remaining -= toRefund;
    } catch (err) {
      console.error("Stripe refund error:", err.message);
      break;
    }
  }

  const newManualAmount = Math.max(0, Math.round(remaining));
  booking.refundAmountOwed = existingOwed + newManualAmount;
  const availableAfterRefund = transactions.reduce((sum, tx) => sum + Math.max(0, Number(tx.amount || 0) - Number(tx.refundedAmount || 0)), 0);

  if (automaticallyRefunded > 0 || newManualAmount > 0) {
    booking.paymentStatus = booking.refundAmountOwed > 0
      ? "refund_pending"
      : (availableAfterRefund <= 0 ? "refunded" : "partially_refunded");
    if (newManualAmount > 0) {
      return {
        automatic: automaticallyRefunded > 0 && newManualAmount === 0,
        message: `${reasonMessage} ${automaticallyRefunded.toLocaleString()} RWF was refunded automatically${newManualAmount ? ` and ${newManualAmount.toLocaleString()} RWF remains owed` : ""}.`,
      };
    }
    return {
      automatic: true,
      message: `${reasonMessage} A refund of ${automaticallyRefunded.toLocaleString()} RWF has been processed automatically.`,
    };
  }

  booking.paymentStatus = existingOwed > 0 ? "refund_pending" : "partially_refunded";
  return { automatic: false, message: `${reasonMessage} No additional refund is available from the original payment.` };
};

const getAvailableRoomsForDates = async (category, checkIn, checkOut, accommodationType = DEFAULT_ACCOMMODATION_TYPE) => {
  const locationFilter = accommodationType === "outside_hostel" ? "outside_hostel" : accommodationType;
  const rooms = await Room.find({ category, accommodationType: locationFilter, status: "available" }).lean();
  if (!rooms.length) return [];

  const roomIds = rooms.map((room) => room._id);
  const conflictingBookings = await Booking.find({
    status: { $in: ACTIVE_BOOKING_STATUSES },
    checkIn: { $lt: new Date(checkOut) },
    checkOut: { $gt: new Date(checkIn) },
    $or: [{ room: { $in: roomIds } }, { "occupants.room": { $in: roomIds } }],
  }).select("room occupants").lean();

  const blocked = new Set();
  conflictingBookings.forEach((booking) => {
    if (!booking.occupants?.length && booking.room) blocked.add(booking.room.toString());
    (booking.occupants || []).forEach((o) => {
      if (o.room && o.status !== "checked-out") blocked.add(o.room.toString());
    });
  });
  return rooms.filter((room) => !blocked.has(room._id.toString()));
};

const hasAvailableRoom = async (category, checkIn, checkOut, requiredCount = 1, accommodationType = DEFAULT_ACCOMMODATION_TYPE) => {
  const rooms = await getAvailableRoomsForDates(category, checkIn, checkOut, accommodationType);
  return rooms.length >= requiredCount;
};

const syncRoomStatus = async (roomId) => {
  const room = await Room.findById(roomId);
  if (!room || room.status === "maintenance") return room;
  const activeBooking = await Booking.exists({ status: { $in: ACTIVE_BOOKING_STATUSES }, $or: [{ room: roomId, occupants: { $size: 0 } }, { "occupants": { $elemMatch: { room: roomId, status: { $ne: "checked-out" } } } }] });
  room.status = activeBooking ? "booked" : "available";
  await room.save();
  return room;
};

// Step 1: Client selects category + dates, pays the full monthly amount via Stripe.
exports.createBooking = async (req, res) => {
  const { category, checkIn, checkOut, accommodationType = DEFAULT_ACCOMMODATION_TYPE } = req.body;
  const requestedOccupants = Math.min(20, Math.max(1, Number(req.body.numberOfOccupants || 1)));
  const occupantNames = Array.isArray(req.body.occupantNames) ? req.body.occupantNames.slice(0, requestedOccupants).map((n, i) => String(n || `Occupant ${i + 1}`).trim() || `Occupant ${i + 1}`) : [];
  try {
    if (req.user.role !== "client") {
      return res.status(403).json({ message: "Only client accounts can make room bookings." });
    }
    if (!checkIn || !checkOut) {
      return res.status(400).json({ message: "Check-in and check-out are required" });
    }
    if (!ACCOMMODATION_TYPES[accommodationType]) return res.status(400).json({ message: "Invalid accommodation location" });
    const effectiveCategory = category || "Standard";
    const monthlyRate = await getBaseRate(effectiveCategory, accommodationType);
    if (!monthlyRate) return res.status(400).json({ message: `No ${effectiveCategory} rooms with a price are configured for this location yet. Please choose another category or contact the admin.` });

    const dateValidation = validateBookingDates(checkIn, checkOut);
    if (dateValidation.error) return res.status(400).json({ message: dateValidation.error });
    const { checkInDate, checkOutDate } = dateValidation;

    const availableRooms = await getAvailableRoomsForDates(effectiveCategory, checkInDate, checkOutDate, accommodationType);
    if (availableRooms.length < requestedOccupants) {
      const locationLabel = getAccommodationConfig(accommodationType).label;
      return res.status(409).json({
        message: availableRooms.length
          ? `Only ${availableRooms.length} room(s) are available in ${locationLabel} for these dates, but ${requestedOccupants} occupant(s) were requested.`
          : `No ${category} rooms are configured or available in ${locationLabel} for these dates. Please choose another accommodation or contact the admin.`
      });
    }

    const config = getAccommodationConfig(accommodationType);
    const billingPeriod = config.billingPeriod;
    const billingMonths = billingPeriod === "month" ? calculateBillingMonths(checkInDate, checkOutDate) : 0;
    const stayDays = calculateStayDays(checkInDate, checkOutDate);
    const totalPrice = billingPeriod === "night" ? monthlyRate * stayDays * requestedOccupants : monthlyRate * billingMonths * requestedOccupants;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [{
        price_data: {
          currency: "rwf",
          product_data: {
            name: `${effectiveCategory} Room - ${config.label}`,
            description: `${config.label} | ${effectiveCategory} | ${requestedOccupants} occupant(s) | ${billingPeriod === "night" ? `${stayDays} night(s)` : `${billingMonths} month${billingMonths !== 1 ? "s" : ""}`} | Rooms assigned by admin after payment`,
          },
          unit_amount: totalPrice,
        },
        quantity: 1,
      }],
      mode: "payment",
      success_url: `${process.env.CLIENT_URL}/booking-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.CLIENT_URL}/rooms`,
      metadata: {
        category: effectiveCategory,
        accommodationType,
        billingPeriod,
        clientId: req.user._id.toString(),
        checkIn,
        checkOut,
        billingMonths: billingMonths.toString(),
        monthlyRate: monthlyRate.toString(),
        totalPrice: totalPrice.toString(),
        numberOfOccupants: requestedOccupants.toString(),
        occupantNames: JSON.stringify(occupantNames),
      },
    });

    res.json({ sessionUrl: session.url, sessionId: session.id });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Step 2: After Stripe redirects to success page, confirm and fetch the booking.
exports.confirmBooking = async (req, res) => {
  const { sessionId } = req.body;
  try {
    if (req.user.role !== "client") {
      return res.status(403).json({ message: "Only client accounts can confirm bookings." });
    }
    if (!sessionId || typeof sessionId !== "string") return res.status(400).json({ message: "A valid Stripe session ID is required" });

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== "paid") return res.status(400).json({ message: "Payment not completed" });

    const { category, accommodationType = DEFAULT_ACCOMMODATION_TYPE, billingPeriod, clientId, checkIn, checkOut, billingMonths, stayDays, monthlyRate, totalPrice, numberOfOccupants, occupantNames: occupantNamesRaw } = session.metadata || {};
    if (!clientId || clientId !== req.user._id.toString()) {
      return res.status(403).json({ message: "You are not authorized to confirm this booking" });
    }

    const existing = await Booking.findOne({ stripeSessionId: sessionId }).populate("room");
    if (existing) {
      if (existing.client.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: "You are not authorized to access this booking" });
      }
      return res.json(existing);
    }

    const receivedRateForCheck = Number(monthlyRate) || 0;
    if (!receivedRateForCheck || !checkIn || !checkOut || !totalPrice) {
      return res.status(400).json({ message: "Stripe booking metadata is incomplete" });
    }
    const dateValidation = validateBookingDates(checkIn, checkOut);
    if (dateValidation.error) return res.status(400).json({ message: dateValidation.error });
    const expectedPeriod = getAccommodationConfig(accommodationType).billingPeriod;
    const expectedMonths = expectedPeriod === "month" ? calculateBillingMonths(checkIn, checkOut) : 0;
    const expectedRate = receivedRateForCheck;
    const receivedMonths = Number(billingMonths);
    const receivedRate = Number(monthlyRate);
    const receivedTotal = Number(totalPrice);
    const occupantCount = Math.min(20, Math.max(1, Number(numberOfOccupants || 1)));
    const expectedDays = calculateStayDays(checkIn, checkOut);
    const expectedTotal = expectedPeriod === "night" ? expectedRate * expectedDays * occupantCount : expectedRate * expectedMonths * occupantCount;
    if (receivedMonths !== expectedMonths || receivedRate !== expectedRate || billingPeriod !== expectedPeriod || receivedTotal !== expectedTotal || session.amount_total !== expectedTotal || session.currency !== "rwf") {
      return res.status(400).json({ message: "Invalid booking payment details." });
    }

    const booking = await Booking.create({
      client: clientId,
      category,
      accommodationType,
      billingPeriod: billingPeriod || expectedPeriod,
      checkIn,
      checkOut,
      billingMonths: Number(billingMonths) || (expectedPeriod === "month" ? calculateBillingMonths(checkIn, checkOut) : 0),
      billingNights: expectedPeriod === "night" ? expectedDays : 0,
      monthlyRate: Number(monthlyRate) || expectedRate,
      totalPrice: Number(totalPrice),
      status: "pending",
      paymentStatus: "paid",
      stripePaymentId: session.payment_intent,
      stripeSessionId: sessionId,
      paymentTransactions: [{ paymentIntentId: session.payment_intent, amount: Number(totalPrice), refundedAmount: 0 }],
      numberOfOccupants: occupantCount,
      occupants: Array.from({ length: occupantCount }, (_, i) => ({ name: (() => { try { const a = JSON.parse(occupantNamesRaw || "[]"); return String(a[i] || `Occupant ${i + 1}`); } catch { return `Occupant ${i + 1}`; } })(), plannedCheckIn: checkIn, plannedCheckOut: checkOut })),
    });

    res.status(201).json(await booking.populate("room"));
  } catch (err) {
    if (err.code === 11000) {
      const existing = await Booking.findOne({ stripeSessionId: sessionId }).populate("room");
      if (existing && existing.client.toString() === req.user._id.toString()) return res.json(existing);
    }
    res.status(500).json({ message: err.message });
  }
};

// Stripe webhook — primary booking creation path
exports.handleStripeWebhook = async (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;
  try {
    const payload = req.body;
    event = stripe.webhooks.constructEvent(payload, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    if (session.payment_status === "paid") {
      const metadata = session.metadata || {};

      // Booking date-extension payments are finalized by the webhook so the
      // booking is updated even if the client closes the payment-success page.
      if (metadata.type === "booking_update") {
        try {
          const booking = await Booking.findById(metadata.bookingId);
          const checkIn = new Date(metadata.checkIn);
          const checkOut = new Date(metadata.checkOut);
          const newTotal = Number(metadata.newTotal);
          const additionalAmount = Number(metadata.additionalAmount);
          const alreadyApplied = booking && Array.isArray(booking.paymentTransactions) && booking.paymentTransactions.some((tx) => tx.paymentIntentId === session.payment_intent);
          if (booking && !alreadyApplied && booking.status === "pending" && !booking.room && booking.client.toString() === String(metadata.clientId) && Number.isFinite(newTotal) && Number.isFinite(additionalAmount) && additionalAmount > 0 && session.amount_total === additionalAmount && session.currency === "rwf") {
            const billingPeriod = booking.billingPeriod || getAccommodationConfig(booking.accommodationType).billingPeriod;
            const expectedTotal = calculateProratedStayPrice(checkIn, checkOut, booking.monthlyRate, billingPeriod);
            if (expectedTotal === newTotal && newTotal - Number(booking.totalPrice) === additionalAmount && (await hasAvailableRoom(booking.category, checkIn, checkOut, Number(booking.numberOfOccupants || booking.occupants?.length || 1), booking.accommodationType))) {
              booking.checkIn = checkIn;
              booking.checkOut = checkOut;
              booking.billingMonths = calculateBillingMonths(checkIn, checkOut);
              booking.totalPrice = newTotal;
              booking.paymentStatus = "paid";
              booking.paymentTransactions = Array.isArray(booking.paymentTransactions) ? booking.paymentTransactions : [];
              booking.paymentTransactions.push({ paymentIntentId: session.payment_intent, amount: additionalAmount, refundedAmount: 0 });
              booking.financialAdjustments.push({ type: "date-extension", amount: additionalAmount, reason: "Additional payment received for extended stay.", processedAutomatically: true });
              await booking.save();
            }
          }
        } catch (updateErr) {
          console.error("Booking update webhook error:", updateErr.message);
        }
        return res.json({ received: true });
      }

      const { category, accommodationType = DEFAULT_ACCOMMODATION_TYPE, billingPeriod, clientId, checkIn, checkOut, billingMonths, monthlyRate, totalPrice, numberOfOccupants, occupantNames: occupantNamesRaw } = metadata;
      const dateValidation = validateDateRange(checkIn, checkOut);
      const expectedPeriod = getAccommodationConfig(accommodationType).billingPeriod;
       const expectedMonths = !dateValidation.error && expectedPeriod === "month" ? calculateBillingMonths(checkIn, checkOut) : 0;
      const occupantCount = Math.min(20, Math.max(1, Number(numberOfOccupants || 1)));
      const expectedRate = Number(monthlyRate) || 0;
      const expectedDays = calculateStayDays(checkIn, checkOut);
      const expectedTotal = expectedPeriod === "night" ? expectedRate * expectedDays * occupantCount : expectedRate * expectedMonths * occupantCount;
      const validPaymentMetadata = expectedRate && Number(billingMonths) === expectedMonths && Number(monthlyRate) === expectedRate && billingPeriod === expectedPeriod && Number(totalPrice) === expectedTotal && session.amount_total === expectedTotal && session.currency === "rwf";
      if (clientId && validPaymentMetadata) {
        try {
          const existing = await Booking.findOne({ stripeSessionId: session.id });
          if (!existing) {
            await Booking.create({
              client: clientId,
              category,
              accommodationType,
              billingPeriod: billingPeriod || expectedPeriod,
              checkIn,
              checkOut,
              billingMonths: Number(billingMonths) || (expectedPeriod === "month" ? calculateBillingMonths(checkIn, checkOut) : 0),
              billingNights: expectedPeriod === "night" ? expectedDays : 0,
              monthlyRate: Number(monthlyRate) || expectedRate,
              totalPrice: Number(totalPrice),
              status: "pending",
              paymentStatus: "paid",
              stripePaymentId: session.payment_intent,
              stripeSessionId: session.id,
              paymentTransactions: [{ paymentIntentId: session.payment_intent, amount: Number(totalPrice), refundedAmount: 0 }],
              numberOfOccupants: occupantCount,
              occupants: Array.from({ length: occupantCount }, (_, i) => ({ name: (() => { try { const a = JSON.parse(occupantNamesRaw || "[]"); return String(a[i] || `Occupant ${i + 1}`); } catch { return `Occupant ${i + 1}`; } })(), plannedCheckIn: checkIn, plannedCheckOut: checkOut })),
            });
          }
        } catch (dbErr) {
          // Stripe may deliver the same event more than once. The unique
          // stripeSessionId index makes duplicate delivery harmless.
          if (dbErr.code !== 11000) console.error("Webhook DB error:", dbErr.message);
        }
      }
    }
  }

  res.json({ received: true });
};

// Admin changes the room assigned to an already-confirmed booking.
exports.reallocateRoom = async (req, res) => {
  const { id } = req.params;
  const { roomId } = req.body;
  try {
    const booking = await Booking.findById(id).populate("room");
    if (!booking) return res.status(404).json({ message: "Booking not found." });
    if (!["confirmed", "checked-in"].includes(booking.status))
      return res.status(400).json({ message: "Room can only be changed for confirmed or checked-in bookings." });
    if (!roomId) return res.status(400).json({ message: "New room ID is required." });
    if (String(booking.room?._id || booking.room) === String(roomId))
      return res.status(400).json({ message: "The booking is already assigned to this room." });

    const newRoom = await Room.findOneAndUpdate(
      { _id: roomId, category: booking.category, accommodationType: booking.accommodationType, status: "available" },
      { $set: { status: "booked" } },
      { new: true }
    );
    if (!newRoom) return res.status(409).json({ message: "The selected room is not available (wrong category, location, or already booked)." });

    const oldRoomId = booking.room?._id || booking.room;
    booking.room = newRoom._id;
    if (booking.occupants?.length === 1) booking.occupants[0].room = newRoom._id;
    await booking.save();
    if (oldRoomId) await syncRoomStatus(oldRoomId);
    res.json(await booking.populate(["room", "occupants.room"]));
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// Step 3: Admin picks an available room and allocates it to the booking (confirms it).
exports.allocateAndConfirm = async (req, res) => {
  const { id } = req.params;
  const roomIds = Array.isArray(req.body.roomIds) ? req.body.roomIds : (req.body.roomId ? [req.body.roomId] : []);
  try {
    const booking = await Booking.findById(id);
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    if (booking.status !== "pending") return res.status(400).json({ message: "Only pending bookings can be allocated rooms" });
    const count = Math.max(1, Number(booking.numberOfOccupants || booking.occupants?.length || 1));
    if (roomIds.length !== count) return res.status(400).json({ message: `Select exactly ${count} room(s) for this booking.` });
    if (new Set(roomIds.map(String)).size !== roomIds.length) return res.status(400).json({ message: "Each occupant must have a different room." });

    const availableRooms = await getAvailableRoomsForDates(booking.category, booking.checkIn, booking.checkOut, booking.accommodationType);
    const availableSet = new Set(availableRooms.map(r => r._id.toString()));
    if (roomIds.some(id => !availableSet.has(String(id)))) return res.status(409).json({ message: "One or more selected rooms are unavailable for these dates." });

    const claimed = [];
    for (const roomId of roomIds) {
      // The update itself is the final availability check. If another admin
      // claims the same room between the GET and this request, only one
      // request can change status from available -> booked.
      const room = await Room.findOneAndUpdate({
        _id: roomId,
        category: booking.category,
        accommodationType: booking.accommodationType || DEFAULT_ACCOMMODATION_TYPE,
        status: "available",
      }, { $set: { status: "booked" } }, { new: true });
      if (!room) {
        for (const r of claimed) await syncRoomStatus(r._id);
        return res.status(409).json({ message: "A selected room was just assigned to another booking. Please refresh the available rooms and try again." });
      }
      claimed.push(room);
    }

    if (!Array.isArray(booking.occupants) || booking.occupants.length !== count) {
      booking.occupants = Array.from({ length: count }, (_, i) => ({ name: `Occupant ${i + 1}`, plannedCheckIn: booking.checkIn, plannedCheckOut: booking.checkOut }));
    }
    booking.occupants.forEach((o, i) => {
      o.room = claimed[i]._id;
      o.plannedCheckIn = booking.checkIn;
      o.plannedCheckOut = booking.checkOut;
      o.status = "confirmed";
    });
    booking.room = claimed[0]._id;
    booking.status = "confirmed";
    await booking.save();
    res.json(await booking.populate(["room", "occupants.room"]));
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.getBookingPolicy = async (req, res) => {
  res.json({
    cancellationDeadlineDays: CANCELLATION_DEADLINE_DAYS,
    cancellationRule: `Client cancellation is allowed until ${CANCELLATION_DEADLINE_DAYS} day${CANCELLATION_DEADLINE_DAYS === 1 ? "" : "s"} before check-in.`,
    editRule: EDIT_DEADLINE_HOURS > 0 ? `Pending bookings can be edited until ${EDIT_DEADLINE_HOURS} hour${EDIT_DEADLINE_HOURS === 1 ? "" : "s"} before check-in, provided no room has been allocated.` : "Pending bookings can be edited before a room is allocated.",
    refundRule: `For a pending booking reduction or an early admin-recorded checkout, unused paid time is refunded using the accommodation tariff: monthly stays use monthly rate / ${REFUND_DAILY_DIVISOR} per day, while ILPD Building stays use the full nightly rate per unused night. Each occupant is calculated separately, so one client can pay for several people in one booking and each person can check out on a different day with their own unused-day refund. Refunds are automatic when Stripe can process them; otherwise they are marked refund_pending for admin/manual processing.`,
    checkoutRule: "Check-in and checkout are recorded by the admin. Clients do not need to submit check-in or checkout requests.",
    paymentGateway: "Stripe (temporary testing gateway; IremboPay can replace it once official credentials are available).",
  });
};

exports.cancelMyBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id).populate("room");
    if (!booking) return res.status(404).json({ message: "Booking not found." });
    if (booking.client.toString() !== req.user._id.toString()) return res.status(403).json({ message: "You can only cancel your own booking." });

    const policy = canClientCancelBooking(booking);
    if (!policy.allowed) {
      return res.status(400).json({ message: policy.error, deadline: policy.deadline });
    }

    const refundAmount = booking.paymentStatus === "paid" ? calculateRefund(booking) : 0;
    const refundResult = await processRefund(booking, refundAmount, "Booking cancelled by client.");
    if (refundAmount > 0) booking.financialAdjustments.push({ type: "cancellation", amount: refundAmount, reason: "Booking cancelled by client.", processedAutomatically: refundResult.automatic });
    booking.status = "cancelled";
    await booking.save();
    await syncBookingRooms(booking);

    res.json({ message: refundResult.message || "Booking cancelled successfully.", booking, refundAmount, deadline: policy.deadline });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updatePendingBooking = async (req, res) => {
  const { id } = req.params;
  const { checkIn, checkOut } = req.body;
  try {
    const booking = await Booking.findById(id);
    if (!booking) return res.status(404).json({ message: "Booking not found." });
    if (booking.client.toString() !== req.user._id.toString()) return res.status(403).json({ message: "You can only edit your own booking." });

    const permission = canClientEditPendingBooking(booking);
    if (!permission.allowed) return res.status(400).json({ message: permission.error });
    if (!checkIn || !checkOut) return res.status(400).json({ message: "Check-in and check-out dates are required." });

    const validation = validateBookingDates(checkIn, checkOut);
    if (validation.error) return res.status(400).json({ message: validation.error });
    const { checkInDate, checkOutDate } = validation;

    const occupantCount = Math.max(1, Number(booking.numberOfOccupants || booking.occupants?.length || 1));
    const available = await getAvailableRoomsForDates(booking.category, checkInDate, checkOutDate, booking.accommodationType);
    if (available.length < occupantCount) return res.status(409).json({ message: `Only ${available.length} ${booking.category} room(s) are available for the new dates, but this booking needs ${occupantCount}.` });

    const oldTotal = Number(booking.totalPrice || 0);
    const accommodationConfig = getAccommodationConfig(booking.accommodationType);
    const billingPeriod = booking.billingPeriod || accommodationConfig.billingPeriod;
    const baseRate = Number(booking.monthlyRate || 0);
    const newTotal = calculateProratedStayPrice(checkInDate, checkOutDate, baseRate, billingPeriod) * occupantCount;
    const oldDays = calculateStayDays(booking.checkIn, booking.checkOut);
    const newDays = calculateStayDays(checkInDate, checkOutDate);
    const difference = newTotal - oldTotal;

    if (difference < 0) {
      const refundAmount = Math.abs(difference);
      const oldCheckIn = new Date(booking.checkIn).toDateString();
      const oldCheckOut = new Date(booking.checkOut).toDateString();
      const refundResult = await processRefund(booking, refundAmount, "Booking dates reduced before room allocation.");
      booking.checkIn = checkInDate;
      booking.checkOut = checkOutDate;
      booking.billingMonths = billingPeriod === "month" ? calculateBillingMonths(checkInDate, checkOutDate) : 0;
      booking.billingNights = billingPeriod === "night" ? calculateStayDays(checkInDate, checkOutDate) : 0;
      booking.totalPrice = newTotal;
      booking.occupants?.forEach((o) => { o.plannedCheckIn = checkInDate; o.plannedCheckOut = checkOutDate; });
      booking.financialAdjustments.push({
        type: "date-reduction",
        amount: refundAmount,
        reason: `Stay reduced from ${oldCheckIn}–${oldCheckOut} to ${checkInDate.toDateString()}–${checkOutDate.toDateString()}.`,
        processedAutomatically: refundResult.automatic,
      });
      await booking.save();
      return res.json({
        booking,
        action: "updated_and_refunded",
        refundAmount,
        message: refundResult.message,
        policy: billingPeriod === "night" ? `Reduced nights are refunded at ${baseRate.toLocaleString()} RWF per unused night.` : `Reduced days are refunded at the pro-rata daily rate of ${Math.round(baseRate / REFUND_DAILY_DIVISOR).toLocaleString()} RWF per day.`,
        oldDays,
        newDays,
      });
    }

    if (difference > 0) {
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [{
          price_data: {
            currency: "rwf",
            product_data: { name: `Booking extension - ${booking.category} Room`, description: `Additional stay payment for booking ${booking._id}` },
            unit_amount: difference,
          },
          quantity: 1,
        }],
        mode: "payment",
        success_url: `${process.env.CLIENT_URL}/my-bookings?booking_update_session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.CLIENT_URL}/my-bookings`,
        metadata: {
          type: "booking_update",
          bookingId: booking._id.toString(),
          clientId: req.user._id.toString(),
          checkIn: checkInDate.toISOString(),
          checkOut: checkOutDate.toISOString(),
          newTotal: newTotal.toString(),
          additionalAmount: difference.toString(),
        },
      });
      return res.json({
        action: "payment_required",
        sessionUrl: session.url,
        sessionId: session.id,
        additionalAmount: difference,
        message: `Your new dates require an additional payment of ${difference.toLocaleString()} RWF.`,
      });
    }

    booking.checkIn = checkInDate;
    booking.checkOut = checkOutDate;
    booking.billingMonths = billingPeriod === "month" ? calculateBillingMonths(checkInDate, checkOutDate) : 0;
    booking.occupants?.forEach((o) => { o.plannedCheckIn = checkInDate; o.plannedCheckOut = checkOutDate; });
    await booking.save();
    res.json({ booking, action: "updated", refundAmount: 0, message: "Booking dates updated successfully." });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Lets a client extend or reduce their stay AFTER a room has been allocated
// (confirmed or checked-in bookings) — same refund/extra-payment mechanics
// as updatePendingBooking, but checking the SPECIFIC allocated room's
// availability rather than searching the whole category, and only the
// check-out date can move (check-in is already locked in once a room is
// assigned).
exports.extendOrReduceStay = async (req, res) => {
  const { id } = req.params;
  const { checkOut } = req.body;
  try {
    const booking = await Booking.findById(id).populate("room");
    if (!booking) return res.status(404).json({ message: "Booking not found." });
    if (booking.client.toString() !== req.user._id.toString()) return res.status(403).json({ message: "You can only edit your own booking." });
    if (!["confirmed", "checked-in"].includes(booking.status)) {
      return res.status(400).json({ message: "You can only change dates for a confirmed or currently active booking." });
    }
    if (!booking.room) return res.status(400).json({ message: "This booking has no room allocated yet — use the pending booking edit option instead." });
    if (!checkOut) return res.status(400).json({ message: "A new check-out date is required." });

    const newCheckOut = new Date(`${checkOut}T00:00:00Z`);
    if (Number.isNaN(newCheckOut.getTime())) return res.status(400).json({ message: "Invalid check-out date." });
    const referenceStart = booking.status === "checked-in" ? new Date() : new Date(booking.checkIn);
    if (newCheckOut <= referenceStart) return res.status(400).json({ message: "Check-out must be after check-in (and after today, since you're already checked in)." });

    // Make sure nobody else is booked into this same room during the extended window.
    const overlap = await Booking.findOne({
      _id: { $ne: booking._id },
      room: booking.room._id,
      status: { $in: ACTIVE_BOOKING_STATUSES },
      checkIn: { $lt: newCheckOut },
      checkOut: { $gt: booking.checkIn },
    });
    if (overlap) return res.status(409).json({ message: "This room is already booked by another guest during part of that new date range." });

    const oldTotal = Number(booking.totalPrice || 0);
    const accommodationConfig = getAccommodationConfig(booking.accommodationType);
    const billingPeriod = booking.billingPeriod || accommodationConfig.billingPeriod;
    const occupantCount = Math.max(1, Number(booking.numberOfOccupants || booking.occupants?.length || 1));
    const baseRate = Number(booking.monthlyRate || 0);
    const newTotal = calculateProratedStayPrice(booking.checkIn, newCheckOut, baseRate, billingPeriod) * occupantCount;
    const difference = newTotal - oldTotal;
    const oldCheckOut = new Date(booking.checkOut).toDateString();

    if (difference < 0) {
      const refundAmount = Math.abs(difference);
      const refundResult = await processRefund(booking, refundAmount, "Stay shortened after room allocation.");
      booking.checkOut = newCheckOut;
      booking.billingMonths = billingPeriod === "month" ? calculateBillingMonths(booking.checkIn, newCheckOut) : 0;
      booking.billingNights = billingPeriod === "night" ? calculateStayDays(booking.checkIn, newCheckOut) : 0;
      booking.totalPrice = newTotal;
      booking.occupants?.forEach((o) => { o.plannedCheckOut = newCheckOut; });
      booking.financialAdjustments.push({
        type: "date-reduction",
        amount: refundAmount,
        reason: `Check-out moved from ${oldCheckOut} to ${newCheckOut.toDateString()}.`,
        processedAutomatically: refundResult.automatic,
      });
      await booking.save();
      return res.json({ booking, action: "updated_and_refunded", refundAmount, message: refundResult.message });
    }

    if (difference > 0) {
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [{
          price_data: {
            currency: "rwf",
            product_data: { name: `Stay extension - Room ${booking.room.roomNumber}`, description: `Additional stay payment for booking ${booking._id}` },
            unit_amount: difference,
          },
          quantity: 1,
        }],
        mode: "payment",
        success_url: `${process.env.CLIENT_URL}/my-bookings?booking_update_session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.CLIENT_URL}/my-bookings`,
        metadata: {
          type: "booking_update",
          bookingId: booking._id.toString(),
          clientId: req.user._id.toString(),
          checkIn: booking.checkIn.toISOString(),
          checkOut: newCheckOut.toISOString(),
          newTotal: newTotal.toString(),
          additionalAmount: difference.toString(),
        },
      });
      return res.json({
        action: "payment_required",
        sessionUrl: session.url,
        sessionId: session.id,
        additionalAmount: difference,
        message: `Extending your stay requires an additional payment of ${difference.toLocaleString()} RWF.`,
      });
    }

    booking.checkOut = newCheckOut;
    booking.billingMonths = billingPeriod === "month" ? calculateBillingMonths(booking.checkIn, newCheckOut) : 0;
    booking.occupants?.forEach((o) => { o.plannedCheckOut = newCheckOut; });
    await booking.save();
    res.json({ booking, action: "updated", refundAmount: 0, message: "Check-out date updated successfully." });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.confirmBookingUpdate = async (req, res) => {
  const { sessionId } = req.body;
  try {
    if (req.user.role !== "client") return res.status(403).json({ message: "Only client accounts can confirm booking updates." });
    if (!sessionId || typeof sessionId !== "string") return res.status(400).json({ message: "A valid Stripe session ID is required." });
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== "paid") return res.status(400).json({ message: "Additional payment has not been completed." });
    const metadata = session.metadata || {};
    if (metadata.type !== "booking_update" || metadata.clientId !== req.user._id.toString()) return res.status(403).json({ message: "You are not authorized to confirm this booking update." });

    const booking = await Booking.findById(metadata.bookingId);
    if (!booking) return res.status(404).json({ message: "Booking not found." });
    if (booking.client.toString() !== req.user._id.toString()) return res.status(403).json({ message: "You are not authorized to update this booking." });
    const alreadyApplied = Array.isArray(booking.paymentTransactions) && booking.paymentTransactions.some((tx) => tx.paymentIntentId === session.payment_intent);
    if (alreadyApplied) return res.json({ booking, message: "Booking update was already applied." });
    const hasRoom = !!booking.room;
    if (!hasRoom) {
      const permission = canClientEditPendingBooking(booking);
      if (!permission.allowed) return res.status(400).json({ message: permission.error });
    } else if (!["confirmed", "checked-in"].includes(booking.status)) {
      return res.status(400).json({ message: "This booking can no longer be updated." });
    }

    const checkIn = new Date(metadata.checkIn);
    const checkOut = new Date(metadata.checkOut);
    const newTotal = Number(metadata.newTotal);
    const additionalAmount = Number(metadata.additionalAmount);
    if (!Number.isFinite(newTotal) || !Number.isFinite(additionalAmount) || additionalAmount <= 0 || session.amount_total !== additionalAmount || session.currency !== "rwf") {
      return res.status(400).json({ message: "Invalid booking update payment details." });
    }
    if (newTotal - booking.totalPrice !== additionalAmount) return res.status(400).json({ message: "The additional payment does not match the requested booking change." });

    if (!hasRoom) {
      if (!(await hasAvailableRoom(booking.category, checkIn, checkOut, Number(booking.numberOfOccupants || booking.occupants?.length || 1), booking.accommodationType))) return res.status(409).json({ message: "There are not enough rooms available for all people in this booking for the new dates." });
    } else {
      const overlap = await Booking.findOne({
        _id: { $ne: booking._id },
        room: booking.room,
        status: { $in: ACTIVE_BOOKING_STATUSES },
        checkIn: { $lt: checkOut },
        checkOut: { $gt: booking.checkIn },
      });
      if (overlap) return res.status(409).json({ message: "This room was booked by someone else before your payment completed. Please contact support — your payment will be refunded." });
    }

    booking.checkIn = checkIn;
    booking.checkOut = checkOut;
    const updateBillingPeriod = booking.billingPeriod || getAccommodationConfig(booking.accommodationType).billingPeriod;
    booking.billingMonths = updateBillingPeriod === "month" ? calculateBillingMonths(checkIn, checkOut) : 0;
    booking.billingNights = updateBillingPeriod === "night" ? calculateStayDays(checkIn, checkOut) : 0;
    booking.totalPrice = newTotal;
    booking.occupants?.forEach((o) => { o.plannedCheckIn = checkIn; o.plannedCheckOut = checkOut; });
    booking.paymentStatus = "paid";
    booking.paymentTransactions = Array.isArray(booking.paymentTransactions) ? booking.paymentTransactions : [];
    booking.paymentTransactions.push({ paymentIntentId: session.payment_intent, amount: additionalAmount, refundedAmount: 0 });
    booking.financialAdjustments.push({ type: "date-extension", amount: additionalAmount, reason: "Additional payment received for extended stay.", processedAutomatically: true });
    await booking.save();
    res.json({ booking, message: `Booking updated. Additional payment of ${additionalAmount.toLocaleString()} RWF received.` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateRoomVisit = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, scheduledAt, notes = "" } = req.body;
    const booking = await Booking.findById(id).populate("room");
    if (!booking) return res.status(404).json({ message: "Booking not found." });
    if (!booking.room) return res.status(400).json({ message: "Allocate a room before arranging a physical room visit." });
    if (!["scheduled", "completed", "declined"].includes(action)) return res.status(400).json({ message: "Action must be scheduled, completed or declined." });
    if (!["confirmed", "check-in-requested", "checked-in"].includes(booking.status)) return res.status(400).json({ message: "A physical room visit can only be arranged for an allocated booking." });

    if (action === "scheduled") {
      if (!["confirmed", "check-in-requested"].includes(booking.status)) return res.status(400).json({ message: "A new physical room visit should be arranged before check-in." });
      if (!scheduledAt) return res.status(400).json({ message: "A visit date and time are required when arranging a room visit." });
      const visitDate = new Date(scheduledAt);
      if (Number.isNaN(visitDate.getTime())) return res.status(400).json({ message: "Invalid room visit date and time." });
      if (visitDate < new Date() || visitDate > new Date(booking.checkIn)) return res.status(400).json({ message: "The physical room visit must be scheduled between now and the check-in date." });
      booking.roomVisit.status = "scheduled";
      booking.roomVisit.scheduledAt = visitDate;
      booking.roomVisit.completedAt = null;
    } else if (action === "completed") {
      booking.roomVisit.status = "completed";
      booking.roomVisit.completedAt = new Date();
      if (!booking.roomVisit.scheduledAt) booking.roomVisit.scheduledAt = new Date();
    } else {
      booking.roomVisit.status = "declined";
      booking.roomVisit.completedAt = null;
    }
    booking.roomVisit.notes = String(notes).trim();
    booking.roomVisit.recordedBy = req.user._id;
    await booking.save();
    res.json({ message: action === "scheduled" ? "Physical room visit arranged." : action === "completed" ? "Physical room visit recorded." : "Physical room visit marked as declined.", booking });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.requestCheckin = async (req, res) => {
  const { id } = req.params;
  try {
    const booking = await Booking.findById(id).populate("room");
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    if (booking.client.toString() !== req.user._id.toString()) return res.status(403).json({ message: "Not authorized" });
    if (booking.status !== "confirmed") return res.status(400).json({ message: "Check-in can only be requested for confirmed bookings." });
    if (!booking.room) return res.status(400).json({ message: "A room must be allocated before check-in." });
    if (new Date() < new Date(booking.checkIn)) return res.status(400).json({ message: "Check-in can only be requested on or after the check-in date." });
    if (new Date() >= new Date(booking.checkOut)) return res.status(400).json({ message: "This booking has already reached its check-out date." });

    booking.status = "check-in-requested";
    await booking.save();
    res.json({ message: "Check-in requested. Admin will record your arrival.", booking });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.requestCheckout = async (req, res) => {
  const { id } = req.params;
  try {
    const booking = await Booking.findById(id).populate("room");
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    if (booking.client.toString() !== req.user._id.toString()) return res.status(403).json({ message: "Not authorized" });
    if (booking.status !== "checked-in") return res.status(400).json({ message: "Checkout can only be requested for active bookings." });
    if (!booking.room) return res.status(400).json({ message: "A room must be allocated before checkout." });
    if (new Date() < new Date(booking.checkIn)) return res.status(400).json({ message: "Checkout cannot be requested before check-in." });

    booking.status = "check-out-requested";
    await booking.save();
    res.json({ message: "Checkout requested. Admin will confirm your departure.", booking });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.respondCheckinRequest = async (req, res) => {
  const { id } = req.params;
  const { accepted } = req.body;
  try {
    const booking = await Booking.findById(id).populate("room");
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    if (booking.status !== "check-in-requested") return res.status(400).json({ message: "No pending check-in request for this booking." });

    if (accepted) {
      if (!booking.room) return res.status(400).json({ message: "A room must be allocated before check-in." });
      if (!booking.category && booking.room.category) booking.category = booking.room.category;
      booking.status = "checked-in";
      await booking.save();
      res.json({ message: "Check-in recorded.", booking });
      return;
    }

    const refundAmount = booking.paymentStatus === "paid" ? calculateRefund(booking) : 0;
    const refundResult = await processRefund(booking, refundAmount, "Check-in rejected.");
    booking.status = "rejected";
    await booking.save();
    await syncBookingRooms(booking);

    res.json({ message: refundResult.message, booking, refundAmount, automaticRefund: refundResult.automatic });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.respondCheckoutRequest = async (req, res) => {
  const { id } = req.params;
  const { accepted } = req.body;
  try {
    const booking = await Booking.findById(id).populate("room");
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    if (booking.status !== "check-out-requested") return res.status(400).json({ message: "No pending checkout request for this booking." });

    if (accepted) {
      if (!booking.room) return res.status(400).json({ message: "A room must be allocated before checkout." });
      if (!booking.category && booking.room.category) booking.category = booking.room.category;
      const refundAmount = booking.paymentStatus === "paid" ? calculateRefund(booking) : 0;
      const refundResult = await processRefund(booking, refundAmount, "Checkout approved.");
      booking.status = "checked-out";
      await booking.save();
      await syncBookingRooms(booking);
      res.json({ message: refundResult.message || "Checkout recorded.", booking, refundAmount: refundAmount || 0 });
      return;
    }

    booking.status = "checked-in";
    await booking.save();
    res.json({ message: "Checkout request rejected. Stay remains active.", booking });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Admin cancel
exports.cancelBookingById = async (req, res) => {
  const { id } = req.params;
  try {
    const booking = await Booking.findById(id).populate("room");
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    if (req.user.role !== "admin") return res.status(403).json({ message: "Only admins can cancel this booking" });
    if (["cancelled", "checked-out", "rejected"].includes(booking.status)) return res.status(400).json({ message: "This booking can no longer be cancelled." });

    const refundAmount = booking.paymentStatus === "paid" ? calculateRefund(booking) : 0;
    const refundResult = await processRefund(booking, refundAmount, "Booking cancelled by admin.");
    booking.status = "cancelled";
    await booking.save();
    await syncBookingRooms(booking);
    res.json({ message: refundResult.message || "Booking cancelled.", refundAmount });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateBookingStatus = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id).populate("room").populate("client", "name email phone");
    if (!booking) return res.status(404).json({ message: "Booking not found" });

    const newStatus = req.body.status;
    const transitions = {
      pending: ["cancelled", "rejected"],
      confirmed: ["checked-in", "cancelled"],
      "check-in-requested": ["checked-in", "rejected"],
      "checked-in": ["checked-out", "cancelled"],
      "check-out-requested": ["checked-out", "checked-in"],
      "checked-out": [],
      cancelled: [],
      rejected: [],
    };

    if (!Object.prototype.hasOwnProperty.call(transitions, newStatus)) {
      return res.status(400).json({ message: "Invalid booking status" });
    }
    if (!transitions[booking.status].includes(newStatus)) {
      return res.status(400).json({ message: `Cannot change booking from ${booking.status} to ${newStatus}. Use the booking workflow controls.` });
    }

    if (newStatus === "checked-in" && !booking.room) {
      return res.status(400).json({ message: "A room must be allocated before check-in." });
    }
    if (newStatus === "checked-in" && new Date() < new Date(booking.checkIn)) {
      return res.status(400).json({ message: "Check-in cannot be recorded before the booking check-in date." });
    }
    if (newStatus === "checked-in") {
      booking.registration = normalizeRegistration(req.body.registration || {});
    }
    if (newStatus === "checked-out" && booking.status === "checked-in" && new Date() < new Date(booking.checkIn)) {
      return res.status(400).json({ message: "Checkout cannot be recorded before the booking check-in date." });
    }
    if (newStatus === "checked-out") {
      booking.registration = booking.registration || {};
      booking.registration.checkoutCompletedAt = new Date();
    }

    if (newStatus === "checked-out" && ["paid", "partially_refunded", "refund_pending"].includes(booking.paymentStatus)) {
      const refundAmount = calculateUnusedStayRefund(booking, new Date());
      const refundResult = await processRefund(booking, refundAmount, "Early checkout approved by admin.");
      if (refundAmount > 0) booking.financialAdjustments.push({ type: "early-checkout", amount: refundAmount, reason: "Unused days refunded after admin-recorded checkout.", processedAutomatically: refundResult.automatic });
    }

    if (["rejected", "cancelled"].includes(newStatus) && booking.paymentStatus === "paid") {
      const refundAmount = calculateRefund(booking);
      const refundResult = await processRefund(booking, refundAmount, `Booking ${newStatus} by admin.`);
      if (refundAmount > 0) booking.financialAdjustments.push({ type: "cancellation", amount: refundAmount, reason: `Booking ${newStatus} by admin.`, processedAutomatically: refundResult.automatic });
    }

    booking.status = newStatus;
    if (["checked-out", "cancelled", "rejected"].includes(newStatus)) {
      await syncBookingRooms(booking);
    }

    await booking.save();
    res.json(booking);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateOccupantStatus = async (req, res) => {
  const { id, occupantId } = req.params;
  const { status, registration: registrationInput } = req.body;
  try {
    if (!req.user || req.user.role !== "admin") return res.status(403).json({ message: "Admin access required." });
    if (!["checked-in", "checked-out"].includes(status)) return res.status(400).json({ message: "Status must be checked-in or checked-out." });

    const booking = await Booking.findById(id);
    if (!booking) return res.status(404).json({ message: "Booking not found." });
    if (!Array.isArray(booking.occupants) || !booking.occupants.length) {
      return res.status(400).json({ message: "This booking has no individual occupants. Use the booking-level Check In/Check Out action." });
    }

    const occupant = booking.occupants.id(occupantId);
    if (!occupant) return res.status(404).json({ message: "Occupant not found." });
    if (!occupant.room) return res.status(400).json({ message: "This occupant has no room assigned." });

    const now = new Date();
    if (status === "checked-in") {
      if (booking.status !== "confirmed") return res.status(400).json({ message: `This booking is ${booking.status}; only a confirmed booking can be checked in.` });
      const registration = normalizeRegistration(registrationInput || {});
      if (occupant.status !== "confirmed") return res.status(400).json({ message: `This occupant is already ${occupant.status}.` });
      if (now < new Date(occupant.plannedCheckIn || booking.checkIn)) {
        return res.status(400).json({ message: "Check-in cannot be recorded before the scheduled check-in date." });
      }
      occupant.registration = registration;
      occupant.actualCheckIn = now;
      occupant.status = "checked-in";
    } else {
      if (occupant.status !== "checked-in") return res.status(400).json({ message: "Only a checked-in occupant can be checked out." });

      occupant.actualCheckOut = now;
      occupant.registration = occupant.registration || {};
      occupant.registration.checkoutCompletedAt = now;
      const end = new Date(occupant.plannedCheckOut || booking.checkOut);
      const accommodationConfig = getAccommodationConfig(booking.accommodationType);
      const billingPeriod = booking.billingPeriod || accommodationConfig.billingPeriod;
      const baseRate = Number(booking.monthlyRate || 0);
      const unusedDays = Math.max(0, Math.ceil((end.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));
      const occupantCount = Math.max(1, Number(booking.numberOfOccupants || booking.occupants.length || 1));
      const occupantPaidAmount = Math.round(Number(booking.totalPrice || 0) / occupantCount);
      const unusedValue = billingPeriod === "night"
        ? unusedDays * baseRate
        : (unusedDays / REFUND_DAILY_DIVISOR) * baseRate;
      const refundAmount = now < end ? Math.min(occupantPaidAmount, Math.round(unusedValue)) : 0;
      const refundResult = await processRefund(booking, refundAmount, `Early checkout recorded for ${occupant.name || "occupant"}.`);

      occupant.refundAmount = refundAmount;
      occupant.status = "checked-out";
      booking.financialAdjustments.push({
        type: "early-checkout",
        amount: refundAmount,
        reason: `${occupant.name || "Occupant"} checked out early with ${unusedDays} unused day(s).`,
        processedAutomatically: refundResult.automatic,
      });

      const allOut = booking.occupants.every(o => o.status === "checked-out");
      if (allOut) booking.status = "checked-out";
    }

    const allIn = booking.occupants.every(o => ["checked-in", "checked-out"].includes(o.status));
    if (status === "checked-in" && allIn) booking.status = "checked-in";

    await booking.save();
    await syncRoomStatus(occupant.room);
    const populated = await booking.populate(["room", "occupants.room"]);
    const savedOccupant = populated.occupants.id(occupantId);
    res.json({ booking: populated, occupant: savedOccupant, refundAmount: savedOccupant?.refundAmount || 0 });
  } catch (err) {
    console.error("Occupant check-in/out error:", err);
    res.status(500).json({ message: err.message || "Unable to update occupant stay status." });
  }
};

exports.getMyBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({ client: req.user._id }).populate("room").populate("occupants.room").sort({ createdAt: -1 });
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Active bookings (pending/confirmed/checked-in) are naturally bounded - there
// can never be more of them than you have rooms - so they always load in
// full. Historical/closed bookings (checked-out/cancelled/rejected) only ever
// accumulate over the life of the hostel, so those are capped to the most
// recent batch. This means the dashboard stays fast and light years from now,
// no matter how much booking history has built up.
const HISTORY_FETCH_LIMIT = 300;

exports.getAllBookings = async (req, res) => {
  try {
    const populateOpts = (query) => query.populate("client", "name email phone").populate("room").populate("occupants.room");
    const [active, historical] = await Promise.all([
      populateOpts(Booking.find({ status: { $in: ["pending", "confirmed", "checked-in"] } })).sort({ createdAt: -1 }),
      populateOpts(Booking.find({ status: { $in: ["checked-out", "cancelled", "rejected"] } })).sort({ createdAt: -1 }).limit(HISTORY_FETCH_LIMIT),
    ]);
    res.json([...active, ...historical]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const DELETABLE_STATUSES = ["checked-out", "cancelled", "rejected"];

exports.deleteBookingHistory = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: "Booking not found" });

    const isOwner = booking.client.toString() === req.user._id.toString();
    const isAdmin = req.user.role === "admin";
    if (!isOwner && !isAdmin) return res.status(403).json({ message: "You can only delete your own bookings" });

    // Clients can only delete completed/cancelled/rejected bookings
    if (!isAdmin && !DELETABLE_STATUSES.includes(booking.status)) {
      return res.status(400).json({ message: "Only completed, cancelled or rejected bookings can be deleted." });
    }

    if (isAdmin && !DELETABLE_STATUSES.includes(booking.status)) {
      return res.status(400).json({ message: "Active bookings cannot be permanently deleted. Cancel or complete the booking first." });
    }

    await Booking.deleteOne({ _id: booking._id });
    res.json({ message: "Booking removed from history" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// A proper hospitality performance dashboard: occupancy rate, revenue by
// category and by location, average stay length, and booking-status
// breakdown for a chosen month (defaults to the current month).
exports.getMonthlyReport = async (req, res) => {
  try {
    const monthParam = req.query.month; // "YYYY-MM", optional
    const now = new Date();
    const year = monthParam ? Number(monthParam.split("-")[0]) : now.getFullYear();
    const monthIndex = monthParam ? Number(monthParam.split("-")[1]) - 1 : now.getMonth();
    const start = new Date(Date.UTC(year, monthIndex, 1));
    const end = new Date(Date.UTC(year, monthIndex + 1, 1));

    const bookings = await Booking.find({ createdAt: { $gte: start, $lt: end } }).populate("room").populate("client", "name email");

    const totalRevenue = bookings.reduce((sum, b) => {
      const paid = (b.paymentTransactions || []).reduce((n, tx) => n + Number(tx.amount || 0), 0);
      const refunded = (b.paymentTransactions || []).reduce((n, tx) => n + Number(tx.refundedAmount || 0), 0);
      const owed = Number(b.refundAmountOwed || 0);
      return sum + Math.max(0, paid - refunded - owed);
    }, 0);

    const revenueByCategory = {};
    const revenueByLocation = { ilpd_building: 0, outside_hostel: 0 };
    let totalStayDays = 0;
    let stayCount = 0;
    for (const b of bookings) {
      const paid = (b.paymentTransactions || []).reduce((n, tx) => n + Number(tx.amount || 0), 0);
      const refunded = (b.paymentTransactions || []).reduce((n, tx) => n + Number(tx.refundedAmount || 0), 0);
      const net = Math.max(0, paid - refunded - Number(b.refundAmountOwed || 0));
      const category = b.room?.category || b.category || "Unknown";
      revenueByCategory[category] = (revenueByCategory[category] || 0) + net;
      const location = b.room?.accommodationType || b.accommodationType || "outside_hostel";
      revenueByLocation[location] = (revenueByLocation[location] || 0) + net;
      if (b.checkIn && b.checkOut) {
        const days = Math.max(1, Math.round((new Date(b.checkOut) - new Date(b.checkIn)) / 86400000));
        totalStayDays += days;
        stayCount++;
      }
    }

    // Occupancy: how many rooms had at least one active-status booking
    // overlapping this month, versus the total number of rooms that exist.
    // Only counts rooms that still actually exist — a booking can reference
    // a room that was later deleted (e.g. after a room-inventory reset), and
    // that stale reference should never inflate today's occupancy figure.
    const totalRooms = await Room.countDocuments({});
    const referencedRoomIds = await Booking.distinct("room", {
      status: { $in: ["confirmed", "checked-in", "checked-out"] },
      checkIn: { $lt: end },
      checkOut: { $gt: start },
      room: { $ne: null },
    });
    const existingOccupiedRoomIds = referencedRoomIds.length
      ? await Room.find({ _id: { $in: referencedRoomIds } }).distinct("_id")
      : [];
    const occupancyRate = totalRooms > 0 ? Math.min(100, Math.round((existingOccupiedRoomIds.length / totalRooms) * 100)) : 0;

    const newConcerns = await Concern.countDocuments({ createdAt: { $gte: start, $lt: end } });
    const surveyDocs = await Survey.find({ createdAt: { $gte: start, $lt: end } }).select("rating");
    const averageRating = surveyDocs.length ? (surveyDocs.reduce((s, d) => s + Number(d.rating || 0), 0) / surveyDocs.length).toFixed(1) : null;

    res.json({
      month: `${year}-${String(monthIndex + 1).padStart(2, "0")}`,
      totalBookings: bookings.length,
      totalRevenue,
      revenueByCategory,
      revenueByLocation,
      occupancyRate,
      totalRooms,
      occupiedRooms: existingOccupiedRoomIds.length,
      averageStayDays: stayCount ? Math.round((totalStayDays / stayCount) * 10) / 10 : 0,
      checkedIn: bookings.filter((b) => b.status === "checked-in").length,
      checkedOut: bookings.filter((b) => b.status === "checked-out").length,
      cancelled: bookings.filter((b) => b.status === "cancelled").length,
      rejected: bookings.filter((b) => b.status === "rejected").length,
      newConcerns,
      averageRating,
      bookings,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getWeeklyReport = async (req, res) => {
  try {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const bookings = await Booking.find({ createdAt: { $gte: weekAgo } }).populate("room").populate("client", "name email");

    const totalRevenue = bookings.reduce((sum, b) => {
      const paid = (b.paymentTransactions || []).reduce((n, tx) => n + Number(tx.amount || 0), 0);
      const refunded = (b.paymentTransactions || []).reduce((n, tx) => n + Number(tx.refundedAmount || 0), 0);
      const owed = Number(b.refundAmountOwed || 0);
      return sum + Math.max(0, paid - refunded - owed);
    }, 0);

    res.json({
      totalBookings: bookings.length,
      totalRevenue,
      checkedIn: bookings.filter((b) => b.status === "checked-in").length,
      checkedOut: bookings.filter((b) => b.status === "checked-out").length,
      cancelled: bookings.filter((b) => b.status === "cancelled").length,
      rejected: bookings.filter((b) => b.status === "rejected").length,
      bookings,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
