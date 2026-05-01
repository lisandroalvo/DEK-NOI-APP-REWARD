# Image Upload Troubleshooting

## Quick Diagnosis

### Check Storage Status Indicator

1. Go to **Admin → Promos** page
2. Look at the top for the **Storage Status** indicator:
   - ✅ **Green**: Firebase Storage is ready
   - ❌ **Red**: Firebase Storage needs to be enabled
   - ⚠️ **Yellow**: Checking...

### Enable Firebase Storage (If Red)

**Step 1: Go to Firebase Console**
1. Click the "Enable Storage →" link in the red indicator
2. OR visit: https://console.firebase.google.com/project/dek-noi-4a39d/storage

**Step 2: Enable Storage**
1. Click **Get Started**
2. Choose **Start in test mode** (for development)
3. Click **Next**
4. Click **Done**

**Step 3: Set Security Rules**
1. Click **Rules** tab
2. Replace with:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Allow anyone to read
    match /{allPaths=**} {
      allow read: if true;
    }
    
    // Only admins can upload
    match /promos/{fileName} {
      allow write: if request.auth != null;
    }
    
    match /rewards/{fileName} {
      allow write: if request.auth != null;
    }
  }
}
```

3. Click **Publish**

**Step 4: Test Upload**
1. Refresh your app
2. Storage indicator should turn green
3. Try uploading an image

## Common Errors & Solutions

### Error: "Firebase Storage is not initialized"

**Cause**: Storage not enabled in Firebase Console

**Solution**:
1. Go to Firebase Console
2. Enable Storage (see steps above)
3. Refresh the app

---

### Error: "Permission denied" or "storage/unauthorized"

**Cause**: Security rules blocking upload

**Solution**:
1. Go to Firebase Console → Storage → Rules
2. Make sure rules allow write for authenticated users
3. Verify you're logged in as admin
4. Publish the rules

---

### Error: "storage/unknown"

**Cause**: Storage not properly configured

**Solution**:
1. Check Firebase Console → Storage is enabled
2. Verify `.env` file has correct `VITE_FIREBASE_STORAGE_BUCKET`
3. Restart dev server: `npm run dev`

---

### Upload starts but never completes

**Cause**: Network issue or large file

**Solution**:
1. Check internet connection
2. Try a smaller image (< 1MB)
3. Check browser console for errors
4. Try a different image format (PNG instead of JPG)

---

### Image uploads but doesn't display

**Cause**: Security rules blocking read access

**Solution**:
1. Go to Firebase Console → Storage → Rules
2. Make sure: `allow read: if true;`
3. Publish the rules
4. Clear browser cache

---

### "Image must be less than 5MB"

**Cause**: File too large

**Solution**:
1. Compress image using https://tinypng.com
2. Resize image to 1200x600px
3. Use JPG instead of PNG for photos

## Testing Checklist

- [ ] Firebase Storage enabled in console
- [ ] Security rules published
- [ ] Logged in as admin
- [ ] Storage status indicator is green
- [ ] Browser console shows no errors
- [ ] Image file is < 5MB
- [ ] Image is PNG, JPG, GIF, or WebP

## Browser Console Debugging

Open browser console (F12 → Console tab) and look for:

**Successful Upload**:
```
Starting upload... {file: "image.jpg", size: 123456, type: "image/jpeg"}
Upload path: promos/1714567890123_image.jpg
Uploading to Firebase Storage...
Upload complete: {...}
Getting download URL...
Download URL: https://firebasestorage.googleapis.com/...
```

**Failed Upload**:
```
Upload error details: FirebaseError: ...
Error code: storage/unauthorized
Error message: ...
```

## Quick Test

Try uploading this test image:
1. Create a simple 100x100px image in any image editor
2. Save as `test.png`
3. Upload to a promo
4. Check if it appears in preview

## Still Not Working?

1. **Check Firebase Console**:
   - Storage is enabled
   - Rules are published
   - No quota limits reached

2. **Check Browser**:
   - Clear cache and cookies
   - Try incognito mode
   - Try different browser

3. **Check Code**:
   - Run `npm install` to ensure dependencies
   - Restart dev server
   - Check `.env` file exists

4. **Check Network**:
   - Disable VPN
   - Check firewall settings
   - Try different network

## Contact Support

If still having issues, provide:
- Error message from browser console
- Screenshot of Storage status indicator
- Firebase Console screenshot showing Storage is enabled
- Steps you've already tried

---

**Last Updated**: May 2026
