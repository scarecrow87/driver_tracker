# Driver Tracker API Reference

This document provides a comprehensive reference for all backend API endpoints in the Driver Tracker system.

## Base URL
All API endpoints are prefixed with `/api/`

## Authentication
The API uses JWT (JSON Web Token) for authentication. Upon successful login, clients receive a token that must be included in the `Authorization` header of subsequent requests.

### Login
**POST** `/api/auth/login`
- Authenticates a user and returns a JWT token
- **Request Body:**
  ```json
  {
    "email": "string (required)",
    "password": "string (required)"
  }
  ```
- **Success Response (200):**
  ```json
  {
    "id": "string",
    "email": "string",
    "name": "string",
    "role": "string (SUPERUSER|ADMIN|DRIVER)",
    "token": "string (JWT)"
  }
  ```
- **Error Responses:**
  - 400: Missing email or password
  - 401: Invalid credentials
  - 500: Internal server error

### Get Current User
**POST** `/api/auth/me`
- Returns the currently authenticated user's information
- Requires: Valid JWT token in Authorization header
- **Success Response (200):**
  ```json
  {
    "user": {
      "id": "string",
      "email": "string",
      "name": "string",
      "role": "string",
      "isActive": "boolean"
    }
  }
  ```
- **Error Responses:**
  - 401: Not authenticated
  - 500: Internal server error

## Driver Check-in/out
All check-in/check-out endpoints require authentication.

### Create Check-in
**POST** `/api/checkin`
- Creates a new driver check-in record
- Requires: Valid JWT token in Authorization header
- **Request Body:**
  ```json
  {
    "locationId": "string (required)",
    "latitude": "number (optional)",
    "longitude": "number (optional)",
    "idempotencyKey": "string (optional)",
    "extendedStay": "boolean (optional, default: false)",
    "extendedStayReason": "string (required if extendedStay is true)"
  }
  ```
- **Success Response (201):**
  ```json
  {
    "id": "string",
    "driverId": "string",
    "locationId": "string",
    "latitude": "number",
    "longitude": "number",
    "checkInTime": "ISO date string",
    "checkOutTime": null,
    "checkInRequestKey": "string or null",
    "checkOutRequestKey": null,
    "isExtendedStay": "boolean",
    "extendedStayReason": "string or null",
    "extendedStayAt": "ISO date string or null",
    "alertLevel": "integer",
    "location": {
      "id": "string",
      "name": "string",
      "code": "string",
      "isActive": "boolean"
    }
  }
  ```
- **Error Responses:**
  - 400: Missing locationId or invalid request
  - 401: Not authenticated
  - 404: Location not found
  - 409: Driver already has an open check-in
  - 500: Internal server error

### Get Current Check-in
**GET** `/api/checkin`
- Retrieves the currently authenticated driver's open check-in
- Requires: Valid JWT token in Authorization header
- **Success Response (200):**
  ```json
  {
    "id": "string",
    "driverId": "string",
    "locationId": "string",
    "latitude": "number",
    "longitude": "number",
    "checkInTime": "ISO date string",
    "checkOutTime": null,
    "checkInRequestKey": "string or null",
    "checkOutRequestKey": null,
    "isExtendedStay": "boolean",
    "extendedStayReason": "string or null",
    "extendedStayAt": "ISO date string or null",
    "alertLevel": "integer",
    "location": {
      "id": "string",
      "name": "string",
      "code": "string",
      "isActive": "boolean"
    }
  }
  ```
  Returns `null` if no open check-in exists.
- **Error Responses:**
  - 401: Not authenticated
  - 500: Internal server error

### Check-out
**POST** `/api/checkin/checkout`
- Checks out the currently authenticated driver from their current location
- Requires: Valid JWT token in Authorization header
- **Request Body:**
  ```json
  {
    "idempotencyKey": "string (optional)"
  }
  ```
