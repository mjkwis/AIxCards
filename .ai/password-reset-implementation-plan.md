# Password Reset Implementation Plan

## 1. Endpoint Overview

**Functionality:** Password reset mechanism for users who have forgotten their password.

**Goal:** Enable users to securely reset their password through email verification using Supabase Auth's built-in mechanism.

**Components:**
1. **Reset request page** (`/reset-password`) - form to enter email
2. **Email with reset link** - automatic email from Supabase with reset token
3. **Password update page** (`/reset-password/confirm`) - form to set new password

**Security:**
- Token valid for **15 minutes**
- Rate limiting: **3 attempts per 15 minutes** (per IP + per email)
- One-time token (invalidated after use)
- Invalidation of all active sessions after password change
- Email notification after password change

**User Stories:** Authentication flow - password recovery

---

## 2. Architecture

### 2.1. User Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ STEP 1: Request password reset                                   │
│ Page: /reset-password                                            │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                    User enters email
                              ↓
            POST /api/auth/password/reset-request
                              ↓
                    ┌─────────────────────┐
                    │ Rate Limit Check    │
                    │ 3 attempts / 15 min │
                    └─────────────────────┘
                              ↓
                    ┌─────────────────────┐
                    │ Supabase Auth       │
                    │ resetPasswordForEmail│
                    └─────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 2: Email with reset link                                    │
│ Link: /reset-password/confirm?token=XYZ                         │
│ Valid for: 15 minutes                                            │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                    User clicks link
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 3: Set new password                                         │
│ Page: /reset-password/confirm?token=XYZ                         │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                    User enters new password
                              ↓
            POST /api/auth/password/update
                              ↓
                    ┌─────────────────────┐
                    │ Password validation │
                    │ (8+ chars, etc.)    │
                    └─────────────────────┘
                              ↓
                    ┌─────────────────────┐
                    │ Supabase Auth       │
                    │ updateUser          │
                    └─────────────────────┘
                              ↓
                    ┌─────────────────────┐
                    │ Invalidate sessions │
                    │ Send notification   │
                    └─────────────────────┘
                              ↓
                    Redirect to /login
```

### 2.2. System Components

#### Frontend (React)
- `ResetPasswordRequestForm.tsx` - reset request form (✅ exists, needs API endpoint update)
- `UpdatePasswordForm.tsx` - new password form (✅ exists, ready to use)

#### Backend (Astro API Routes)
- `POST /api/auth/password/reset-request` - request password reset
- `POST /api/auth/password/update` - update password with token

#### Middleware
- Rate limiting for reset requests
- Token verification (handled by Supabase)

#### Supabase
- `resetPasswordForEmail()` - generate token and send email
- `updateUser()` - update password
- Email templates - configure email appearance

---

## 3. API Endpoints

### 3.1. POST /api/auth/password/reset-request

#### Request Details

**URL:** `/api/auth/password/reset-request`

**Method:** `POST`

**Headers:**
```http
Content-Type: application/json
```

**Note:** No Authorization header required (public endpoint)

**Body:**
```typescript
{
  "email": string  // Valid email address
}
```

**Type:** `ResetPasswordRequestCommand`

**Example:**
```json
{
  "email": "user@example.com"
}
```

#### Parameters

**From Request Body:**

| Parameter | Type   | Required | Validation           | Description           |
|-----------|--------|----------|----------------------|----------------------|
| `email`   | string | Yes      | Valid email, max 255 | User's email address |

#### Validation Schema

```typescript
// src/lib/validation/auth.ts (extend existing)
export const ResetPasswordRequestSchema = z.object({
  email: z
    .string({ required_error: "Email is required" })
    .email("Invalid email format")
    .max(255, "Email is too long")
    .toLowerCase()
    .trim(),
});

export type ResetPasswordRequestInput = z.infer<typeof ResetPasswordRequestSchema>;
```

#### Response Details

**Success (200 OK):**

**Headers:**
```http
Content-Type: application/json
X-RateLimit-Limit: 3
X-RateLimit-Remaining: 2
X-RateLimit-Reset: 1697459100
```

**Body:**
```json
{
  "success": true,
  "message": "If the email exists in our system, we have sent a password reset link"
}
```

**Important:** Always returns 200 OK even if email doesn't exist (prevents email enumeration)

**Error Responses:**

**400 Bad Request - VALIDATION_ERROR:**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid email format",
    "details": {
      "field": "email"
    }
  }
}
```

