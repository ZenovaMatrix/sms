# EduManage Backend

A modular Node.js + Express backend for the EduManage School Student Management System.

---

## Technology

| Layer      | Technology          |
|------------|---------------------|
| Runtime    | Node.js             |
| Framework  | Express.js          |
| Database   | MySQL 8.x           |
| Driver     | mysql2/promise      |
| Language   | JavaScript (ESM/CJS)|

---

## Prerequisites

- Node.js (v18 or later recommended)
- MySQL Server 8.x running locally
- MySQL Workbench (optional, for schema inspection)
- The `edumanage` database already created in MySQL

---

## Project Structure

```
backend/
├── src/
│   ├── config/
│   │   ├── env.js          # Loads & validates environment variables (including JWT)
│   │   └── db.js           # MySQL connection pool
│   ├── database/
│   │   └── dbHealth.js     # Database health-check logic
│   ├── controllers/
│   │   └── health.controller.js  # Health endpoint controller
│   ├── routes/
│   │   └── health.routes.js      # Health endpoint routes (/api/v1/health)
│   ├── middlewares/
│   │   ├── auth.middleware.js    # JWT authentication middleware
│   │   └── role.middleware.js    # RBAC authorization middleware
│   ├── modules/
│   │   ├── users/
│   │   │   ├── user.repository.js # Database queries (parameterized SQL)
│   │   │   ├── user.service.js    # Business logic & validations
│   │   │   ├── user.controller.js # HTTP request handler
│   │   │   ├── user.routes.js     # Router for /api/v1/users
│   │   │   └── user.validation.js # Query & payload validator
│   │   ├── auth/
│   │   │   ├── auth.repository.js # User lookup for authentication
│   │   │   ├── auth.service.js    # Password comparison & token generation
│   │   │   ├── auth.controller.js # Login request handler
│   │   │   ├── auth.routes.js     # Router for /api/v1/auth
│   │   │   └── auth.validation.js # Login payload validator
│   │   ├── students/
│   │   │   ├── student.repository.js # Student DB access & safe joins
│   │   │   ├── student.service.js    # Ownership & business logic
│   │   │   ├── student.controller.js # HTTP request handler
│   │   │   ├── student.routes.js     # Router for /api/v1/students
│   │   │   └── student.validation.js # Validation rules & schema constraints
│   │   ├── teachers/
│   │   │   ├── teacher.repository.js # Teacher DB access & safe joins
│   │   │   ├── teacher.service.js    # Ownership & business logic
│   │   │   ├── teacher.controller.js # HTTP request handler
│   │   │   ├── teacher.routes.js     # Router for /api/v1/teachers
│   │   │   └── teacher.validation.js # Validation rules & schema constraints
│   │   └── parents/
│   │       ├── parent.repository.js  # Parent & relationship DB access
│   │       ├── parent.service.js     # Ownership & relationship business logic
│   │       ├── parent.controller.js  # HTTP request handler
│   │       ├── parent.routes.js      # Router for /api/v1/parents
│   │       └── parent.validation.js  # Validation rules & relationship constraints
│   ├── utils/
│   │   └── jwt.js          # JWT generation & verification utility
│   ├── app.js              # Express app initialization & route mounting
│   └── server.js           # HTTP server entry point
├── scripts/
│   ├── test-db.js          # Standalone DB connection test
│   ├── test-users.js       # Phase 3A Users test suite
│   ├── test-auth.js        # Phase 3B Auth test suite
│   ├── test-auth-middleware.js # Phase 3C Auth middleware & RBAC test suite
│   ├── test-students.js    # Phase 4A Students test suite
│   ├── test-teachers.js    # Phase 4B Teachers test suite
│   ├── test-parents.js     # Phase 4C Parents & Relationships test suite
│   ├── test-phase4.js      # Phase 4D Master Integration test suite
│   └── set-test-password.js # Controlled test password setup utility
├── .env                    # Local secrets (never committed)
├── .env.example            # Template — safe to commit
├── .gitignore
├── package.json
└── README.md
```

---

## Setup & Running

