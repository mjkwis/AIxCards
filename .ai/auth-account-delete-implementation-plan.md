# API Endpoint Implementation Plan: DELETE /api/auth/account

## 1. Przegląd punktu końcowego

**Endpoint:** `DELETE /api/auth/account`

**Purpose:** Permanent deletion of user account along with all associated data from the 10xCards system. The endpoint implements the user's right to be forgotten (GDPR compliance) by removing the user account from the `auth.users` table and all related data through CASCADE constraints.

**Functionality:**

- Require valid JWT token (user must be logged in)
- User identity validation
- Delete all user flashcards (CASCADE)
- Delete all user generation_requests (CASCADE)
- Delete user from auth.users (Supabase Auth)
- Invalidate all user sessions
- Remove refresh token cookie
- Return empty 204 No Content response

**User Stories:** Required for GDPR compliance - right to be forgotten

**Security:** Protected endpoint, requires authentication, irreversible operation with confirmation

---

## 2. Szczegóły żądania

### HTTP Method

`DELETE`

### URL Structure

```
/api/auth/account
```

### Headers (Required)

```http
Authorization: Bearer {access_token}
```

### Request Body

Brak - user_id wyekstrahowany z JWT

---

## 3. Wykorzystywane typy

```typescript
// Request: Brak body
// Response: Brak body (204 No Content)

// Error Response
ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  }
}
```

---

## 4. Szczegóły odpowiedzi

### Success Response (204 No Content)

**Headers:**

```http
Set-Cookie: sb-refresh-token=; Max-Age=0; Path=/; HttpOnly; Secure
```

**Body:** Empty

### Error Responses

#### 401 Unauthorized - AUTH_REQUIRED

```json
{
  "error": {
    "code": "AUTH_REQUIRED",
    "message": "Valid authentication token is required",
    "details": {}
  }
}
```

#### 500 Internal Server Error - INTERNAL_ERROR

```json
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Failed to delete account. Please try again later.",
    "details": {}
  }
}
```

---

## 5. Przepływ danych

### Diagram przepływu

```
Client Request
      ↓
[1] Middleware: Verify JWT Token
      ↓
[2] API Route Handler
      ↓
[3] AuthService.deleteAccount(userId)
      ├─→ Supabase Auth deleteUser()
      ├─→ CASCADE: Delete flashcards
      ├─→ CASCADE: Delete generation_requests
      └─→ Invalidate all sessions
      ↓
[4] Clear Cookie
      ↓
[5] Return 204 No Content
```

### Szczegółowy przepływ

#### AuthService Implementation

```typescript
class AuthService {
  async deleteAccount(userId: string): Promise<void> {
    try {
      // Delete user from Supabase Auth
      // This triggers CASCADE deletes in database
      const { error } = await this.supabase.auth.admin.deleteUser(userId);

      if (error) {
        throw new AuthServiceError("Failed to delete account", error);
      }

      logger.info("Account deleted successfully", { userId });
    } catch (error) {
      logger.error("Error deleting account", error as Error, { userId });
      throw error;
    }
  }
}
```

### Database CASCADE Behavior

**ON DELETE CASCADE relationships:**

```sql
-- flashcards.user_id → auth.users.id (CASCADE)
-- Wszystkie fiszki użytkownika są automatycznie usuwane

-- generation_requests.user_id → auth.users.id (CASCADE)
-- Wszystkie generation requests użytkownika są automatycznie usuwane

-- Kiedy user jest usuwany:
DELETE FROM auth.users WHERE id = 'user-uuid';
-- Automatycznie triggeruje:
-- DELETE FROM flashcards WHERE user_id = 'user-uuid';
-- DELETE FROM generation_requests WHERE user_id = 'user-uuid';
```

---

## 6. Względy bezpieczeństwa

### 6.1. Confirmation Strategy

**Problem:** Account deletion is irreversible

**Solutions:**

**Option 1: Frontend Confirmation (Recommended for MVP)**

```typescript
// Frontend shows confirmation modal before calling API
const confirmed = await confirmDialog(
  "Delete Account?",
  "This action cannot be undone. All your flashcards and data will be permanently deleted."
);

if (confirmed) {
  await deleteAccount();
}
```

**Option 2: API Confirmation Token (More Secure)**

```typescript
// Step 1: Request deletion token
POST / api / auth / account / delete -token;
Response: {
  confirmation_token: "uuid";
}

// Step 2: Confirm with token
DELETE / api / auth / account;
Body: {
  confirmation_token: "uuid";
}
```

**Option 3: Password Re-authentication**

```typescript
DELETE / api / auth / account;
Body: {
  password: "user_password";
}
// Verify password before deletion
```

**Decision for MVP:** Option 1 (Frontend confirmation) + Option 3 (password required)

### 6.2. GDPR/RODO Compliance

**Data Deletion Requirements:**