**429 Too Many Requests - RATE_LIMIT_EXCEEDED:**
```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many password reset attempts. Please try again in 15 minutes.",
    "details": {
      "limit": 3,
      "window_minutes": 15,
      "reset_at": "2025-10-16T12:30:00Z"
    }
  }
}
```

**500 Internal Server Error - INTERNAL_ERROR:**
```json
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "An error occurred. Please try again later.",
    "details": {}
  }
}
```

#### Implementation

**File:** `src/pages/api/auth/password/reset-request.ts`

```typescript
import type { APIContext } from "astro";
import { ResetPasswordRequestSchema } from "../../../../lib/validation/auth";
import { errorResponse } from "../../../../lib/helpers/error-response";
import { Logger } from "../../../../lib/services/logger.service";

const logger = new Logger("POST /api/auth/password/reset-request");

export const prerender = false;

export async function POST(context: APIContext): Promise<Response> {
  try {
    // 1. Get Supabase client
    const supabase = context.locals.supabase;

    if (!supabase) {
      logger.error("Supabase client not available", new Error("No supabase"));
      return errorResponse(500, "INTERNAL_ERROR", "Service configuration error");
    }

    // 2. Parse request body
    let requestBody;
    try {
      requestBody = await context.request.json();
    } catch (error) {
      logger.info("Invalid JSON in request body");
      return errorResponse(400, "VALIDATION_ERROR", "Invalid request format");
    }

    // 3. Validate with Zod
    const validationResult = ResetPasswordRequestSchema.safeParse(requestBody);

    if (!validationResult.success) {
      const firstError = validationResult.error.errors[0];
      logger.info("Validation failed", {
        field: firstError.path.join("."),
        message: firstError.message,
      });

      return errorResponse(400, "VALIDATION_ERROR", firstError.message, {
        field: firstError.path.join("."),
      });
    }

    const { email } = validationResult.data;

    logger.info("Processing password reset request", { email });

    // 4. Call Supabase resetPasswordForEmail
    // IMPORTANT: This will ALWAYS return success, even if email doesn't exist
    // This prevents email enumeration attacks
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${import.meta.env.SITE_URL || "http://localhost:3000"}/reset-password/confirm`,
    });

    // 5. Handle Supabase errors (but still return success to user)
    if (error) {
      logger.error("Supabase resetPasswordForEmail error", error as Error, { email });
      // Still return success to user for security
    } else {
      logger.info("Password reset email sent (if user exists)", { email });
    }

    // 6. Always return success (security: don't reveal if email exists)
    return new Response(
      JSON.stringify({
        success: true,
        message: "If the email exists in our system, we have sent a password reset link",
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    logger.critical("Unexpected error in password reset request", error as Error);
    return errorResponse(500, "INTERNAL_ERROR", "An error occurred. Please try again later.");
  }
}
```

---

### 3.2. POST /api/auth/password/update

#### Request Details

**URL:** `/api/auth/password/update`

**Method:** `POST`

**Headers:**
```http
Content-Type: application/json
Authorization: Bearer {access_token_from_reset_link}
```

**Note:** Token is automatically available after clicking reset link (Supabase handles this)

**Body:**
```typescript
{
  "password": string  // New password (min 8 chars, uppercase, lowercase, number)
}
```

**Type:** `UpdatePasswordCommand`

**Example:**
```json
{
  "password": "NewSecurePass123"
}
```

#### Parameters

**From Request Body:**

| Parameter  | Type   | Required | Validation                               | Description   |
|------------|--------|----------|------------------------------------------|---------------|
| `password` | string | Yes      | Min 8 chars, uppercase, lowercase, digit | New password  |

#### Validation Schema

```typescript
// src/lib/validation/auth.ts (extend existing)
export const UpdatePasswordSchema = z.object({
  password: z
    .string({ required_error: "Password is required" })
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password cannot exceed 128 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
});

export type UpdatePasswordInput = z.infer<typeof UpdatePasswordSchema>;
```

#### Response Details

**Success (200 OK):**

**Body:**
```json
{
  "success": true,
  "message": "Password has been successfully updated"
}
```

**Error Responses:**

**401 Unauthorized - UNAUTHORIZED:**
```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Reset link has expired or is invalid",
    "details": {}
  }
}
```

**400 Bad Request - VALIDATION_ERROR:**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Password must be at least 8 characters",
    "details": {
      "field": "password"
    }
  }
}
```