- **Success Response (200):**
  ```json
  {
    "id": "string",
    "driverId": "string",
    "locationId": "string",
    "latitude": "number",
    "longitude": "number",
    "checkInTime": "ISO date string",
    "checkOutTime": "ISO date string",
    "checkInRequestKey": "string or null",
    "checkOutRequestKey": "string or null",
    "isExtendedStay": "boolean",
    "extendedStayReason": "string or null",
    "extendedStayAt": "ISO date string or null",
    "alertLevel": "integer",
    "location": {
      "id": "string",
      "name": "string",
      "code": "string",
      "isActive": "boolean"
    }
  }
  ```
- **Error Responses:**
  - 400: Invalid request
  - 401: Not authenticated
  - 404: No open check-in found
  - 500: Internal server error

## Admin Endpoints
All admin endpoints require ADMIN or SUPERUSER role.

### User Management

#### List Users
**GET** `/api/admin/users`
- Lists users with optional filtering based on requester's role
- Requires: Valid JWT token with ADMIN or SUPERUSER role
- **Query Parameters:**
  - None (filters based on requester's role)
    - Superusers see all roles
    - Admins see only ADMIN and DRIVER accounts
- **Success Response (200):**
  ```json
  [
    {
      "id": "string",
      "email": "string",
      "name": "string",
      "role": "string (SUPERUSER|ADMIN|DRIVER)",
      "isActive": "boolean",
      "adminPhone": "string or null",
      "adminEmail": "string or null",
      "driverPhone": "string or null",
      "createdAt": "ISO date string"
    }
  ]
  ```
- **Error Responses:**
  - 401: Not authenticated
  - 403: Insufficient permissions
  - 500: Internal server error

#### Create User
**POST** `/api/admin/users`
- Creates a new user account
- Requires: Valid JWT token with ADMIN or SUPERUSER role
- **Request Body:**
  ```json
  {
    "email": "string (email format, optional for DRIVER role)",
    "name": "string (required, min 1 character)",
    "password": "string (required, min 6 characters)",
    "role": "string (ADMIN|DRIVER|SUPERUSER, default: DRIVER)",
    "isActive": "boolean (optional, default: true)",
    "adminPhone": "string (optional)",
    "adminEmail": "string (email format, optional)",
    "driverPhone": "string (optional)"
  }
  ```
- **Constraints:**
  - Only SUPERUSER can create SUPERUSER accounts
  - DRIVER role can have empty email (defaults to empty string)
- **Success Response (201):**
  ```json
  {
    "id": "string",
    "email": "string",
    "name": "string",
    "role": "string",
    "isActive": "boolean",
    "adminPhone": "string or null",
    "adminEmail": "string or null",
    "driverPhone": "string or null",
    "createdAt": "ISO date string"
  }
  ```
- **Error Responses:**
  - 400: Validation failed
  - 401: Not authenticated
  - 403: Insufficient permissions (attempting to create SUPERUSER without SUPERUSER role)
  - 500: Internal server error

#### Update User
**PUT** `/api/admin/users/:id`
- Updates an existing user account
- Requires: Valid JWT token with ADMIN or SUPERUSER role
- **URL Parameters:**
  - `id`: string (required) - User ID to update
- **Request Body:**
  ```json
  {
    "email": "string (email format, optional)",
    "name": "string (min 1 character, optional)",
    "role": "string (ADMIN|DRIVER|SUPERUSER, optional)",
    "isActive": "boolean (optional)",
    "adminPhone": "string (optional)",
    "adminEmail": "string (email format, optional)",
    "driverPhone": "string (optional)",
    "password": "string (min 6 characters, optional)"
  }
  ```
- **Constraints:**
  - Only SUPERUSER can modify SUPERUSER accounts
  - Only SUPERUSER can grant SUPERUSER role
  - DRIVER role can have empty email (preserves existing or defaults to empty string)
- **Success Response (200):**
  ```json
  {
    "id": "string",
    "email": "string",
    "name": "string",
    "role": "string",
    "isActive": "boolean",
    "adminPhone": "string or null",
    "adminEmail": "string or null",
    "driverPhone": "string or null",
    "createdAt": "ISO date string"
  }
  ```
- **Error Responses:**
  - 400: Validation failed
  - 401: Not authenticated
  - 403: Insufficient permissions
  - 404: User not found
  - 500: Internal server error

#### Delete User
**DELETE** `/api/admin/users/:id`
- Deletes a user account
- Requires: Valid JWT token with ADMIN or SUPERUSER role
- **URL Parameters:**
  - `id`: string (required) - User ID to delete
- **Constraints:**
  - Users cannot delete their own account
  - Only SUPERUSER can delete SUPERUSER accounts
- **Success Response (200):**
  ```json
  {
    "message": "string"
  }
  ```
- **Error Responses:**
  - 400: Bad request (attempting self-deletion)
  - 401: Not authenticated
  - 403: Insufficient permissions
  - 404: User not found
  - 500: Internal server error

### Statistics
**GET** `/api/admin/stats`
- Returns dashboard statistics
- Requires: Valid JWT token with ADMIN or SUPERUSER role
- **Success Response (200):**
  ```json
  {
    "totalDrivers": "integer",
    "totalLocations": "integer",
    "activeCheckIns": "integer",
    "totalCheckIns": "integer"
  }
  ```
- **Error Responses:**
  - 401: Not authenticated
  - 403: Insufficient permissions
  - 500: Internal server error

### SMS Management

#### Send Manual SMS
**POST** `/api/admin/sms/trigger`
- Sends a manual SMS via Twilio and logs the attempt
- Requires: Valid JWT token with ADMIN or SUPERUSER role
- **Request Body:**
  ```json
  {
    "phoneNumber": "string (required, E.164 format)"
  }
  ```
- **Success Response (200):**
  ```json
  {
    "message": "string",
    "data": {
      "sid": "string",
      "dateCreated": "ISO date string",
      "dateUpdated": "ISO date string",
      "dateSent": "ISO date string or null",
      "accountSid": "string",
      "to": "string",
      "from": "string",
      "messagingServiceSid": "string or null",
      "body": "string",
      "status": "string",
      "numSegments": "integer",
      "numMedia": "integer",
      "direction": "string",
      "apiVersion": "string",
      "price": "string or null",
      "priceUnit": "string",
      "errorCode": "string or null",
      "errorMessage": "string or null",
      "uri": "string"
    }
  }
  ```
- **Error Responses:**
  - 400: Missing phoneNumber
  - 401: Not authenticated
  - 403: Insufficient permissions
  - 500: Internal server error or Twilio error

#### List SMS Audit Logs
**GET** `/api/admin/sms-audit`
- Retrieves paginated SMS audit logs with filtering options
- Requires: Valid JWT token with ADMIN or SUPERUSER role
- **Query Parameters:**
  - `page`: integer (optional, default: 1) - Page number
  - `limit`: integer (optional, default: 25, max: 100) - Items per page
  - `recipientPhone`: string (optional) - Filter by recipient phone number
  - `triggerType`: string (optional) - Filter by trigger type
  - `direction`: string (optional) - Filter by direction (inbound/outbound)
- **Success Response (200):**
  ```json
  {
    "data": [
      {
        "id": "string",
        "recipientPhone": "string",
        "messageBody": "string",
        "triggerType": "string",
        "checkInId": "string or null",
        "initiatedByUserId": "string or null",
        "twilioSid": "string or null",
        "twilioStatus": "string or null",
        "error": "string or null",
        "direction": "string (inbound|outbound)",
        "createdAt": "ISO date string",
        "updatedAt": "ISO date string",
        "initiatedBy": {
          "id": "string",
          "name": "string",
          "email": "string"
        } or null,
        "checkIn": {
          "id": "string",
          "driver": {
            "name": "string"
          },
          "location": {
            "name": "string"
          }
        } or null
      }
    ],
    "total": "integer",
    "page": "integer",
    "limit": "integer",
    "totalPages": "integer"
  }
  ```
- **Error Responses:**
  - 401: Not authenticated
  - 403: Insufficient permissions
  - 500: Internal server error

## Locations
**GET** `/api/locations`
- Lists all locations
- No authentication required
- **Success Response (200):**
  ```json
  [
    {
      "id": "string",
      "name": "string",
      "code": "string",
      "isActive": "boolean",
      "createdAt": "ISO date string",
      "updatedAt": "ISO date string"
    }
  ]
  ```
- **Error Responses:**
  - 500: Internal server error

## Webhooks
These endpoints are designed to receive requests from external services (like Twilio) and do not require authentication.

### Twilio Inbound SMS Webhook
**POST** `/api/webhook/twilio/inbound`
- Handles inbound SMS messages from Twilio for driver check-in/check-out via SMS
- **Request Format:** application/x-www-form-urlencoded (standard Twilio webhook format)
- **Form Parameters:**
  - `From`: string (required) - Sender's phone number in E.164 format
  - `Body`: string (required) - Message body
- **Expected Message Format:** "CHECKIN <location_code>" or "CHECKOUT <location_code>"
- **Success Response (200):** TwiML XML response
  ```xml
  <Response>
    <Message>Check-in recorded at Location Name.</Message>
  </Response>
  ```
- **Error Responses (still return 200 to prevent Twilio retries):**
  - Invalid format
  - Phone not recognized
  - Location code not found
  - Daily SMS limit reached

### Twilio Status Callback Webhook
**POST** `/api/webhook/twilio/status`
- Handles status callbacks from Twilio for sent SMS messages
- **Request Format:** application/x-www-form-urlencoded (standard Twilio webhook format)
- **Form Parameters:**
  - `MessageSid`: string (optional) - Unique ID for the message
  - `MessageStatus`: string (optional) - Current status of the message
  - `To`: string (optional) - Recipient's phone number
  - `From`: string (optional) - Sender's phone number
- **Success Response (200):** Plain text "OK"

## Notification Settings (Superuser Only)
**GET** `/api/admin/settings/notifications`
- Retrieves masked notification provider configuration
- Requires: Valid JWT token with SUPERUSER role
- **Success Response (200):**
  ```json
  {
    "emailTenantId": "string or null",
    "emailClientId": "string or null",
    "emailClientSecret": "string or null (masked as '••••••••' if set)",
    "emailFrom": "string or null",
    "twilioAccountSid": "string or null",
    "twilioAuthToken": "string or null (masked as '••••••••' if set)",
    "twilioFromNumber": "string or null"
  }
  ```
- **Error Responses:**
  - 401: Not authenticated
  - 403: Insufficient privileges (requires SUPERUSER)
  - 500: Internal server error

**PUT** `/api/admin/settings/notifications`
- Updates notification provider configuration with encryption
- Requires: Valid JWT token with SUPERUSER role
- **Request Body:** Same structure as GET response
- **Success Response (200):** Masked version of saved settings
- **Error Responses:**
  - 400: Missing encryption key or validation error
  - 401: Not authenticated
  - 403: Insufficient privileges (requires SUPERUSER)
  - 500: Internal server error

## Error Codes
The API uses standard HTTP status codes:

- **400** - Bad Request: Invalid request parameters or missing required fields
- **401** - Unauthorized: Missing or invalid authentication token
- **403** - Forbidden: Authenticated user lacks sufficient permissions
- **404** - Not Found: Requested resource does not exist
- **409** - Conflict: Resource conflict (e.g., duplicate check-in)
- **500** - Internal Server Error: Unexpected server error

## Rate Limiting
The API implements rate limiting to prevent abuse:
- **100 requests per 15 minutes per IP address**
- Exceeding this limit will result in a 429 (Too Many Requests) response

## JWT Usage
Authenticated endpoints require a valid JWT token in the Authorization header:
```
Authorization: Bearer <your_jwt_token_here>
```

Tokens are issued upon successful login and expire after 24 hours.

## Idempotency
Several endpoints support idempotency keys to prevent duplicate operations:
- Check-in (`POST /api/checkin`)
- Check-out (`POST /api/checkin/checkout`)

Provide a unique `idempotencyKey` in the request body to ensure the operation is only performed once, even if the request is retried.

## Default Test Credentials
For testing purposes, the following default users are created during seed:
- **Superuser:** superuser@example.com / super123
- **Admin:** admin@example.com / admin123
- **Driver:** driver@example.com / driver123