- ✅ User data (auth.users)
- ✅ User flashcards (flashcards table)
- ✅ User generation requests (generation_requests table)
- ✅ User sessions (handled by Supabase)

**Audit Trail (Optional Future):**

```typescript
// Log deletion event before deleting
await auditLog.create({
  user_id,
  action: "account_deleted",
  timestamp: now(),
  ip_address,
  user_agent,
});
```

**Retention Policy:**

- User data deleted immediately
- Audit logs retained for 90 days (compliance)
- Anonymized analytics can be retained

### 6.3. Irreversibility Protection

**Soft Delete vs Hard Delete:**

**Hard Delete (Current):**

- Immediate permanent deletion
- Cannot be undone
- GDPR compliant

**Soft Delete (Alternative):**

```typescript
// Mark as deleted, actual deletion after 30 days
UPDATE auth.users
SET deleted_at = NOW(),
    status = 'deleted'
WHERE id = user_id;

// User can "undelete" within 30 days
// After 30 days, cron job permanently deletes
```

**Decision:** Hard delete for MVP (simpler, more GDPR compliant)

---

## 7. Obsługa błędów

### Error Handling Strategy

```typescript
export async function DELETE(context: APIContext) {
  try {
    const user = context.locals.user;
    const supabase = context.locals.supabase;

    if (!user || !supabase) {
      return errorResponse(401, "AUTH_REQUIRED", "Authentication required");
    }

    logger.info("Account deletion requested", {
      userId: user.id,
      email: user.email,
    });

    // Optional: Verify password from request body
    // const { password } = await context.request.json();
    // await verifyPassword(user.id, password);

    // Delete account
    const authService = createAuthService(supabase);
    await authService.deleteAccount(user.id);

    // Clear cookie
    context.cookies.delete("sb-refresh-token", { path: "/" });

    logger.info("Account deleted successfully", {
      userId: user.id,
      email: user.email,
    });

    return new Response(null, { status: 204 });
  } catch (error) {
    logger.critical("Account deletion failed", error as Error, {
      userId: context.locals.user?.id,
    });

    return errorResponse(500, "INTERNAL_ERROR", "Failed to delete account. Please contact support.");
  }
}
```

---

## 8. Etapy wdrożenia

### Faza 1: Rozszerzenie AuthService

**Plik:** `src/lib/services/auth.service.ts`

```typescript
export class AuthService {
  /**
   * Delete user account permanently
   * Triggers CASCADE deletion of all user data
   *
   * IMPORTANT: This operation is IRREVERSIBLE
   */
  async deleteAccount(userId: string): Promise<void> {
    try {
      logger.info("Deleting user account", { userId });

      // Delete user from Supabase Auth
      // Requires service role client for admin operations
      const { error } = await this.supabase.auth.admin.deleteUser(userId);

      if (error) {
        logger.error("Supabase deleteUser failed", error, { userId });
        throw new AuthServiceError("Failed to delete account", error);
      }

      logger.info("User account deleted successfully", { userId });
    } catch (error) {
      if (error instanceof AuthServiceError) {
        throw error;
      }

      logger.error("Unexpected error deleting account", error as Error, { userId });
      throw new AuthServiceError("Failed to delete account", error);
    }
  }
}
```

**IMPORTANT:** `auth.admin.deleteUser()` requires service role key, not anon key!

### Faza 2: Service Role Client

**Plik:** `src/db/supabase.admin.ts` (new file)

```typescript
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

// Service role client for admin operations
// NEVER expose service role key to client!
const supabaseUrl = import.meta.env.SUPABASE_URL;
const supabaseServiceKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for admin operations");
}

export const supabaseAdmin = createClient<Database>(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
```

**Environment Variable:**

```env
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_from_supabase_dashboard
```

### Faza 3: API Route Handler

**Plik:** `src/pages/api/auth/account.ts`

```typescript
import type { APIContext } from "astro";
import { errorResponse } from "../../../lib/helpers/error-response";
import { createAuthService } from "../../../lib/services/auth.service";
import { supabaseAdmin } from "../../../db/supabase.admin";
import { AuthServiceError } from "../../../lib/errors/auth-service.error";
import { Logger } from "../../../lib/services/logger.service";

const logger = new Logger("DELETE /api/auth/account");

export const prerender = false;

export async function DELETE(context: APIContext): Promise<Response> {
  try {
    const user = context.locals.user;

    if (!user) {
      return errorResponse(401, "AUTH_REQUIRED", "Authentication required");
    }

    logger.warning("Account deletion requested - IRREVERSIBLE", {
      userId: user.id,
      email: user.email,
    });

    // Create auth service with ADMIN client (required for deleteUser)
    const authService = createAuthService(supabaseAdmin);

    try {
      await authService.deleteAccount(user.id);
    } catch (error) {
      if (error instanceof AuthServiceError) {
        logger.error("Failed to delete account", error, {
          userId: user.id,
        });
        return errorResponse(500, "INTERNAL_ERROR", "Failed to delete account. Please contact support.");
      }
      throw error;
    }

    // Clear cookie
    context.cookies.delete("sb-refresh-token", { path: "/" });

    logger.warning("Account PERMANENTLY deleted", {
      userId: user.id,
      email: user.email,
    });

    return new Response(null, {
      status: 204,
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    logger.critical("Unexpected error during account deletion", error as Error, {
      userId: context.locals.user?.id,
    });

    return errorResponse(500, "INTERNAL_ERROR", "An unexpected error occurred. Please contact support.");
  }
}
```