**500 Internal Server Error - INTERNAL_ERROR:**
```json
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Failed to update password",
    "details": {}
  }
}
```

#### Implementation

**File:** `src/pages/api/auth/password/update.ts`

```typescript
import type { APIContext } from "astro";
import { UpdatePasswordSchema } from "../../../../lib/validation/auth";
import { errorResponse } from "../../../../lib/helpers/error-response";
import { Logger } from "../../../../lib/services/logger.service";

const logger = new Logger("POST /api/auth/password/update");

export const prerender = false;

export async function POST(context: APIContext): Promise<Response> {
  try {
    // 1. Get Supabase client
    const supabase = context.locals.supabase;

    if (!supabase) {
      logger.error("Supabase client not available", new Error("No supabase"));
      return errorResponse(500, "INTERNAL_ERROR", "Service configuration error");
    }

    // 2. Check if user is authenticated (from reset token)
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      logger.warning("Unauthorized password update attempt", { error: authError?.message });
      return errorResponse(401, "UNAUTHORIZED", "Reset link has expired or is invalid");
    }

    // 3. Parse request body
    let requestBody;
    try {
      requestBody = await context.request.json();
    } catch (error) {
      logger.info("Invalid JSON in request body");
      return errorResponse(400, "VALIDATION_ERROR", "Invalid request format");
    }

    // 4. Validate with Zod
    const validationResult = UpdatePasswordSchema.safeParse(requestBody);

    if (!validationResult.success) {
      const firstError = validationResult.error.errors[0];
      logger.info("Validation failed", {
        userId: user.id,
        field: firstError.path.join("."),
        message: firstError.message,
      });

      return errorResponse(400, "VALIDATION_ERROR", firstError.message, {
        field: firstError.path.join("."),
      });
    }

    const { password } = validationResult.data;

    logger.info("Processing password update", { userId: user.id, email: user.email });

    // 5. Update password via Supabase
    const { error: updateError } = await supabase.auth.updateUser({
      password,
    });

    if (updateError) {
      logger.error("Failed to update password", updateError as Error, {
        userId: user.id,
        email: user.email,
      });
      return errorResponse(500, "INTERNAL_ERROR", "Failed to update password");
    }

    logger.info("Password updated successfully", {
      userId: user.id,
      email: user.email,
    });

    // 6. Sign out all sessions for security
    // This forces user to login again with new password
    await supabase.auth.signOut({ scope: "global" });

    logger.info("All sessions invalidated after password change", { userId: user.id });

    // 7. Return success
    return new Response(
      JSON.stringify({
        success: true,
        message: "Password has been successfully updated",
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    logger.critical("Unexpected error in password update", error as Error);
    return errorResponse(500, "INTERNAL_ERROR", "An error occurred. Please try again later.");
  }
}
```

---

## 4. Data Flow

### 4.1. Password Reset Request Flow

```
Client Request
      ↓
[1] Middleware
      ├─→ Rate limiting check (IP + email)
      ├─→ 3 attempts per 15 minutes
      └─→ Parse request body for email
      ↓
[2] API Route Handler (POST /api/auth/password/reset-request)
      ├─→ Parse request body
      └─→ Validate with Zod schema
      ↓
[3] Supabase Auth
      ├─→ resetPasswordForEmail()
      ├─→ Generate secure token
      ├─→ Store token (expires in 15 min)
      └─→ Send email with link
      ↓
[4] Format Response
      └─→ Always return success (security)
      ↓
Client Response (200 OK)
```

### 4.2. Password Update Flow

```
Client Request (with token in URL)
      ↓
[1] Supabase Client-Side
      ├─→ Extract token from URL hash
      ├─→ Exchange token for session
      └─→ Store session temporarily
      ↓
[2] API Route Handler (POST /api/auth/password/update)
      ├─→ Verify user session (from token)
      ├─→ Parse request body
      └─→ Validate password with Zod
      ↓
[3] Supabase Auth
      ├─→ updateUser({ password })
      ├─→ Hash new password (bcrypt)
      └─→ Update auth.users table
      ↓
[4] Session Management
      ├─→ Sign out all sessions (scope: global)
      └─→ Invalidate refresh tokens
      ↓
[5] Format Response
      └─→ Return success message
      ↓
Client Response (200 OK)
      ↓
Redirect to /login
```

