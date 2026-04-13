# Ticket Booking Backend

Node.js + Express + MongoDB backend for event ticket booking with seat reservation, wallet flows, top-up approval, and atomic booking confirmation.

## Tech Stack

- Node.js
- Express
- TypeScript
- MongoDB + Mongoose
- JWT authentication
- bcrypt password hashing
- multer + Cloudinary receipt uploads
- node-cron for reservation expiry cleanup

## Implemented Features

- User and admin auth with JWT
- Event CRUD
- Seat management per event
- Seat reservation with 5-minute hold window
- Reservation release endpoint
- Atomic booking confirm transaction
- Booking cancel/refund (user and admin)
- Wallet balance, transactions, top-up requests
- Admin approve/reject top-up requests
- Reservation expiry cron job (runs every minute)

## Project Structure

```text
src/
  app.ts
  server.ts
  config/
  controllers/
    auth.controller.ts
    event.controller.ts
    seat.controller.ts
    booking.controller.ts
    wallet.controller.ts
  middleware/
    auth.middleware.ts
  jobs/
    expireReservations.ts
  routes/
    auth.routes.ts
    admin.routes.ts
    event.routes.ts
    seat.routes.ts
    reservation.routes.ts
    booking.routes.ts
    wallet.routes.ts
  shared/models/
    user.model.ts
    admin.model.ts
    event.model.ts
    seat.model.ts
    reservation.model.ts
    booking.model.ts
    wallet.model.ts
    walletTopupRequest.model.ts
    walletTransaction.model.ts
```

## Environment Variables

Create a .env file in project root:

```env
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
ADMIN_SECRET=your_admin_secret
```

## Install and Run

```bash
npm install
npm run dev
```

Build and run production:

```bash
npm run build
npm start
```

Health check:

- GET / -> Ticket booking backend is running

## API Base

- Local: http://localhost:5000
- Deployed: https://ticket-booking-backend-sley.onrender.com

## Main Routes

### Auth

- POST /api/auth/register
- POST /api/auth/signin
- POST /api/admin/signin
- POST /api/admin/register

### Events

- GET /api/events
- GET /api/events/:eventId
- GET /api/events/:eventId/available-tickets
- POST /api/events (admin)
- PUT /api/events/:eventId (admin)
- DELETE /api/events/:eventId (admin)

### Seats and Reservations

- GET /api/events/:eventId/seats
- GET /api/events/:eventId/seats/stats
- POST /api/events/:eventId/seats/bulk (admin)
- POST /api/events/:eventId/seats/reserve (user)
- DELETE /api/reservations/:reservationId/release (user)

### Bookings

- POST /api/bookings/confirm (user, atomic flow)
- POST /api/bookings (legacy create)
- GET /api/bookings/my-bookings (user)
- GET /api/bookings/user/:email (user)
- PUT /api/bookings/:id/cancel (user)
- GET /api/bookings (admin)
- POST /api/bookings/:id/cancel-refund (admin)

### Wallet

- GET /api/wallet/balance
- GET /api/wallet/transactions/me
- POST /api/wallet/topup-requests (multipart receipt upload)
- GET /api/wallet/topup-requests/me
- GET /api/wallet/admin/topup-requests?status=pending
- PATCH /api/wallet/admin/topup-requests/:id/approve
- PATCH /api/wallet/admin/topup-requests/:id/reject

## Booking Confirm Flow

Endpoint: POST /api/bookings/confirm

Expected body includes:

- reservationId
- eventId
- seatNumbers
- totalAmount
- optional eventName, eventDate, eventTime, userEmail, userName

Server behavior:

1. Validates reservation exists and belongs to authenticated user
2. Validates reservation not expired
3. Verifies all requested seats are still reserved by same user
4. Atomically debits wallet with balance guard
5. Creates debit wallet transaction
6. Marks seats as booked
7. Creates booking record
8. Removes reservation

Idempotency:

- If same reservationId is confirmed again, server returns existing booking with 200.

## Reservation Expiry

A cron job runs every minute and releases expired reservations:

- Seats in reserved state with expired reservedUntil are reset to available
- Associated reservation documents are removed

## Postman

Collection file is included at project root:

- TicketBooking.postman_collection.json

Import it into Postman and set token variables through login requests.

## Notes

- Current reservation hold window is 5 minutes.
- If client gets "Reservation has expired", user must reserve seats again and retry payment.
