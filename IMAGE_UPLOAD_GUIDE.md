# Image Upload System Guide

## Overview
Complete image upload system for **Promos** and **Rewards** using Firebase Storage with automatic carousel display on customer dashboard.

## Features

### 🖼️ **Image Upload Component**
- **Drag & Drop Interface**: Click to upload images
- **File Validation**: 
  - Only image files (PNG, JPG, GIF, WebP)
  - Maximum size: 5MB
- **Preview**: Live preview before saving
- **Delete**: Remove uploaded images
- **Firebase Storage**: Automatic upload to Firebase Storage
- **Unique Filenames**: Timestamp-based naming to prevent conflicts

### 📸 **Promo Images**
- **Admin Upload**: Add images when creating/editing promos
- **Carousel Display**: Automatic carousel on customer dashboard
- **Auto-play**: Slides change every 5 seconds
- **Manual Navigation**: Arrow buttons and dot indicators
- **Gradient Overlay**: Beautiful text overlay on images
- **Responsive**: Works on all screen sizes

### 🎁 **Reward Images**
- **Optional Upload**: Add images to rewards (optional)
- **Visual Enhancement**: Better product representation
- **Storage Organization**: Stored in `rewards/` folder

## Admin Usage

### Adding Images to Promos

1. **Navigate to Admin → Promos**
2. Click "New Promo" or edit existing promo
3. Fill in promo details:
   - Title
   - Description
   - Month (optional)
   - Bonus Points (optional)
4. **Upload Image**:
   - Click the upload area
   - Select an image (PNG/JPG, max 5MB)
   - Wait for upload to complete
   - Preview appears automatically
5. Check "Show to customers"
6. Click "Save"

### Adding Images to Rewards

1. **Navigate to Admin → Rewards**
2. Click "New Reward" or edit existing reward
3. Fill in reward details:
   - Name
   - Description
   - Points cost
   - Emoji
4. **Upload Image** (optional):
   - Click the upload area
   - Select an image
   - Preview appears
5. Check "Available to customers"
6. Click "Save"

### Removing Images

1. **Edit the promo/reward**
2. **Hover over the image preview**
3. **Click the red X button** in top-right corner
4. Image is removed from storage
5. Click "Save" to confirm

## Customer Experience

### Promo Carousel on Dashboard

**Automatic Display**:
- Carousel appears at top of dashboard
- Only shows promos with images
- Auto-plays every 5 seconds
- Smooth transitions

**Navigation**:
- **Left/Right Arrows**: Manual slide control
- **Dot Indicators**: Jump to specific slide
- **Click stops auto-play**: Manual control takes over

**Information Shown**:
- Promo image (full-width, 256px height)
- Month badge (if specified)
- Bonus points badge (if specified)
- Title (large, bold)
- Description (2 lines max)

## Technical Details

### Firebase Storage Structure

```
storage/
├── promos/
│   ├── 1714567890123_double_points.jpg
│   ├── 1714567891234_free_delivery.png
│   └── ...
└── rewards/
    ├── 1714567892345_free_coffee.jpg
    ├── 1714567893456_discount_voucher.png
    └── ...
```

### File Naming Convention
```
{folder}/{timestamp}_{sanitized_filename}
```
Example: `promos/1714567890123_summer_sale.jpg`

### Image Upload Flow

1. **User selects file** → Validation (type, size)
2. **Upload to Firebase Storage** → Unique filename generated
3. **Get download URL** → Public URL for the image
4. **Save URL to Firestore** → Stored in `imageUrl` field
5. **Display preview** → Immediate visual feedback

### Firestore Data Structure

**Promos Collection**:
```javascript
{
  title: "Double Points Weekend",
  description: "Earn 2x points on all purchases",
  month: "May",
  bonusPoints: 2,
  active: true,
  imageUrl: "https://firebasestorage.googleapis.com/.../promos/123_image.jpg",
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

**Rewards Collection**:
```javascript
{
  name: "Free Coffee",
  description: "One free coffee of any size",
  pointsCost: 500,
  emoji: "☕",
  available: true,
  imageUrl: "https://firebasestorage.googleapis.com/.../rewards/456_image.jpg",
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

## Firebase Storage Setup

### Enable Firebase Storage

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project
3. Navigate to **Storage** in left sidebar
4. Click **Get Started**
5. Choose **Start in production mode** or **Test mode**
6. Click **Done**

### Security Rules (Recommended)

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Allow authenticated admins to upload
    match /promos/{fileName} {
      allow read: if true;
      allow write: if request.auth != null && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
    
    match /rewards/{fileName} {
      allow read: if true;
      allow write: if request.auth != null && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
  }
}
```

## Carousel Features

### Auto-Play
- Changes slide every **5 seconds**
- Pauses when user manually navigates
- Infinite loop (goes back to first slide after last)

### Manual Controls
- **Left Arrow**: Previous slide
- **Right Arrow**: Next slide
- **Dot Indicators**: Jump to specific slide
- Clicking any control stops auto-play

### Responsive Design
- **Mobile**: Full-width, touch-friendly
- **Tablet**: Optimized spacing
- **Desktop**: Max-width container

### Visual Effects
- **Gradient Overlay**: Dark gradient for text readability
- **Smooth Transitions**: Fade between slides
- **Hover Effects**: Buttons highlight on hover
- **Active Indicator**: Yellow dot for current slide

## Best Practices

### Image Recommendations

**Dimensions**:
- **Minimum**: 800x400px
- **Recommended**: 1200x600px
- **Aspect Ratio**: 2:1 (landscape)

**File Size**:
- **Target**: 200-500KB
- **Maximum**: 5MB
- **Optimize**: Use tools like TinyPNG before uploading

**Content**:
- High contrast for text readability
- Avoid important content at edges
- Consider mobile viewing
- Use brand colors (#CC0000, #FFE600)

### SEO & Accessibility
- Use descriptive filenames
- Alt text automatically uses promo title
- Semantic HTML structure
- Keyboard navigation support

## Troubleshooting

### Upload Fails

**Check**:
1. File is an image (PNG, JPG, GIF, WebP)
2. File size is under 5MB
3. Firebase Storage is enabled
4. User has admin permissions
5. Internet connection is stable

**Error Messages**:
- "Please select an image file" → Wrong file type
- "Image must be less than 5MB" → File too large
- "Failed to upload image" → Network or permissions issue

### Carousel Not Showing

**Reasons**:
1. No promos have images uploaded
2. Promos are not marked as "active"
3. Images failed to load (check URLs)
4. User not logged in

**Fix**:
- Upload images to at least one promo
- Ensure promo is active
- Check browser console for errors
- Verify Firebase Storage rules

### Images Not Loading

**Check**:
1. Firebase Storage URL is valid
2. Storage security rules allow public read
3. Image wasn't deleted from storage
4. Network connection

## Future Enhancements

### Potential Features
- [ ] Image cropping/editing before upload
- [ ] Multiple images per promo (gallery)
- [ ] Video support for promos
- [ ] Image compression on upload
- [ ] Lazy loading for performance
- [ ] CDN integration
- [ ] Image analytics (views, clicks)
- [ ] Batch upload multiple images
- [ ] Image templates/filters

---

**Status**: ✅ Fully Implemented
**Components**: ImageUpload, PromoCarousel
**Storage**: Firebase Storage
**Last Updated**: May 2026