---

## 5. Security Considerations

### 5.1. Token Security

**Token Validity:** 15 minutes
- **Rationale:** Balance between UX and security
- **Standard:** Used by GitHub, GitLab, most services
- **Implementation:** Configured in Supabase dashboard

**One-time Token:**
- Token is automatically invalidated by Supabase after use
- Cannot be reused
- Prevents replay attacks

**Token Format:**
- Generated by Supabase (cryptographically secure)
- Stored as hash in database
- Cannot be guessed or brute-forced

### 5.2. Rate Limiting

**Strategy:** IP + Email combination

**Configuration:**
- **3 attempts** per 15 minutes
- **Per IP + Email** (double protection)

**Rationale:**
- 3 attempts allows for typos
- 15 minutes discourages attackers without frustrating users
- IP + Email combination prevents:
  - Targeted account attacks (per email)
  - Distributed attacks (per IP)

**Implementation:**
```typescript
const rateLimitKey = `rate_limit:password_reset:${clientIp}:${normalizedEmail}`;
```

### 5.3. Email Enumeration Protection

**Problem:** Attackers can check if email exists in system

**Solution:**
- Always return 200 OK with same message
- Don't reveal whether email exists
- Email sent only if account exists (handled by Supabase)

**Message:**
```
"If the email exists in our system, we have sent a password reset link"
```

### 5.4. Session Invalidation

**Strategy:** Invalidate all sessions after password change

**Implementation:**
```typescript
await supabase.auth.signOut({ scope: 'global' });
```

**Rationale:**
- Forces logout on all devices
- Prevents access from potentially compromised sessions
- User must login again with new password

**UX:**
- User is informed about logout
- Redirect to /login with success message

### 5.5. Password Validation

**Requirements:**
- Minimum 8 characters
- At least one uppercase letter (A-Z)
- At least one lowercase letter (a-z)
- At least one digit (0-9)
- Maximum 128 characters (DoS prevention)

**Same requirements as registration**

### 5.6. Additional Security Measures

**Email Notification:**
```
Subject: Password Changed
Body: 
Your password for 10xCards has been changed.
If this wasn't you, please contact us immediately.
```

**Logging:**
```typescript
// Log successful password resets
logger.info("Password reset successful", { 
  userId: user.id, 
  email: user.email,
  timestamp: new Date()
});

// Log failed attempts
logger.warning("Failed password reset attempt", {
  email,
  reason: "invalid_token"
});
```

**Monitoring:**
- Track number of resets per user
- Alert on unusual reset volume
- Detect attack patterns

---

## 6. Rate Limiting Implementation

### 6.1. RateLimitService Extension

**File:** `src/lib/services/rate-limit.service.ts` (extend existing)

```typescript
export class RateLimitService {
  // ... existing code ...

  /**
   * Check password reset rate limit
   * 3 attempts per 15 minutes per IP+Email
   */
  async checkPasswordResetRateLimit(ip: string, email: string): Promise<void> {
    const key = `rate_limit:password_reset:${ip}:${email}`;
    const limit = 3;
    const windowMs = 900000; // 15 minutes
    const now = new Date();

    const entry = this.store.get(key);

    if (!entry || entry.resetAt < now) {
      this.store.set(key, {
        count: 1,
        resetAt: new Date(now.getTime() + windowMs),
      });
      return;
    }

    if (entry.count >= limit) {
      throw new RateLimitError(entry.resetAt);
    }

    entry.count++;
    this.store.set(key, entry);
  }

  getRemainingPasswordReset(ip: string, email: string): number {
    const key = `rate_limit:password_reset:${ip}:${email}`;
    const entry = this.store.get(key);

    if (!entry || entry.resetAt < new Date()) {
      return 3;
    }

    return Math.max(0, 3 - entry.count);
  }
}
```

### 6.2. Middleware Update

**File:** `src/middleware/index.ts` (extend existing)