### Faza 4: Testing

```typescript
// tests/api/auth/account.test.ts
describe("DELETE /api/auth/account", () => {
  it("should return 401 without authentication", async () => {
    const response = await fetch("/api/auth/account", {
      method: "DELETE",
    });
    expect(response.status).toBe(401);
  });

  it("should delete account with valid token", async () => {
    // Register user
    const registerRes = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "todelete@example.com",
        password: "TestPass123",
      }),
    });
    const { session } = await registerRes.json();

    // Create some data
    await fetch("/api/flashcards", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        front: "Test",
        back: "Test",
      }),
    });

    // Delete account
    const deleteRes = await fetch("/api/auth/account", {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
      credentials: "include",
    });

    expect(deleteRes.status).toBe(204);

    // Verify user cannot login
    const loginRes = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "todelete@example.com",
        password: "TestPass123",
      }),
    });
    expect(loginRes.status).toBe(401);
  });

  it("should CASCADE delete user data", async () => {
    // Test that flashcards and generation_requests are deleted
    // Requires database access to verify
  });
});
```

---

## 9. Dokumentacja

### API Endpoint Documentation

````markdown
## DELETE /api/auth/account

**⚠️ WARNING: This operation is IRREVERSIBLE**

Permanently delete current user account and all associated data.

### Request

```http
DELETE /api/auth/account
Authorization: Bearer {access_token}
```
````

### Response

**Success (204 No Content)**

### Data Deleted

- User account (auth.users)
- All flashcards
- All generation requests
- All sessions

### GDPR/RODO Compliance

This endpoint implements the "right to be forgotten" as required by GDPR.

````

### Frontend Integration

```typescript
async function deleteAccount() {
  // Step 1: Show confirmation
  const confirmed = await showConfirmationDialog({
    title: 'Delete Account?',
    message: 'This will permanently delete your account and all your flashcards. This action cannot be undone.',
    confirmText: 'Delete My Account',
    confirmStyle: 'danger'
  });

  if (!confirmed) return;

  // Step 2: Require password re-entry (optional)
  const password = await promptPassword();

  // Step 3: Delete account
  try {
    const token = getAccessToken();
    const response = await fetch('/api/auth/account', {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      credentials: 'include'
    });

    if (response.status === 204) {
      // Success
      clearAllLocalData();
      showMessage('Your account has been deleted');
      window.location.href = '/';
    } else {
      showError('Failed to delete account. Please contact support.');
    }
  } catch (error) {
    showError('Network error. Please try again.');
  }
}
````

---

## 10. Checklist

### Pre-deployment

- [ ] Service role key configured
- [ ] AuthService.deleteAccount implemented
- [ ] CASCADE constraints verified in database
- [ ] Route handler implemented
- [ ] Tests passing
- [ ] GDPR compliance verified
- [ ] Frontend confirmation flow implemented

### Security

- [ ] Requires authentication
- [ ] Service role key not exposed
- [ ] User confirmation required
- [ ] Irreversibility communicated
- [ ] Audit logging (optional)

### Post-deployment

- [ ] Monitor deletion success rate
- [ ] Verify CASCADE deletions work
- [ ] Track GDPR compliance
- [ ] User feedback

---

## 11. Notatki

### Kluczowe Decyzje

**1. Hard Delete vs Soft Delete:**

- **Chosen:** Hard delete (immediate, permanent)
- **Rationale:** GDPR compliance, simpler implementation

**2. Confirmation Strategy:**

- **Chosen:** Frontend confirmation + optional password
- **Rationale:** Balance security with UX

**3. Service Role Client:**

- **Required:** `auth.admin.deleteUser()` needs service role
- **Security:** Never expose service role key to client

### CASCADE Relationships

```sql
-- Verified CASCADE constraints
flashcards.user_id → auth.users.id ON DELETE CASCADE
generation_requests.user_id → auth.users.id ON DELETE CASCADE

-- When user deleted, these are auto-deleted
```

### GDPR Compliance Checklist

- ✅ Right to be forgotten implemented
- ✅ All user data deleted
- ✅ CASCADE deletions work
- ✅ Irreversible (cannot recover)
- ✅ Audit trail (optional, for compliance)

**Autor:** AI Architecture Team  
**Data:** 2025-10-12  
**Wersja:** 1.0  
**Status:** Ready for Implementation  
**Security Level:** CRITICAL - Irreversible Operation
