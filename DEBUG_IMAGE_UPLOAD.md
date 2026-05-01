# 🔍 Debug Image Upload

## How to Debug

I've added extensive logging to help diagnose the issue. Follow these steps:

### Step 1: Open Browser Console
1. Press **F12** (or Cmd+Option+I on Mac)
2. Click **Console** tab
3. Clear console (click 🚫 icon)

### Step 2: Try Uploading
1. Go to **Admin → Promos**
2. Click **"New Promo"**
3. Fill in title (e.g., "Test")
4. Click the **upload area**
5. Select an image

### Step 3: Check Console Logs

You should see these logs in order:

#### ✅ **Successful Upload Logs:**
```
File selected: File {name: "image.jpg", ...}
File details: {name: "image.jpg", type: "image/jpeg", size: 123456, sizeKB: 120}
Starting upload...
Reading file as DataURL...
✅ Image converted to base64
Base64 size: 160 KB
Base64 preview: data:image/jpeg;base64,/9j/4AAQSkZJRg...
✅ Preview set
✅ onChange called with base64 string
✅ Upload complete!
```

#### ❌ **If Upload Fails:**

**No file selected:**
```
File selected: undefined
No file selected
```
→ File input not working, try different browser

**Wrong file type:**
```
Invalid file type: application/pdf
```
→ Select an image file (PNG, JPG, GIF, WebP)

**File too large:**
```
File too large: 3145728
```
→ Compress image to under 2MB

**Read error:**
```
❌ FileReader error: ...
```
→ File corrupted or browser issue

### Step 4: Try Saving

After upload, click **"Save"** and check console:

#### ✅ **Successful Save:**
```
💾 Saving promo...
Form data: {title: "Test", hasImage: true, imageSize: "160 KB"}
Creating new promo...
✅ Promo created successfully
```

#### ❌ **Save Fails:**

**No image in form:**
```
Form data: {title: "Test", hasImage: false, imageSize: "No image"}
```
→ onChange not called, check component

**Firestore error:**
```
❌ Save error: FirebaseError: Document too large
```
→ Image too big for Firestore (max ~1MB)

**Permission error:**
```
❌ Save error: Missing or insufficient permissions
```
→ Check Firestore rules

## Common Issues & Solutions

### Issue 1: File Input Not Opening
**Symptoms:** Click upload area, nothing happens
**Console:** No logs at all
**Solution:**
- Hard refresh (Cmd+Shift+R)
- Try different browser
- Check if modal is blocking clicks

### Issue 2: Image Selected But Not Uploading
**Symptoms:** File picker works, but no preview
**Console:** "File selected" but stops there
**Solution:**
- Check file type (must be image/*)
- Check file size (must be < 2MB)
- Try different image

### Issue 3: Upload Works But Save Fails
**Symptoms:** Preview shows, but save fails
**Console:** "Upload complete" but "Save error"
**Solution:**
- Check error message
- If "Document too large": Image > 1MB, compress more
- If "Permission denied": Check Firestore rules

### Issue 4: Image Too Large for Firestore
**Symptoms:** Save error about document size
**Console:** "imageSize: 1200 KB" or higher
**Solution:**
- Firestore max: ~1MB per document
- Base64 adds 33% overhead
- Compress image to < 700KB original size
- Use https://tinypng.com

## Quick Tests

### Test 1: Very Small Image
1. Create 100x100px image
2. Save as JPG, low quality
3. Should be < 10KB
4. Try uploading
5. Should work perfectly

### Test 2: Check Form State
Add this to console after upload:
```javascript
// In browser console
console.log(document.querySelector('input[type="file"]'))
```

### Test 3: Manual Base64 Test
```javascript
// In browser console
const testBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
console.log('Test base64:', testBase64)
// Try pasting this in form
```

## What to Share

If still not working, share:
1. **Full console log** (copy/paste)
2. **Image file size** (in KB)
3. **Image format** (PNG, JPG, etc.)
4. **Browser** (Chrome, Safari, Firefox)
5. **Any error messages**

## Expected Behavior

### Upload Flow:
1. Click upload area
2. File picker opens
3. Select image
4. Console shows "File selected"
5. Console shows "Starting upload"
6. Preview appears
7. Console shows "Upload complete"
8. Fill other fields
9. Click Save
10. Console shows "Saving promo"
11. Console shows "Promo created"
12. Modal closes
13. Promo appears in list

### Image Size Limits:
- **Original file**: < 2MB
- **After base64**: < 2.7MB
- **Firestore limit**: ~1MB per document
- **Safe range**: 200-700KB original

## Troubleshooting Checklist

- [ ] Browser console open
- [ ] Console cleared before test
- [ ] Image file < 2MB
- [ ] Image is PNG/JPG/GIF/WebP
- [ ] Hard refresh done (Cmd+Shift+R)
- [ ] Tried different image
- [ ] Checked all console logs
- [ ] No errors in console
- [ ] Preview appears after upload
- [ ] Save button clicked
- [ ] Checked Firestore for saved data

---

**The logs will tell us exactly where it's failing!**