```typescript
export const onRequest = defineMiddleware(async (context, next) => {
  // ... existing Supabase init code ...

  const pathname = context.url.pathname;
  const method = context.request.method;

  // Handle password reset request endpoint
  if (pathname === "/api/auth/password/reset-request" && method === "POST") {
    const clientIp = getClientIp(context.request);

    // Parse body to get email for rate limiting
    let email = "";
    try {
      const bodyText = await context.request.text();
      const body = JSON.parse(bodyText);
      email = body.email?.toLowerCase() || "";

      // Restore body for route handler
      context.request = new Request(context.request.url, {
        method: context.request.method,
        headers: context.request.headers,
        body: bodyText,
      });
    } catch (e) {
      // Invalid JSON - let route handler deal with it
    }

    if (email) {
      try {
        await rateLimitService.checkPasswordResetRateLimit(clientIp, email);

        const remaining = rateLimitService.getRemainingPasswordReset(clientIp, email);
        context.locals.rateLimitRemaining = remaining;
      } catch (error) {
        if (error instanceof RateLimitError) {
          return errorResponse(
            429,
            "RATE_LIMIT_EXCEEDED",
            "Too many password reset attempts. Please try again in 15 minutes.",
            {
              limit: 3,
              window_minutes: 15,
              reset_at: error.resetAt.toISOString(),
            }
          );
        }
        throw error;
      }
    }
  }

  // ... rest of middleware ...
});
```

---

## 7. Frontend Implementation

### 7.1. Pages

#### /reset-password

**Status:** ✅ Already exists

**File:** `src/pages/reset-password.astro`

**Modifications:** None required (already properly configured)

**Functionality:**
- Displays `ResetPasswordRequestForm`
- Redirects logged-in users to dashboard
- Dev mode redirects to dashboard (Supabase email requires production)

#### /reset-password/confirm

**Status:** ❌ Needs creation

**File:** `src/pages/reset-password/confirm.astro`

```astro
---
/**
 * Reset Password Confirmation Page
 *
 * Page for setting a new password after clicking reset link
 * The token is automatically extracted from URL and used by Supabase
 */

import PublicLayout from "@/layouts/PublicLayout.astro";
import { UpdatePasswordForm } from "@/components/auth/UpdatePasswordForm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// DEV MODE: Show dev message
const isDev = import.meta.env.DEV;
---

<PublicLayout 
  title="Set New Password - 10xCards" 
  description="Set a new password for your 10xCards account"
>
  <div class="container mx-auto px-4 py-16">
    <div class="max-w-md mx-auto">
      <div class="text-center mb-8">
        <h1 class="text-3xl font-bold mb-2">Set New Password</h1>
        <p class="text-muted-foreground">Choose a strong password for your account</p>
      </div>

      <div data-react-root>
        {
          isDev ? (
            <Card>
              <CardContent class="py-8">
                <div class="text-center space-y-4">
                  <div class="mx-auto w-12 h-12 rounded-full bg-yellow-100 dark:bg-yellow-900/20 flex items-center justify-center">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      class="text-yellow-600 dark:text-yellow-400"
                    >
                      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                      <line x1="12" y1="9" x2="12" y2="13" />
                      <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                  </div>

                  <div>
                    <h3 class="font-semibold text-lg mb-2">Development Mode</h3>
                    <p class="text-sm text-muted-foreground">
                      Password reset requires email configuration in Supabase.
                    </p>
                    <p class="text-sm text-muted-foreground mt-2">
                      Use production environment to test this feature.
                    </p>
                  </div>

                  <Button variant="outline" onClick="window.location.href='/login'">
                    Back to Login
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>New Password</CardTitle>
                <CardDescription>Enter your new password</CardDescription>
              </CardHeader>
              <CardContent>
                <UpdatePasswordForm client:load />
              </CardContent>
            </Card>
          )
        }
      </div>
    </div>
  </div>
</PublicLayout>
```

### 7.2. Components

#### ResetPasswordRequestForm

**Status:** ✅ Already exists

**File:** `src/components/auth/ResetPasswordRequestForm.tsx`

**Required Modifications:**

Change API endpoint from `/auth/password/reset` to `/auth/password/reset-request`:

```typescript
// Line 41
await apiClient.post("/auth/password/reset-request", { email: data.email });
```

#### UpdatePasswordForm

**Status:** ✅ Already exists

**File:** `src/components/auth/UpdatePasswordForm.tsx`

**Modifications:** None required (already properly configured)

---

## 8. Supabase Configuration

### 8.1. Email Template Configuration

