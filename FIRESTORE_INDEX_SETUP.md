# Firestore Index Setup Guide

## Issue
The redemptions page shows a count badge but displays "No pending requests" because Firestore requires a composite index for queries that combine `where()` and `orderBy()` on different fields.

## Quick Fix (Already Applied)
The code now includes a fallback that:
1. Tries to use the optimized query with `orderBy`
2. Falls back to a simpler query without `orderBy` if the index doesn't exist
3. Sorts the results in memory (JavaScript)

This means **the app will work immediately** without the index, but performance will be better with the index.

## Deploy the Firestore Index (Recommended)

### Option 1: Using Firebase CLI (Recommended)
```bash
# Make sure you're in the project directory
cd /Users/lisandroalvo/DEK-NOI-APP-REWARD

# Deploy the index
firebase deploy --only firestore:indexes
```

### Option 2: Manual Setup in Firebase Console
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project
3. Navigate to **Firestore Database** → **Indexes** tab
4. Click **Add Index**
5. Configure:
   - **Collection ID**: `redemptions`
   - **Fields to index**:
     - Field: `status`, Order: `Ascending`
     - Field: `requestedAt`, Order: `Descending`
   - **Query scope**: `Collection`
6. Click **Create**

### Option 3: Use the Error Link
When you first load the redemptions page, check the browser console. If there's an index error, Firestore will provide a direct link to create the index automatically.

## Verify It's Working

1. Open the admin redemptions page
2. Check the browser console (F12 → Console tab)
3. Look for logs like:
   - ✅ `Loaded X pending redemptions: [...]` - Working!
   - ⚠️ `Firestore index not found, using fallback query` - Working but using fallback
   - ❌ `Error loading redemptions: ...` - Check permissions

## Index Configuration File

The index configuration is saved in `firestore.indexes.json`:
```json
{
  "indexes": [
    {
      "collectionGroup": "redemptions",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "requestedAt", "order": "DESCENDING" }
      ]
    }
  ]
}
```

## Troubleshooting

### Still seeing "No pending requests"?
1. **Check browser console** for error messages
2. **Verify Firestore rules** allow admin access to redemptions collection
3. **Check if redemptions exist** in Firestore console
4. **Try refreshing** the page after index is created

### Permission Errors?
Check your Firestore security rules in `firestore.rules`:
```javascript
match /redemptions/{redemptionId} {
  allow read: if request.auth != null;
  allow create: if request.auth != null;
  allow update: if request.auth != null && 
    get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
}
```

## Performance Notes

- **Without index**: Query works but slower, sorts in memory
- **With index**: Optimized query, faster performance
- **Recommended**: Deploy the index for production use

---

**Status**: ✅ App is functional with or without the index
**Next Step**: Deploy the index using `firebase deploy --only firestore:indexes`
