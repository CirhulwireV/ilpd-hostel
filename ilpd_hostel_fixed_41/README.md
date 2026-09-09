# ILPD Hotel - Monthly Room Booking & Auto-Allocation System
Location: Nyanza, Rwanda

## Overview
The ILPD Hotel system lets clients register, choose a room category, select check-in/check-out dates, pay online, and receive a room assignment from an administrator. It also supports check-in/check-out requests, refunds for unused monthly periods, concerns, surveys, and an administrator dashboard.

## Tech Stack
- Frontend: React.js
- Backend: Node.js + Express
- Database: MongoDB Atlas + Mongoose
- Payment: Stripe Checkout + Stripe webhooks (temporary testing gateway; IremboPay is planned once official credentials are available)
- Authentication: JWT
- Deployment: AWS Amplify (frontend) and AWS Elastic Beanstalk (backend)

## Monthly Pricing
- Standard: **35,000 RWF/month**
- VIP: **50,000 RWF/month**
- VVIP: **100,000 RWF/month**

A booking is charged for at least one month. If the selected period contains a partial month, that partial month is charged as a full month. For example, August 10 to September 10 is one month; August 10 to September 20 is two billable months.

## Booking Flow
1. A client account logs in.
2. Only client accounts can create bookings; administrators manage bookings but cannot book rooms.
3. Client chooses Standard, VIP, or VVIP.
4. Client selects valid future check-in/check-out dates.
5. The backend verifies that at least one room in the selected category is available for the selected dates (maintenance rooms and overlapping reservations are excluded).
6. Stripe Checkout collects the full monthly booking amount.
7. Stripe confirms payment through the success flow/webhook.
8. The booking is stored as `pending`.
9. An administrator selects an available room from the same category.
10. The room becomes `booked` and the booking becomes `confirmed`.
11. The client requests check-in on/after the check-in date.
12. The administrator records check-in and later confirms checkout.
13. Early cancellation/checkout refunds the unused full monthly periods where applicable.
14. Clients may cancel pending/confirmed bookings through My Bookings until the configured cancellation deadline.
15. Administrators can arrange/record physical room visits and create daily accommodation monitoring records for checked-in occupants.

