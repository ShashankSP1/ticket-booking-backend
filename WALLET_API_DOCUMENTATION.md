# Wallet Top-up Approval Workflow - Complete API Documentation

## Database Models

### 1. **Wallet Collection**
Stores current wallet balance per user.

```javascript
{
  _id: ObjectId,
  userId: ObjectId (ref: User),
  userEmail: String (unique, lowercase),
  balance: Number (default: 0, min: 0),
  createdAt: Date,
  updatedAt: Date
}
```

### 2. **WalletTopupRequest Collection**
Stores all top-up requests with approval workflow.

```javascript
{
  _id: ObjectId,
  userId: ObjectId (ref: User),
  userEmail: String (lowercase, indexed),
  userName: String,
  amount: Number (min: 1, max: 100000),
  paymentMode: String (enum: "UPI", "Debit Card", "Credit Card", "Bank Transfer", "Net Banking"),
  receiptUrl: String (file path to uploaded receipt),
  declarationAccepted: Boolean (default: false),
  status: String (enum: "pending", "approved", "rejected", default: "pending", indexed),
  adminId: ObjectId (ref: User, optional),
  adminRemarks: String (optional),
  createdAt: Date,
  resolvedAt: Date (when approved/rejected)
}
```

**Indexes:**
- Compound: `{ status: 1, createdAt: -1 }`
- Compound: `{ userEmail: 1, createdAt: -1 }`

### 3. **WalletTransaction Collection** (Ledger)
Immutable ledger of all wallet transactions.

```javascript
{
  _id: ObjectId,
  userId: ObjectId (ref: User),
  userEmail: String (lowercase, indexed),
  type: String (enum: "credit", "debit"),
  amount: Number (min: 0),
  description: String,
  referenceType: String (enum: "TOPUP_REQUEST", "BOOKING", "BOOKING_CANCEL"),
  referenceId: String (ID of the reference),
  createdAt: Date
}
```

**Index:**
- Compound: `{ userEmail: 1, createdAt: -1 }`

---

## API Endpoints

### USER ENDPOINTS

#### 1. POST /api/wallet/topup-requests
Create a new top-up request with receipt upload.

**Auth:** Bearer token (user only)  
**Content-Type:** multipart/form-data

**Request Body:**
```javascript
{
  amount: number,              // ₹ (1 to 100,000)
  paymentMode: string,         // "UPI" | "Debit Card" | "Credit Card" | "Bank Transfer" | "Net Banking"
  declarationAccepted: boolean,// true
  receipt: File                // Image file (JPEG, PNG, GIF, WEBP, max 5MB)
}
```

**Response (201):**
```javascript
{
  message: "Top-up request created successfully",
  requestId: "ObjectId",
  status: "pending"
}
```

**Error Responses:**
- `400`: Invalid amount, payment mode, missing declaration, or missing file
- `404`: User not found
- `413`: File size exceeded (5MB limit)

---

#### 2. GET /api/wallet/topup-requests/me
Get all top-up requests for the authenticated user, sorted by newest first.

**Auth:** Bearer token (user only)

**Query Parameters:** None

**Response (200):**
```javascript
{
  requests: [
    {
      id: "ObjectId",
      userId: "ObjectId",
      userEmail: "user@example.com",
      userName: "John Doe",
      amount: 500,
      paymentMode: "UPI",
      receiptUrl: "/uploads/receipts/receipt-1712000000-123456.png",
      status: "pending" | "approved" | "rejected",
      createdAt: "2026-04-12T10:30:00Z",
      resolvedAt: "2026-04-12T11:00:00Z" | null,
      adminRemarks: "Invalid receipt" | null
    }
  ],
  count: 5
}
```

---

#### 3. GET /api/wallet/balance
Get the current wallet balance for the authenticated user.

**Auth:** Bearer token (user only)

**Response (200):**
```javascript
{
  balance: 1500,
  email: "user@example.com"
}
```