**Location:** Supabase Dashboard → Authentication → Email Templates

**Template:** "Reset Password"

**Default Template:**
```html
<h2>Reset Your Password</h2>
<p>We received a request to reset the password for your 10xCards account.</p>
<p>Click the link below to set a new password:</p>
<p><a href="{{ .ConfirmationURL }}">Reset Password</a></p>
<p>This link is valid for 15 minutes.</p>
<p>If you didn't request a password reset, please ignore this email.</p>
```

**Configuration in Supabase:**

1. Dashboard → Authentication → Email Templates
2. Select "Change Email / Reset Password"
3. Customize template (optional)
4. Set **"Expire After"**: `900` seconds (15 minutes)
5. Set **"Redirect URL"**: `{{ .SiteURL }}/reset-password/confirm`

### 8.2. Auth Settings

**Location:** Supabase Dashboard → Authentication → Settings

**Configuration:**

```yaml
Site URL: http://localhost:3000 (dev) / https://your-domain.com (prod)
Redirect URLs:
  - http://localhost:3000/reset-password/confirm
  - https://your-domain.com/reset-password/confirm

JWT Settings:
  JWT Expiry: 3600 (1 hour)
  
Password Reset:
  Token Expiry: 900 seconds (15 minutes)
  Rate Limit: Handled by our middleware
```

---

## 9. Error Handling

### 9.1. Error Categories

#### Reset Request Errors

| Code | Status | Scenario | User Message |
|------|--------|----------|--------------|
| VALIDATION_ERROR | 400 | Invalid email format | "Invalid email format" |
| RATE_LIMIT_EXCEEDED | 429 | Exceeded attempt limit | "Too many password reset attempts. Please try again in 15 minutes." |
| INTERNAL_ERROR | 500 | Supabase error | "An error occurred. Please try again later." |

#### Password Update Errors

| Code | Status | Scenario | User Message |
|------|--------|----------|--------------|
| UNAUTHORIZED | 401 | Token expired/invalid | "Reset link has expired or is invalid" |
| VALIDATION_ERROR | 400 | Weak password | "Password must be at least 8 characters" (or other requirement) |
| INTERNAL_ERROR | 500 | Update failed | "Failed to update password" |

### 9.2. Error Handling Pattern

**In Route Handlers:**
```typescript
try {
  // Main logic
} catch (error) {
  // Specific errors
  if (error instanceof SpecificError) {
    return errorResponse(...);
  }
  
  // Generic fallback
  logger.critical("Unexpected error", error);
  return errorResponse(500, "INTERNAL_ERROR", "...");
}
```

---

## 10. Testing

### 10.1. Unit Tests

**File:** `tests/lib/validation/auth.test.ts`

```typescript
describe("ResetPasswordRequestSchema", () => {
  it("should accept valid email", () => {
    const result = ResetPasswordRequestSchema.safeParse({
      email: "user@example.com",
    });
    expect(result.success).toBe(true);
  });

  it("should reject invalid email", () => {
    const result = ResetPasswordRequestSchema.safeParse({
      email: "invalid-email",
    });
    expect(result.success).toBe(false);
  });

  it("should normalize email to lowercase", () => {
    const result = ResetPasswordRequestSchema.safeParse({
      email: "USER@EXAMPLE.COM",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("user@example.com");
    }
  });
});

describe("UpdatePasswordSchema", () => {
  it("should accept valid password", () => {
    const result = UpdatePasswordSchema.safeParse({
      password: "SecurePass123",
    });
    expect(result.success).toBe(true);
  });

  it("should reject weak password", () => {
    const result = UpdatePasswordSchema.safeParse({
      password: "weak",
    });
    expect(result.success).toBe(false);
  });

  it("should reject password without uppercase", () => {
    const result = UpdatePasswordSchema.safeParse({
      password: "securepass123",
    });
    expect(result.success).toBe(false);
  });
});
```

### 10.2. Integration Tests

**File:** `tests/api/auth/password-reset.test.ts`