> **Important Directory Rule**: All `npm` commands must be executed from the `backend/` directory (`d:\studentmanagmentsystem\backend`), NOT from the root directory.

### 1. Install dependencies

```bash
cd backend
npm install
```

### 2. Configure environment

Copy `.env.example` to `.env`:

```bash
copy .env.example .env
```

Open `.env` and configure your settings:

```env
PORT=5000

DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_actual_mysql_password
DB_NAME=edumanage
```

---

## Start Backend

From the `backend/` directory:

```bash
npm start
```

---

## Database Test Script

Run the standalone database connection test:

```bash
npm run test:db
```

---

## Health API

### Endpoint:

`GET /api/v1/health`

### Response (HTTP 200):

```json
{
  "success": true,
  "message": "EduManage API is healthy",
  "data": {
    "api": "ok",
    "database": "connected",
    "databaseName": "edumanage"
  }
}
```

---

---

## Users API (Phase 3A)

> **Security & Authorization Limitation**:
> User authorization is intentionally not implemented until Phase 3C. Authentication (login, registration, password hashing) will be implemented in Phase 3B. Currently, these endpoints operate without authentication/authorization for development and management purposes.

### Endpoints Summary

| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| `GET` | `/api/v1/users` | List users with pagination, filters & search | `200 OK` / `400 Bad Request` |
| `GET` | `/api/v1/users/:id` | Get user details by UUID | `200 OK` / `404 Not Found` |
| `GET` | `/api/v1/users/email/:email` | Get user details by email | `200 OK` / `404 Not Found` |
| `PATCH` | `/api/v1/users/:id` | Update safe profile fields (`name`, `phone`, `status`) | `200 OK` / `400 Bad Request` / `404 Not Found` |
| `POST` | `/api/v1/users` | Create user (Admin only; bcrypt password hashing) | `201 Created` / `400 Bad Request` / `401 Unauthorized` / `403 Forbidden` / `409 Conflict` |
| `DELETE` | `/api/v1/users/:id` | User deletion disabled for data integrity | `501 Not Implemented` |

---

### 1. GET `/api/v1/users`

Retrieve a paginated list of users.

#### Query Parameters:
- `page` (default: `1`, minimum: `1`)
- `limit` (default: `10`, maximum: `100`)
- `role` (optional, allowed: `admin`, `teacher`, `student`, `parent`, `librarian`)
- `status` (optional, allowed: `active`, `inactive`, `suspended`)
- `search` (optional, searches `name` and `email` using parameterized LIKE)

#### Example Request:
`GET /api/v1/users?page=1&limit=5&role=teacher&status=active&search=Amit`

#### Success Response (`200 OK`):
```json
{
  "success": true,
  "message": "Users retrieved successfully",
  "data": {
    "users": [
      {
        "id": "10000000-0000-0000-0000-000000000002",
        "name": "Amit Verma",
        "email": "amit@edumanage.com",
        "role": "teacher",
        "phone": "9876500002",
        "status": "active",
        "created_at": "2026-09-12T05:42:38.000Z",
        "updated_at": "2026-09-12T05:42:38.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 5,
      "total": 1,
      "totalPages": 1
    }
  }
}
```

---

### 2. GET `/api/v1/users/:id`

Retrieve a single user by their UUID.

#### Example Request:
`GET /api/v1/users/10000000-0000-0000-0000-000000000002`

#### Success Response (`200 OK`):
```json
{
  "success": true,
  "message": "User retrieved successfully",
  "data": {
    "id": "10000000-0000-0000-0000-000000000002",
    "name": "Amit Verma",
    "email": "amit@edumanage.com",
    "role": "teacher",
    "phone": "9876500002",
    "status": "active",
    "created_at": "2026-09-12T05:42:38.000Z",
    "updated_at": "2026-09-12T05:42:38.000Z"
  }
}
```

#### Not Found Response (`404 Not Found`):
```json
{
  "success": false,
  "message": "User not found",
  "data": null
}
```

---

### 3. GET `/api/v1/users/email/:email`

Retrieve a single user by their email address.