**Error Responses:**
- `404`: User not found

---

#### 4. GET /api/wallet/transactions/me
Get wallet transaction history (ledger) for the authenticated user.

**Auth:** Bearer token (user only)

**Query Parameters:** None

**Response (200):**
```javascript
{
  transactions: [
    {
      id: "ObjectId",
      type: "credit",                    // "credit" | "debit"
      amount: 500,
      description: "Wallet top-up approved via UPI",
      referenceType: "TOPUP_REQUEST",    // "TOPUP_REQUEST" | "BOOKING" | "BOOKING_CANCEL"
      referenceId: "topup-request-id",
      createdAt: "2026-04-12T10:35:00Z"
    }
  ],
  count: 12
}
```

---

### ADMIN ENDPOINTS

#### 5. GET /api/wallet/admin/topup-requests
List all pending top-up requests (or filtered by status).

**Auth:** Bearer token (admin only)  
**Role:** Requires `admin` role in JWT

**Query Parameters:**
```
?status=pending   // Can filter by: "pending", "approved", or "rejected" (default: "pending")
```

**Response (200):**
```javascript
{
  requests: [
    {
      id: "ObjectId",
      userId: "ObjectId",
      userEmail: "user@example.com",
      userName: "John Doe",
      amount: 500,
      paymentMode: "UPI",
      receiptUrl: "/uploads/receipts/receipt-1712000000-123456.png",
      declarationAccepted: true,
      status: "pending",
      createdAt: "2026-04-12T10:30:00Z",
      resolvedAt: null,
      adminRemarks: null
    }
  ],
  count: 3
}
```

---

#### 6. PATCH /api/wallet/admin/topup-requests/:id/approve
Approve a top-up request. **Atomic transaction** that:
1. Credits the user's wallet
2. Debits the admin's wallet
3. Creates transaction records for both
4. Marks request as approved

**Auth:** Bearer token (admin only)  
**Role:** Requires `admin` role in JWT

**Path Parameters:**
```
:id = WalletTopupRequest._id
```

**Request Body:**
```javascript
{
  adminRemarks: "Approved" // Optional
}
```

**Response (200):**
```javascript
{
  message: "Top-up approved successfully",
  requestId: "ObjectId",
  newBalance: 1500,
  amount: 500
}
```

**Error Responses:**
- `404`: Request not found
- `409`: Request already approved/rejected (cannot approve twice)
- `400`: Insufficient admin wallet balance (cannot debit more than admin has)

---

#### 7. PATCH /api/wallet/admin/topup-requests/:id/reject
Reject a top-up request. No wallet changes, just status update.

**Auth:** Bearer token (admin only)  
**Role:** Requires `admin` role in JWT

**Path Parameters:**
```
:id = WalletTopupRequest._id
```

**Request Body:**
```javascript
{
  adminRemarks: "Receipt too blurry" // Optional
}
```

**Response (200):**
```javascript
{
  message: "Top-up request rejected",
  requestId: "ObjectId",
  status: "rejected"
}
```

**Error Responses:**
- `404`: Request not found
- `409`: Request already approved/rejected (cannot reject twice)

---

## Business Logic & Validation

### On Approval (Atomic Transaction)
1. **Verify** request exists and status is "pending"
2. **Verify** admin has sufficient wallet balance to debit
3. **Credit** user wallet with `amount`
4. **Debit** admin wallet with `amount`
5. **Create** two transaction records (user credit, admin debit)
6. **Update** request status to "approved" + set `adminId`, `adminRemarks`, `resolvedAt`
7. **If any step fails**, rollback entire transaction (MongoDB session)

### Idempotency & Conflict Prevention
- If request is already `approved` or `rejected`, return `409 Conflict`
- Only processes `pending` requests

