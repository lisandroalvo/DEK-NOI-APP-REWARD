# Redemption Notifications System

## Overview
Real-time notification system that alerts users when their redemption requests are approved or rejected by admins.

## Features

### ✅ Real-time Notifications
- **Firestore Listeners**: Uses `onSnapshot` to detect status changes in real-time
- **Toast Notifications**: Beautiful slide-in notifications from the right
- **Auto-dismiss**: Notifications automatically close after 8 seconds
- **Manual Close**: Users can close notifications by clicking the X button

### 🎨 Notification Types

**Approved (Success)**
- Green background (#F0FFF4)
- Checkmark icon
- Message: "🎉 Your [reward name] redemption was approved! Visit the store to collect it."

**Rejected (Error)**
- Red background (#FFF0F0)
- X icon
- Message: "Your [reward name] redemption was not approved. [Reason if provided]"
- Includes admin's rejection note if available

### 🔔 Smart Notification Logic

**Prevents Duplicates**
- Uses localStorage to track which redemptions have been seen
- Only shows notification once per status change
- Key format: `seen_redemption_{redemptionId}`

**Status Tracking**
- Monitors redemptions with status: `approved` or `rejected`
- Detects both new redemptions and status changes
- Works across page refreshes

## Implementation

### Components

**1. Toast Component** (`src/components/Toast.jsx`)
```jsx
<Toast 
  message="Your reward was approved!"
  type="success"  // 'success' | 'error' | 'info'
  onClose={handleClose}
  duration={8000}  // milliseconds
/>
```

**2. Notification Hook** (`src/hooks/useRedemptionNotifications.js`)
```jsx
const { notification, clearNotification } = useRedemptionNotifications(userId)
```

### Pages Using Notifications

**Customer Dashboard** (`src/pages/customer/Dashboard.jsx`)
- Shows notifications when user is on the main dashboard
- Includes "My Redemptions" quick action link

**My Redemptions** (`src/pages/customer/MyRedemptions.jsx`)
- Shows notifications when viewing redemption history
- Displays all redemptions with status badges
- Fixed query with fallback for missing Firestore index

## User Flow

### When Admin Approves a Redemption

1. **Admin Action**: Admin clicks "Approve" on pending redemption
2. **Firestore Update**: Status changes from `pending` → `approved`
3. **Real-time Detection**: User's browser detects the change via `onSnapshot`
4. **Notification Display**: Green success toast appears in top-right
5. **Auto-dismiss**: Toast disappears after 8 seconds
6. **Points Deducted**: User's points are automatically reduced
7. **Visit Store**: User can collect their reward at the physical store

### When Admin Rejects a Redemption

1. **Admin Action**: Admin clicks "Reject" and optionally adds a reason
2. **Firestore Update**: Status changes to `rejected` with optional `rejectNote`
3. **Real-time Detection**: User's browser detects the change
4. **Notification Display**: Red error toast appears with reason (if provided)
5. **Auto-dismiss**: Toast disappears after 8 seconds
6. **Points Restored**: Points remain in user's account (not deducted)

## Accessing Redemptions

### From Dashboard
1. Click "My Redemptions" in Quick Actions section
2. Or click the yellow pending alert banner (if redemptions are pending)

### Direct Navigation
- URL: `/my-redemptions`
- Shows all redemptions grouped by:
  - **Pending**: Awaiting admin review
  - **History**: Approved or rejected redemptions

## Technical Details

### Firestore Queries

**Admin View** (status-based)
```javascript
query(collection(db, 'redemptions'), 
  where('status', '==', 'pending'), 
  orderBy('requestedAt', 'desc'))
```

**User View** (userId-based)
```javascript
query(collection(db, 'redemptions'), 
  where('userId', '==', userId), 
  orderBy('requestedAt', 'desc'))
```

### Required Indexes

Deploy these indexes for optimal performance:
```bash
firebase deploy --only firestore:indexes
```

Indexes defined in `firestore.indexes.json`:
1. `status` + `requestedAt` (for admin view)
2. `userId` + `requestedAt` (for user view)

### Fallback Mechanism

If indexes don't exist:
- Query runs without `orderBy`
- Results sorted in JavaScript memory
- App remains functional but slightly slower

## Troubleshooting

### Notifications Not Appearing?

**Check Browser Console**
- Look for Firestore errors
- Verify `onSnapshot` is connecting
- Check localStorage for `seen_redemption_*` keys

**Clear Notification History**
```javascript
// In browser console
Object.keys(localStorage)
  .filter(key => key.startsWith('seen_redemption_'))
  .forEach(key => localStorage.removeItem(key))
```

### Redemptions Not Loading?

**Check Firestore Rules**
```javascript
match /redemptions/{redemptionId} {
  allow read: if request.auth != null && 
    (request.auth.uid == resource.data.userId || 
     get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin');
}
```

**Deploy Indexes**
```bash
firebase deploy --only firestore:indexes
```

**Check Browser Console**
- Error messages will indicate missing indexes
- Firestore provides direct links to create indexes

## Future Enhancements

### Potential Features
- [ ] Push notifications (PWA)
- [ ] Email notifications
- [ ] SMS notifications via Twilio
- [ ] In-app notification center/inbox
- [ ] Sound effects for notifications
- [ ] Notification preferences (enable/disable)
- [ ] Batch notifications (multiple approvals)

### Performance Optimizations
- [ ] Limit onSnapshot to recent redemptions only
- [ ] Implement notification pagination
- [ ] Add notification expiry (auto-clear old localStorage entries)

---

**Status**: ✅ Fully Implemented
**Version**: 1.0
**Last Updated**: May 2026
