# Database Management Scripts

This directory contains useful scripts to help you manage and debug user accounts in the HashView application.

## Available Scripts

### 1. Check Duplicate Accounts

Checks if an email or phone number already exists in the database.

**Usage:**
```bash
node scripts/checkDuplicateAccounts.js <email> <phone>
```

**Example:**
```bash
node scripts/checkDuplicateAccounts.js john@example.com 1234567890
```

**What it does:**
- Searches both User and BusinessOwner collections
- Shows detailed information about any matching accounts
- Provides suggestions on how to resolve conflicts

---

### 2. Delete Account

Safely deletes a user account from the database.

**Usage:**
```bash
node scripts/deleteAccount.js <accountId>
```

**Example:**
```bash
node scripts/deleteAccount.js 507f1f77bcf86cd799439011
```

**What it does:**
- Finds the account by ID in both collections
- Shows account details before deletion
- Asks for confirmation before deleting
- Safely removes the account

---

## Quick Troubleshooting Guide

### Problem: "This email and phone number is already exist"

**Step 1: Check what exists**
```bash
cd backend
node scripts/checkDuplicateAccounts.js your@email.com 1234567890
```

**Step 2: Choose your solution**

**Option A:** Login to existing account
- If the account is yours, use the Login feature
- Use "Forgot Password" if needed

**Option B:** Use different credentials
- Register with a different email
- Register with a different phone number

**Option C:** Delete old account (if it's a test/duplicate)
```bash
node scripts/deleteAccount.js <accountId-from-step1>
```

---

## Environment Requirements

Make sure you have:
- MongoDB connection string in `.env` file
- `MONGODB_URI` environment variable set
- MongoDB server running and accessible

---

## Notes

⚠️ **Important:** These scripts directly modify your database. Use with caution, especially in production environments.

✅ **Best Practice:** Always check the account details before deleting to ensure you're removing the correct account.