### File Upload Validation
- **MIME types allowed:** `image/jpeg`, `image/png`, `image/gif`, `image/webp`
- **Max file size:** 5 MB
- **Storage:** Local `/uploads/receipts/` directory (can be extended to S3/Cloudinary)
- **File naming:** `{originalname}-{timestamp}-{uniqueSuffix}.{ext}`

### Amount Validation
- **Min:** ₹1
- **Max:** ₹100,000
- Must be positive integer

### Role-based Access
- User endpoints: `protect` middleware only
- Admin endpoints: `protect` + `requireAdmin` middleware
- Admin role verified from JWT token

---

## Response Shape Standards

### List APIs
```javascript
{
  requests: [...],
  count: 12
}

{
  transactions: [...],
  count: 5
}
```

### Balance API
```javascript
{
  balance: 1500,
  email: "user@example.com"
}
```

### Approval API
```javascript
{
  message: "Top-up approved successfully",
  requestId: "ObjectId",
  newBalance: 1500,
  amount: 500
}
```

### Error Response (Standard)
```javascript
{
  error: "Error message"
}
```

---

## Local Testing URLs (localhost:5000)

### User Flow
```
POST   http://localhost:5000/api/wallet/topup-requests
GET    http://localhost:5000/api/wallet/topup-requests/me
GET    http://localhost:5000/api/wallet/balance
GET    http://localhost:5000/api/wallet/transactions/me
```

### Admin Flow
```
GET    http://localhost:5000/api/wallet/admin/topup-requests?status=pending
PATCH  http://localhost:5000/api/wallet/admin/topup-requests/{requestId}/approve
PATCH  http://localhost:5000/api/wallet/admin/topup-requests/{requestId}/reject
```

---

## Example cURL Commands

### Create Top-up Request (User)
```bash
curl -X POST http://localhost:5000/api/wallet/topup-requests \
  -H "Authorization: Bearer YOUR_USER_JWT" \
  -F "amount=500" \
  -F "paymentMode=UPI" \
  -F "declarationAccepted=true" \
  -F "receipt=@/path/to/receipt.png"
```

### Get User's Top-up Requests
```bash
curl -X GET http://localhost:5000/api/wallet/topup-requests/me \
  -H "Authorization: Bearer YOUR_USER_JWT"
```

### Get Wallet Balance
```bash
curl -X GET http://localhost:5000/api/wallet/balance \
  -H "Authorization: Bearer YOUR_USER_JWT"
```

### Approve Top-up Request (Admin)
```bash
curl -X PATCH http://localhost:5000/api/wallet/admin/topup-requests/REQUEST_ID/approve \
  -H "Authorization: Bearer YOUR_ADMIN_JWT" \
  -H "Content-Type: application/json" \
  -d '{"adminRemarks": "Approved"}'
```

### Reject Top-up Request (Admin)
```bash
curl -X PATCH http://localhost:5000/api/wallet/admin/topup-requests/REQUEST_ID/reject \
  -H "Authorization: Bearer YOUR_ADMIN_JWT" \
  -H "Content-Type: application/json" \
  -d '{"adminRemarks": "Receipt not clear"}'
```

---

## Frontend Integration Notes

1. **File Upload:** Use `multipart/form-data` with Multer handling the file
2. **Receipt Preview:** After upload, display receipt URL at `/uploads/receipts/{filename}`
3. **Status Polling:** Poll `/api/wallet/topup-requests/me` to check request status
4. **Atomic Operations:** Approval is atomic—either fully succeeds or fully fails
5. **Wallet Sync:** After approval, fetch `/api/wallet/balance` to display updated balance
6. **Transaction History:** Display from `/api/wallet/transactions/me` for audit trail

---

## Database Indexes
Automatically created by Mongoose schema:
- `wallets`: unique index on `userEmail`
- `wallet_topup_requests`: `{ status: 1, createdAt: -1 }` and `{ userEmail: 1, createdAt: -1 }`
- `wallet_transactions`: `{ userEmail: 1, createdAt: -1 }`

These ensure fast queries for admin dashboard and user history pages.
