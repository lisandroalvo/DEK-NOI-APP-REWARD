# 🎯 PROMOS vs REWARDS - Clear Separation

## 📢 PROMOS (Marketing/Offers)

### Purpose
- **Marketing tool** to showcase monthly offers and deals
- **NOT for point redemption**
- Display current promotions, sales, and special offers in the minimart

### Features
- ✅ Admin creates promos with:
  - Name
  - Description
  - **Price** (actual money price, not points)
  - Image
  - Active/Inactive status
- ✅ Displays as **auto-scrolling hero banner** on customer dashboard
- ✅ Shows all active promos in carousel
- ✅ No point exchange involved
- ✅ Just informational/marketing

### Customer View
- **Location**: Dashboard home (top banner carousel)
- **Display**: Auto-scrolling carousel with images
- **Action**: View only (no redemption)
- **Purpose**: See what's on sale this month

### Example Promos
- "Buy 2 Get 1 Free Coffee - ฿99"
- "50% Off All Snacks This Week"
- "New Product: Premium Noodles - ฿45"
- "Weekend Special: Energy Drinks 3 for ฿100"

---

## 🎁 REWARDS (Point Exchange)

### Purpose
- **Loyalty rewards** that customers can redeem with points
- **Point-based exchange system**
- Items/perks customers earn through purchases

### Features
- ✅ Admin creates rewards with:
  - Name
  - Description
  - **Points Cost** (not money)
  - Image
  - Available/Hidden status
- ✅ Customers browse in Rewards section
- ✅ Customers redeem with points
- ✅ **Admin approval required** for each redemption
- ✅ Admin can approve or decline requests

### Customer Flow
1. **Browse** rewards in Rewards section
2. **Check** if they have enough points
3. **Click** "Redeem" on desired reward
4. **Confirm** redemption request
5. **Wait** for admin approval
6. **Receive** reward once approved

### Admin Flow
1. **Create** rewards with point costs
2. **Receive** redemption requests
3. **Review** each request
4. **Approve** or **Decline**
5. Points deducted only after approval

### Example Rewards
- "Free Coffee - 500 points"
- "Free Sandwich - 800 points"
- "10% Discount Voucher - 300 points"
- "Free Delivery - 1000 points"

---

## 📊 Side-by-Side Comparison

| Feature | PROMOS | REWARDS |
|---------|--------|---------|
| **Purpose** | Marketing/Offers | Point Redemption |
| **Cost Display** | Money Price (฿) | Points (pts) |
| **Customer Action** | View Only | Redeem with Points |
| **Admin Approval** | Not Needed | Required |
| **Location** | Dashboard Banner | Rewards Section |
| **Display** | Auto-scrolling Carousel | Grid of Cards |
| **Point Exchange** | ❌ No | ✅ Yes |
| **Images** | ✅ Yes | ✅ Yes |
| **Active/Inactive** | ✅ Yes | ✅ Yes (Available/Hidden) |

---

## 🎨 Visual Differences

### PROMOS - Dashboard Banner
```
┌────────────────────────────────────┐
│  [Auto-scrolling Carousel]         │
│  ┌──────────────────────────────┐  │
│  │  [Image]                     │  │
│  │  Buy 2 Get 1 Free Coffee     │  │
│  │  Only ฿99 this week!         │  │
│  │  ● ○ ○ (dots)                │  │
│  └──────────────────────────────┘  │
└────────────────────────────────────┘
```

### REWARDS - Rewards Section
```
┌──────────────────────────────────────┐
│  Rewards Store    ⭐ 1,250 pts       │
├──────────────────────────────────────┤
│  ┌─────────┐  ┌─────────┐  ┌───────┐│
│  │ [Image] │  │ [Image] │  │[Image]││
│  │ Free    │  │ Free    │  │ 10%   ││
│  │ Coffee  │  │Sandwich │  │ Off   ││
│  │⭐500 pts│  │⭐800 pts│  │⭐300  ││
│  │[Redeem] │  │[Locked] │  │[Redeem││
│  └─────────┘  └─────────┘  └───────┘│
└──────────────────────────────────────┘
```

---

## 🔄 Workflow Examples

### PROMO Workflow
```
Admin Creates Promo
    ↓
"Buy 2 Get 1 Coffee - ฿99"
    ↓
Appears in Dashboard Carousel
    ↓
Customer sees offer
    ↓
Customer goes to store to buy
    ↓
(No point exchange)
```

### REWARD Workflow
```
Admin Creates Reward
    ↓
"Free Coffee - 500 points"
    ↓
Appears in Rewards Section
    ↓
Customer has 1,250 points
    ↓
Customer clicks "Redeem"
    ↓
Request sent to admin
    ↓
Admin approves
    ↓
Points deducted (now 750 pts)
    ↓
Customer gets free coffee
```

---

## ✅ Implementation Status

### PROMOS
- ✅ Admin can create/edit promos
- ✅ Add images to promos
- ✅ Set active/inactive status
- ✅ Auto-scrolling carousel on dashboard
- ✅ Shows price in money (฿)
- ✅ No point redemption

### REWARDS
- ✅ Admin can create/edit rewards
- ✅ Add images to rewards
- ✅ Set available/hidden status
- ✅ Shows point cost
- ✅ Customer can redeem with points
- ✅ Admin approval system
- ✅ Points deducted after approval
- ✅ Request tracking

---

## 🎯 Key Takeaways

1. **PROMOS** = Marketing (show offers, no points)
2. **REWARDS** = Loyalty (redeem points, admin approval)
3. **Separate sections** with different purposes
4. **Both support images** for visual appeal
5. **Clear distinction** for customers and admin

---

## 📱 Customer Experience

### When I want to see deals:
→ Go to **Dashboard** → See **Promo Carousel**

### When I want to use my points:
→ Go to **Rewards** → Browse → **Redeem**

---

## 🎉 Summary

**PROMOS** and **REWARDS** are now completely separate:
- **Promos** = Marketing offers (no points)
- **Rewards** = Point redemption (admin approval)
- Both have images and descriptions
- Clear, intuitive separation for users
- Professional loyalty program structure
