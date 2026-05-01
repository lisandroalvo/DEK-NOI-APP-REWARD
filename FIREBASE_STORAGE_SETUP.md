# Firebase Storage Setup Guide

## Current Status
Your Firebase Storage bucket is configured: `dek-noi-4a39d.firebasestorage.app`

## Enable Firebase Storage

### Step 1: Enable Storage in Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select project: **dek-noi-4a39d**
3. Click **Storage** in the left sidebar
4. Click **Get Started**
5. Choose **Start in test mode** (for development)
6. Click **Next**
7. Select location (default is fine)
8. Click **Done**

### Step 2: Configure Security Rules

After enabling Storage, set up security rules:

1. In Firebase Console → Storage
2. Click **Rules** tab
3. Replace with these rules:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Allow anyone to read images
    match /{allPaths=**} {
      allow read: if true;
    }
    
    // Only authenticated admins can upload
    match /promos/{fileName} {
      allow write: if request.auth != null && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
    
    match /rewards/{fileName} {
      allow write: if request.auth != null && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
  }
}
```

4. Click **Publish**

### Step 3: Test Upload

1. Login as admin in your app
2. Go to **Admin → Promos**
3. Click **New Promo**
4. Try uploading an image
5. Check browser console (F12) for any errors

## Troubleshooting

### Error: "Firebase Storage is not initialized"

**Solution**: Make sure you've enabled Storage in Firebase Console (Step 1)

### Error: "Permission denied" or "storage/unauthorized"

**Solution**: 
1. Check you're logged in as admin
2. Verify security rules are published (Step 2)
3. Make sure your user has `role: 'admin'` in Firestore

### Error: "storage/unknown"

**Solution**:
1. Check internet connection
2. Verify Firebase project is active
3. Check browser console for detailed error

### Images upload but don't display

**Solution**:
1. Check security rules allow `read: if true`
2. Verify the URL is saved to Firestore
3. Check browser console for CORS errors

## Quick Test

Open browser console (F12) and run:

```javascript
// Check if storage is initialized
console.log('Storage:', window.firebase?.storage)

// Check current user
console.log('User:', window.firebase?.auth?.currentUser)
```

## Development vs Production

### Test Mode (Development)
```javascript
// Anyone can read/write (NOT SECURE)
allow read, write: if true;
```

### Production Mode
```javascript
// Only admins can write, anyone can read
allow read: if true;
allow write: if request.auth != null && 
  get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
```

## Verify Setup Checklist

- [ ] Firebase Storage enabled in console
- [ ] Security rules published
- [ ] Logged in as admin user
- [ ] User has `role: 'admin'` in Firestore
- [ ] Browser console shows no errors
- [ ] Test upload works

---

**Need Help?**
Check the browser console (F12 → Console tab) for detailed error messages when uploading.