#### Example Request:
`GET /api/v1/users/email/amit@edumanage.com`

#### Success Response (`200 OK`):
```json
{
  "success": true,
  "message": "User retrieved successfully",
  "data": {
    "id": "10000000-0000-0000-0000-000000000002",
    "name": "Amit Verma",
    "email": "amit@edumanage.com",
    "role": "teacher",
    "phone": "9876500002",
    "status": "active",
    "created_at": "2026-09-12T05:42:38.000Z",
    "updated_at": "2026-09-12T05:42:38.000Z"
  }
}
```

---

### 4. PATCH `/api/v1/users/:id`

Update safe profile fields for an existing user.

#### Allowed Body Fields:
- `name` (string, 1-150 chars)
- `phone` (string, max 20 chars, or null)
- `status` (`active`, `inactive`, `suspended`)

#### Disallowed Fields (returns `400 Bad Request`):
- `role` (cannot be changed via profile update)
- `password_hash` / `password` (cannot be updated in Phase 3A)
- `email` (cannot be changed through this endpoint)
- `id` (immutable)
- Any unrecognized/unknown field

#### Example Request:
`PATCH /api/v1/users/10000000-0000-0000-0000-000000000002`
```json
{
  "name": "Amit Verma",
  "phone": "9876500002",
  "status": "active"
}
```

#### Success Response (`200 OK`):
```json
{
  "success": true,
  "message": "User updated successfully",
  "data": {
    "id": "10000000-0000-0000-0000-000000000002",
    "name": "Amit Verma",
    "email": "amit@edumanage.com",
    "role": "teacher",
    "phone": "9876500002",
    "status": "active",
    "created_at": "2026-09-12T05:42:38.000Z",
    "updated_at": "2026-09-19T14:15:00.000Z"
  }
}
```

---

### 5. POST `/api/v1/users` (Admin Only)

Create a new user account with hashed password (`bcryptjs`), role, and optional phone/status.

#### Security & Access:
- **Authorization**: Requires Bearer token with `role: admin`. Returns `401` if unauthenticated, `403` if unauthorized.
- **Password**: Hashed using bcrypt with salt rounds 10 before persisting. Never logged or exposed.
- **Duplicate Prevention**: Rejects duplicate email addresses with `409 Conflict`.

#### Request Headers:
```
Authorization: Bearer <admin_jwt>
Content-Type: application/json
```

#### Request Body:
```json
{
  "name": "Meera Librarian",
  "email": "meera.lib@edumanage.com",
  "password": "Password@123",
  "role": "librarian",
  "phone": "9876543210",
  "status": "active"
}
```

#### Success Response (`201 Created`):
```json
{
  "success": true,
  "message": "User created successfully",
  "data": {
    "id": "e4b2d189-5321-4f18-a6e5-470a7b458d92",
    "name": "Meera Librarian",
    "email": "meera.lib@edumanage.com",
    "role": "librarian",
    "phone": "9876543210",
    "status": "active",
    "created_at": "2026-10-19T00:58:00.000Z",
    "updated_at": "2026-10-19T00:58:00.000Z"
  }
}
```

---

### 6. DELETE `/api/v1/users/:id` (Disabled in Phase 3A)

Returns `501 Not Implemented`:
```json
{
  "success": false,
  "message": "User deletion is disabled for data integrity",
  "data": null
}
```

---

## Security & Data Rules

- `password_hash` is **NEVER** returned in any API response.
- All database queries use parameterized SQL statements.
- `password_hash`, `role`, and `email` cannot be modified via `PATCH /api/v1/users/:id`.
- Database schemas and existing records remain unchanged.
- Duplicate entries are caught and returned as clean `409 Conflict` errors.

---

## Authentication API (Phase 3B)

Phase 3B implements secure user authentication using bcrypt password hashing and JSON Web Tokens (JWT).

### Endpoints Summary

| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| `POST` | `/api/v1/auth/login` | Authenticate user credentials and issue JWT | `200 OK` / `400 Bad Request` / `401 Unauthorized` / `403 Forbidden` |

---

### 1. POST `/api/v1/auth/login`