## Local Development
### Backend
```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

### Frontend
```bash
cd frontend
npm install
cp .env.example .env
npm start
```

## Environment Variables
### Backend
```text
PORT=5000
MONGO_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/ilpdhotel
JWT_SECRET=<your_jwt_secret>
STRIPE_SECRET_KEY=<your_stripe_secret_key>
STRIPE_WEBHOOK_SECRET=<your_stripe_webhook_secret>
CLIENT_URL=http://localhost:3000
CANCELLATION_DEADLINE_DAYS=7
```

### Frontend
```text
REACT_APP_API_URL=http://localhost:5000/api
```

Never commit the real `.env` file or secret keys.

## Room Management
Administrators create and manage rooms from the **Rooms** tab using **Add Room**. There is no seeding button in the production/admin interface; this avoids duplicate room-creation controls.

## API Endpoints
| Method | Endpoint | Access |
|---|---|---|
| POST | `/api/auth/register` | Public |
| POST | `/api/auth/login` | Public |
| GET | `/api/auth/profile` | Authenticated |
| GET | `/api/rooms` | Public |
| GET | `/api/rooms/available-for-booking?category=Standard&checkIn=YYYY-MM-DD&checkOut=YYYY-MM-DD` | Public |
| GET | `/api/rooms/:id` | Public |
| POST | `/api/rooms` | Admin |
| PUT | `/api/rooms/:id` | Admin |
| DELETE | `/api/rooms/:id` | Admin |
| POST | `/api/bookings` | Client |
| POST | `/api/bookings/confirm` | Client |
| POST | `/api/bookings/webhook` | Stripe |
| GET | `/api/bookings/my` | Client |
| GET | `/api/bookings` | Admin |
| PUT | `/api/bookings/:id/allocate` | Admin |
| PUT | `/api/bookings/:id/status` | Admin |
| POST | `/api/bookings/:id/request-checkin` | Client |
| POST | `/api/bookings/:id/request-checkout` | Client |
| PUT | `/api/bookings/:id/respond-checkin` | Admin |
| PUT | `/api/bookings/:id/respond-checkout` | Admin |
| POST | `/api/bookings/cancel/:id` | Admin |
| GET | `/api/bookings/policy` | Authenticated |
| POST | `/api/bookings/:id/cancel` | Client |
| PUT | `/api/bookings/:id/room-visit` | Admin |
| DELETE | `/api/bookings/:id/history` | Owner/Admin |
| POST | `/api/concerns` | Client |
| GET | `/api/concerns/my` | Client |
| GET | `/api/concerns` | Admin |
| PUT | `/api/concerns/:id/respond` | Admin |
| DELETE | `/api/concerns/:id` | Owner/Admin |
| POST | `/api/surveys` | Client |
| GET | `/api/surveys` | Admin |
| GET | `/api/monitoring` | Admin |
| GET | `/api/monitoring/booking/:bookingId` | Authenticated |
| POST | `/api/monitoring` | Admin |

## Security & Data Rules
- Only users with the `client` role can create or confirm room bookings; admin booking attempts are rejected by the backend.
- Administrators do not have a **My Bookings** area. Their booking-management tools are available in the Admin Dashboard.
- When an administrator allocates a room to a paid booking, that room is automatically marked `booked` and the Admin Dashboard refreshes the Rooms tab to show the new status.
- After an approved checkout, cancellation, or rejection releases a room, its status is automatically synchronized back to `available` unless the room is under maintenance.
- JWT authentication protects client/admin operations.
- Admin-only routes require the authenticated user's admin role.
- Booking confirmation verifies that the Stripe session belongs to the logged-in client.
- Stripe session IDs are unique to make webhook retries idempotent.
- Important date, category, pricing, ownership, and workflow validation is enforced on the backend.
- Rooms with active/future reservations cannot be deleted or manually made available/maintenance.
- A room cannot be manually marked `booked` unless it is linked to an active booking.
- Room allocation checks date overlap, so the same room can be reserved again for a non-overlapping future period.
- Completed/cancelled/rejected bookings are retained until the owner/admin deliberately removes them from history.


## Operational Policies & Requirements Coverage
### Payment gateway
The current working prototype uses Stripe because official IremboPay credentials are not yet available. The proposed process can be switched to IremboPay when ILPD provides the official credentials. Do not claim that IremboPay is currently integrated.

### Cancellation deadline
The client cancellation deadline is configurable through `CANCELLATION_DEADLINE_DAYS` and defaults to **7 days before check-in**. The same rule is enforced by the backend and displayed to clients. Update the environment value when ILPD approves a different official policy.

### Physical room visit
After room allocation, an administrator can arrange a visit, record the visit as completed, or mark it declined. The visit status and notes are stored with the booking.

### Daily accommodation monitoring
For checked-in occupants, an administrator can create one daily monitoring record per booking per date, covering cleanliness, maintenance, service status, and notes.


## API Rate Limiting

The backend includes layered rate limiting using `express-rate-limit`:

- General API: 120 requests per 15 minutes per client IP.
- Login: 10 failed attempts per 15 minutes. Successful logins are not counted.
- Registration: 5 attempts per hour per client IP.
- Booking creation/confirmation: 30 requests per 15 minutes per client IP.
- Rate-limit responses use HTTP `429 Too Many Requests` and standard rate-limit headers.
- The frontend Axios client displays the server's rate-limit message and retry time when available.

The backend trusts one reverse-proxy hop because the production deployment uses AWS Elastic Beanstalk. The default in-memory rate-limit store is suitable for a single backend instance; if the application is scaled to multiple backend instances, use a shared store such as Redis so limits are consistent across instances.

## Booking update and refund policy

- A client can use **Update** while a booking is `pending` and no room has been allocated.
- The client can change the check-in/check-out dates.
- If the new stay costs less, the difference is refunded automatically through Stripe when possible; otherwise the booking is marked `refund_pending` for manual processing.
- If the new stay costs more, the client is sent to Stripe to pay only the additional amount. The booking is updated after the additional payment is confirmed.
- Date reductions and early departures use a pro-rata daily rate of **monthly rate / 30**. This means unused paid days are not simply lost.
- Check-in and checkout are now recorded by the **admin**. Clients do not need to submit check-in or checkout requests.
- When an admin records an early checkout, the system calculates the unused-day refund for that booking automatically.
- Multiple bookings are treated independently. If one client makes five bookings for five people and those people leave on five different dates, each booking gets its own checkout date and its own unused-day refund calculation.
- Refund/payment adjustments are stored in `financialAdjustments` and Stripe payment transactions are tracked so later refunds can use the remaining refundable balance safely.

### Policy configuration

`backend/.env.example` documents:

- `REFUND_DAILY_DIVISOR=30` — number of days used for the pro-rata monthly calculation.
- `BOOKING_EDIT_DEADLINE_HOURS=0` — `0` allows edits any time before room allocation; set a positive value if ILPD wants an edit cutoff before check-in.

## Multi-person bookings and individual stay refunds
A single client can now make one booking for multiple people. Each person is stored as an occupant with an individual room, check-in/check-out state, and early-checkout refund amount. The admin allocates the required number of rooms and records each person's check-in and checkout independently. When one person leaves early, only that person's unused days are refunded to the client who made the original payment; the other occupants remain active.

Refunds use the configured pro-rata rule (`REFUND_DAILY_DIVISOR`, default 30 days per monthly rate). If Stripe cannot process a refund automatically, the booking is marked `refund_pending` for manual processing.


## ILPD Accommodation Pricing

The system supports two accommodation locations:

- **Hostel Block (outside the ILPD Institution Building):** all outside-block rooms use the single tariff of **100,000 RWF/month**.
- **ILPD Institution Building:** Standard 35,000 RWF/night; VIP 50,000 RWF/night; VVIP 100,000 RWF/night.

The selected location is stored on both the room and booking. Availability and payment totals are calculated using the location-specific billing period. Existing rooms/bookings default to the outside Hostel Block unless their location is explicitly migrated.


## Room inventory seeding

The backend includes an idempotent `seedRooms.js` for initializing both ILPD accommodation locations:

```bash
cd backend
npm run seed:rooms
```

The authoritative production inventory is defined in `backend/inventory.js`: 88 Main House rooms plus 40 Outside Block records. The seed identifies rooms by `accommodationType + roomNumber + hostelSection`, preserves existing room status and uploaded images, and is safe to run again without creating duplicate inventory records.


## ILPD real room inventory

The seed reflects the supplied Main House inventory: 54 Standard (201-227, 301-327), 32 VIP (228-245, 330-343), and 2 VVIP (328-329), for 88 Main House rooms. The Outside Block contains 40 physical records: AKAGERA 101-114 (14 records) and KARISIMBI 114-139 (26 records). The two Room 114 records are intentionally distinct physical rooms because they belong to different blocks. Total inventory is exactly 128 records.

Run `npm run migrate:accommodation`, then `npm run migrate:room-index`, then `npm run seed:rooms` (or `npm run migrate:real-inventory`). The seed preserves existing room status and uploaded photos.

## Digital registration

The admin check-in flow includes the fields from the supplied ILPD Registration Form through phone number: names, national ID/passport, nationality, position, address/institution, purpose of visit, and phone number. Room number and stay dates are supplied by the booking/allocation workflow, with signature captured during digital registration/check-out.

### Fixing “No Standard/VIP/VVIP rooms are configured”
If the client sees a message saying no rooms are configured, the database inventory has not been initialized or older rooms have the wrong accommodation location. Run:

```bash
cd backend
npm run seed:rooms
```

The seed uses the supplied real Main House inventory (88 rooms) and the 40 Outside Block records, including the two distinct Room 114 records. It also repairs legacy rooms with a missing accommodation type.

You can inspect the inventory through the admin dashboard or the `/api/rooms/inventory-summary` endpoint.


## First-time room inventory repair
1. `cd backend`
2. `npm install`
3. `node repairRoomInventory.js`
4. `node verifyRoomInventory.js`
5. Only after verification passes, start the backend. Do not run `seedRooms.js` on every startup.
