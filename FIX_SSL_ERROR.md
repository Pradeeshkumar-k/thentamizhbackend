# Fix: Database SSL Connection Error

## Problem
**Error:** `"self-signed certificate in certificate chain"` when trying to connect to Supabase PostgreSQL database.

## Root Cause
The PostgreSQL connection pool was not configured to accept Supabase's SSL certificates.

## Solution Applied

### ✅ Fixed File: `src/utils/prisma.ts`

**Before:**
```typescript
const pool = new Pool({ connectionString });
```

**After:**
```typescript
const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false, // Allow self-signed certificates from Supabase
  },
});
```

## How to Apply the Fix

### Step 1: Restart Backend Server

**Stop the current server** (Ctrl+C in the terminal running the backend)

**Start it again:**
```bash
cd backend
npm run dev
```

### Step 2: Test the Login

Now try logging in with:
- **Email:** `admin@gmail.com`
- **Password:** `admin` (or whatever password you set in your database)

### Step 3: Verify Database Connection

Test the backend endpoint directly:
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"admin@gmail.com\",\"password\":\"admin\"}"
```

You should get a response with user data and token instead of the SSL error.

## Alternative: Production SSL Configuration

For **production**, you may want stricter SSL validation. Update to:

```typescript
const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: true,
    ca: fs.readFileSync('/path/to/supabase-ca.crt').toString(),
  },
});
```

But for **development with Supabase**, `rejectUnauthorized: false` is acceptable.

## Common Issues After Fix

### Issue 1: User doesn't exist
**Solution:** Create a user in your Supabase database first:
```sql
INSERT INTO "User" (id, email, username, name, "passwordHash", role)
VALUES (
  gen_random_uuid(),
  'admin@gmail.com',
  'admin',
  'Admin User',
  '$2b$10$YOUR_HASHED_PASSWORD', -- Use bcrypt to hash the password
  'ADMIN'
);
```

### Issue 2: Tables don't exist
**Solution:** Run Prisma migrations:
```bash
cd backend
npx prisma migrate dev
```

### Issue 3: Still getting SSL errors
**Solution:** Check if the .env file is being loaded:
```bash
cd backend
node -e "require('dotenv').config(); console.log(process.env.DATABASE_URL)"
```

## Status
✅ **Fixed** - SSL configuration added to PostgreSQL connection pool
⏳ **Action Required** - Restart backend server
⏳ **Action Required** - Ensure user exists in database

---

After restarting the server, the login should work without SSL errors!