```typescript
describe("POST /api/auth/password/reset-request", () => {
  it("should return 200 for valid email", async () => {
    const response = await fetch("/api/auth/password/reset-request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "user@example.com" }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
  });

  it("should return 200 even for non-existent email (security)", async () => {
    const response = await fetch("/api/auth/password/reset-request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "nonexistent@example.com" }),
    });

    expect(response.status).toBe(200);
  });

  it("should enforce rate limiting", async () => {
    const email = "ratelimit@example.com";

    // Make 3 requests
    for (let i = 0; i < 3; i++) {
      await fetch("/api/auth/password/reset-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
    }

    // 4th request should be rate limited
    const response = await fetch("/api/auth/password/reset-request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    expect(response.status).toBe(429);
    const data = await response.json();
    expect(data.error.code).toBe("RATE_LIMIT_EXCEEDED");
  });
});

describe("POST /api/auth/password/update", () => {
  it("should return 401 without valid token", async () => {
    const response = await fetch("/api/auth/password/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "NewSecure123" }),
    });

    expect(response.status).toBe(401);
  });
});
```

### 10.3. Manual Testing Checklist

**Reset Request Flow:**
- [ ] Send request with valid email → 200 OK
- [ ] Send request with invalid email format → 400
- [ ] Send request with non-existent email → 200 OK (security)
- [ ] Email received (if account exists)
- [ ] Email not received (if account doesn't exist)
- [ ] Rate limiting works (3 attempts, 4th → 429)
- [ ] Toast confirmation always displays

**Password Update Flow:**
- [ ] Click link → redirect to /reset-password/confirm
- [ ] Form displays
- [ ] Password validation works (real-time feedback)
- [ ] Weak password → validation error
- [ ] Strong password → success
- [ ] Redirect to /login after success
- [ ] All sessions logged out
- [ ] Can login with new password

**Edge Cases:**
- [ ] Expired link (> 15 minutes) → 401 error
- [ ] Link used twice → 401 error
- [ ] Invalid token → 401 error
- [ ] No token → 401 error

**Security:**
- [ ] Email enumeration impossible (always 200 OK)
- [ ] Rate limiting effective
- [ ] Token is one-time use
- [ ] Token expires after 15 minutes
- [ ] Sessions invalidated after password change

---

## 11. Deployment

### 11.1. Environment Variables

**Development:**
```env
SUPABASE_URL=your_dev_supabase_url
SUPABASE_KEY=your_dev_supabase_anon_key
SITE_URL=http://localhost:3000
NODE_ENV=development
```

**Production:**
```env
SUPABASE_URL=your_prod_supabase_url
SUPABASE_KEY=your_prod_supabase_anon_key
SITE_URL=https://your-domain.com
NODE_ENV=production
```

### 11.2. Deployment Checklist

**Pre-deployment:**
- [ ] All tests passing
- [ ] Environment variables set
- [ ] Supabase configured
- [ ] Email templates customized
- [ ] Rate limiting tested
- [ ] Code review completed

**Production:**
- [ ] Deploy to staging
- [ ] Smoke tests on staging
- [ ] Email delivery test
- [ ] Token expiration test
- [ ] Deploy to production
- [ ] Monitor error rates

**Post-deployment:**
- [ ] Monitor reset request rate
- [ ] Monitor email delivery rate
- [ ] Monitor password update success rate
- [ ] Alert on rate limit hits
- [ ] Collect user feedback

---

## 12. Monitoring & Metrics

### 12.1. Key Metrics

**Reset Request Metrics:**
- Reset requests per hour/day
- Reset success rate (email sent)
- Rate limit hit rate
- Email delivery rate

**Password Update Metrics:**
- Password updates per day
- Update success rate
- Token expiration rate (users clicking expired links)
- Failed validation rate

**Security Metrics:**
- Rate limit violations per IP
- Email enumeration attempts
- Invalid token attempts
- Multiple reset attempts per account

### 12.2. Logging Strategy

**Success Logs:**
```typescript
logger.info("Password reset requested", { email, ip });
logger.info("Password reset email sent", { email });
logger.info("Password updated successfully", { userId, email });
```

**Warning Logs:**
```typescript
logger.warning("Rate limit hit", { email, ip, attempts });
logger.warning("Invalid reset token", { userId, email });
logger.warning("Expired reset token", { userId, email });
```

**Error Logs:**
```typescript
logger.error("Failed to send reset email", error, { email });
logger.error("Failed to update password", error, { userId });
```

### 12.3. Alerts

**Critical Alerts:**
- Password reset failure rate > 10%
- Email delivery failure rate > 5%
- Rate limit hit rate > 20 per hour

**Warning Alerts:**
- Unusual spike in reset requests
- Multiple resets for same account
- High token expiration rate

---

## 13. Implementation Steps

### Phase 1: Backend Implementation

1. **Extend validation schemas** (`src/lib/validation/auth.ts`)
   - Add `ResetPasswordRequestSchema`
   - Add `UpdatePasswordSchema`

2. **Extend RateLimitService** (`src/lib/services/rate-limit.service.ts`)
   - Add `checkPasswordResetRateLimit()`
   - Add `getRemainingPasswordReset()`

3. **Update middleware** (`src/middleware/index.ts`)
   - Add rate limiting for password reset endpoint
   - Handle body parsing for email extraction

4. **Create API endpoints**
   - Create `src/pages/api/auth/password/reset-request.ts`
   - Create `src/pages/api/auth/password/update.ts`

### Phase 2: Frontend Implementation

1. **Create confirmation page**
   - Create `src/pages/reset-password/confirm.astro`

2. **Update ResetPasswordRequestForm**
   - Change API endpoint URL to `/auth/password/reset-request`

3. **Verify UpdatePasswordForm**
   - Ensure it's using correct API endpoint

### Phase 3: Supabase Configuration

1. **Configure email templates**
   - Customize reset password email
   - Set token expiry to 900 seconds

2. **Configure auth settings**
   - Add redirect URLs
   - Verify site URL

### Phase 4: Testing

1. **Write unit tests**
   - Validation schema tests
   - Service method tests

2. **Write integration tests**
   - API endpoint tests
   - Rate limiting tests

3. **Manual testing**
   - Complete manual testing checklist
   - Test email delivery
   - Test token expiration

### Phase 5: Deployment

1. **Deploy to staging**
   - Run smoke tests
   - Test email delivery

2. **Deploy to production**
   - Monitor error rates
   - Monitor metrics

---

## 14. Future Enhancements

### Short-term (Next Sprint)

1. **Email Confirmation Notification**
   - Send email after password change
   - "Your password has been changed"
   - Link to contact if not the user

2. **Better Email Templates**
   - Branded design
   - Mobile-responsive
   - Clear CTA buttons

3. **Security Questions (optional)**
   - Additional verification layer
   - Before sending reset link

### Long-term

1. **SMS Reset Option**
   - Alternative to email
   - For users without email access

2. **Account Recovery Flow**
   - If user has no email access
   - Support ticket system

3. **Password History**
   - Prevent reuse of old passwords
   - Store hash of last 5 passwords

4. **Passwordless Authentication**
   - Magic links
   - WebAuthn/FIDO2

5. **Advanced Analytics**
   - Password reset funnel analysis
   - Drop-off points
   - Success rate by email provider

---

## 15. Additional Notes

### Key Design Decisions

1. **Token valid for 15 minutes**
   - Sweet spot between UX and security
   - Industry standard

2. **Rate limit 3/15min**
   - Prevents abuse
   - Tolerant enough for users

3. **Always 200 OK for reset request**
   - Prevents email enumeration
   - Better security at cost of slight UX degradation

4. **Global session invalidation**
   - Forces logout on all devices
   - Maximum security

5. **Supabase native flow**
   - Leverage built-in mechanism
   - Less custom code = fewer bugs
   - Automatic token handling

### Known Limitations

1. **Email delivery dependency**
   - Depends on Supabase email provider
   - Doesn't work in dev mode (requires production)

2. **15-minute window**
   - May be too short for some users
   - Trade-off: security vs UX

3. **No SMS option**
   - Email-only recovery
   - Consider for future

4. **In-memory rate limiting**
   - Resets on server restart
   - Migrate to Redis in production

### Troubleshooting

**Problem:** Emails not arriving

**Solution:**
- Check Supabase email logs
- Verify SMTP configuration
- Check spam folders
- Consider custom SMTP provider

**Problem:** Token expires too quickly

**Solution:**
- Increase in Supabase config (max 24h)
- Current 15min is recommended

**Problem:** Rate limiting too restrictive

**Solution:**
- Increase limit or window
- Current 3/15min is recommended minimum

---

**Author:** AI Assistant  
**Date:** 2025-10-16  
**Version:** 1.0  
**Status:** Ready for Implementation  
**Related Endpoints:** POST /api/auth/login, POST /api/auth/register