Authenticates a user by email and password.

#### Request Headers:
```
Content-Type: application/json
```

#### Request Body:
```json
{
  "email": "admin@edumanage.com",
  "password": "yourPasswordHere"
}
```

#### Validation Rules:
- `email`: Required, valid email format.
- `password`: Required, non-empty string.
- Unknown/malformed payloads return `400 Bad Request`.

#### Success Response (`200 OK`):
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "10000000-0000-0000-0000-000000000001",
      "name": "Admin User",
      "email": "admin@edumanage.com",
      "role": "admin",
      "phone": "9876500001",
      "status": "active"
    }
  }
}
```

#### Error Responses:

- **Invalid Credentials (`401 Unauthorized`)**:
  Generic message returned regardless of whether the email exists or password was incorrect (prevents user enumeration):
  ```json
  {
    "success": false,
    "message": "Invalid email or password",
    "data": null
  }
  ```

- **Inactive Account (`403 Forbidden`)**:
  Returned when account status is `inactive`:
  ```json
  {
    "success": false,
    "message": "User account is inactive",
    "data": null
  }
  ```

- **Suspended Account (`403 Forbidden`)**:
  Returned when account status is `suspended`:
  ```json
  {
    "success": false,
    "message": "User account is suspended",
    "data": null
  }
  ```

- **Validation Failure (`400 Bad Request`)**:
  Returned when email/password is missing or invalid:
  ```json
  {
    "success": false,
    "message": "Email is required.",
    "data": null
  }
  ```

---

### JWT Configuration & Security

- **Environment Variables**:
  - `JWT_SECRET`: Secure random secret key used for HMAC-SHA256 signature.
  - `JWT_EXPIRES_IN`: Token validity period (e.g. `1d`, `7d`).
- **Payload Claims**:
  The token strictly contains minimal identity claims:
  ```json
  {
    "userId": "10000000-0000-0000-0000-000000000001",
    "role": "admin",
    "iat": 1726759758,
    "exp": 1726846158
  }
  ```
- **Privacy Guarantee**: `password`, `password_hash`, database secrets, and credentials are never placed in JWT tokens or returned in any API responses.

---

---

## Phase 4: Students, Teachers, Parents & Relationships

### Overview
Phase 4 introduces modular domain entities with strict layered architecture:
`Route` → `Controller` → `Service` → `Repository` → `MySQL (pool.execute)`

All protected endpoints enforce:
1. `authenticate` middleware (JWT validation via `Authorization: Bearer <token>`)
2. `authorize(...roles)` middleware (RBAC role whitelist)
3. Service-level ownership verification against database records.

---

### RBAC & Ownership Matrix

| Method | Endpoint | Allowed Roles | Ownership / Access Rules |
|---|---|---|---|
| **GET** | `/api/v1/students` | `admin`, `teacher` | Paginated search (page, limit up to 100). Safe user JOIN. |
| **GET** | `/api/v1/students/:id` | `admin`, `teacher`, `student` | Student restricted to own record (`student.user_id === req.user.userId`). Parent 403. |
| **GET** | `/api/v1/students/user/:userId` | `admin`, `teacher`, `student` | Student restricted to own `userId`. Parent 403. |
| **PATCH** | `/api/v1/students/:id` | `admin`, `student` | Student restricted to own record. Allowed fields: `first_name`, `last_name`, `phone`, `date_of_birth`, `gender`, `blood_group`, `address`, `status`. Teacher/Parent 403. |
| **POST** | `/api/v1/students` | `admin` | **501 Not Implemented** (requires multi-table enrollment transaction). |
| **DELETE** | `/api/v1/students/:id` | `admin` | **501 Not Implemented** (data integrity / `ON DELETE RESTRICT`). |
| **GET** | `/api/v1/teachers` | `admin`, `teacher` | Paginated search. Safe user & department JOIN. |
| **GET** | `/api/v1/teachers/:id` | `admin`, `teacher` | Teacher restricted to own record (`teacher.user_id === req.user.userId`). Student/Parent 403. |
| **GET** | `/api/v1/teachers/user/:userId` | `admin`, `teacher` | Teacher restricted to own `userId`. Student/Parent 403. |
| **PATCH** | `/api/v1/teachers/:id` | `admin`, `teacher` | Teacher restricted to own record. Allowed fields: `first_name`, `last_name`, `phone`, `qualification`, `joining_date`, `status`. Student/Parent 403. |
| **POST** | `/api/v1/teachers` | `admin` | **501 Not Implemented** (requires employee ID allocation). |
| **DELETE** | `/api/v1/teachers/:id` | `admin` | **501 Not Implemented** (data integrity). |
| **GET** | `/api/v1/parents` | `admin` | Paginated search. Teacher/Student/Parent 403. |
| **GET** | `/api/v1/parents/:id` | `admin`, `parent` | Parent restricted to own record (`parent.user_id === req.user.userId`). Teacher/Student 403. |
| **GET** | `/api/v1/parents/user/:userId` | `admin`, `parent` | Parent restricted to own `userId`. Teacher/Student 403. |
| **PATCH** | `/api/v1/parents/:id` | `admin`, `parent` | Parent restricted to own record. Allowed fields: `full_name`, `phone`, `email`, `occupation`, `address`. Teacher/Student 403. |
| **POST** | `/api/v1/parents` | `admin` | **501 Not Implemented** (requires user account coordination). |
| **DELETE** | `/api/v1/parents/:id` | `admin` | **501 Not Implemented** (data integrity). |
| **GET** | `/api/v1/parents/:parentId/students` | `admin`, `parent` | Parent restricted to own `parentId`. Returns linked students. Teacher/Student 403. |
| **GET** | `/api/v1/students/:studentId/parents` | `admin`, `teacher`, `student`, `parent` | Student restricted to own record. Parent restricted to linked students verified via `student_parents`. Returns linked parents. |
| **POST** | `/api/v1/parents/:parentId/students/:studentId` | `admin` | Links student to parent. Returns **409 Conflict** if already linked. |
| **DELETE** | `/api/v1/parents/:parentId/students/:studentId` | `admin` | **501 Not Implemented** ("Student-parent relationship deletion is disabled for data integrity"). |

---

### Validation & Error Handling

- **`400 Bad Request`**:
  - Malformed UUID in route parameters (`/:id`, `/user/:userId`, `/:parentId`, `/:studentId`)
  - Pagination limits exceeding 100
  - Empty PATCH bodies
  - Attempting to modify immutable / forbidden fields (`id`, `user_id`, `student_id`, `employee_id`, `email`, `role`, `password_hash`, `created_at`, `updated_at`)
  - Unknown fields in request body
  - Invalid enum values (`gender`, `status`, `relationship`)
- **`401 Unauthorized`**:
  - Missing or malformed `Authorization: Bearer <token>`
  - Invalid or expired JWT
- **`403 Forbidden`**:
  - Authenticated user does not possess the required role
  - User attempts to access or modify records not owned by them
  - Parent attempts to access students not linked to them in MySQL
- **`404 Not Found`**:
  - Target entity ID does not exist
- **`409 Conflict`**:
  - Duplicate relationship creation attempt between an already linked student and parent
- **`501 Not Implemented`**:
  - Operations intentionally disabled to preserve schema integrity and multi-table transaction invariants.

---

### Test Commands

Run the full suite of regression and integration tests from the `backend/` directory:

```bash
# 1. Standalone Database connection check
npm run test:db

# 2. Phase 3A: Users API Test Suite
node scripts/test-users.js

# 3. Phase 3B: Authentication & JWT Test Suite
node scripts/test-auth.js

# 4. Phase 3C: JWT Middleware & RBAC Test Suite
node scripts/test-auth-middleware.js

# 5. Phase 4A: Students Module Test Suite
node scripts/test-students.js

# 6. Phase 4B: Teachers Module Test Suite
node scripts/test-teachers.js

# 7. Phase 4C: Parents & Relationships Test Suite
node scripts/test-parents.js

# 8. Phase 4D: Master Integration Test Suite
node scripts/test-phase4.js
```

