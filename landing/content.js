// ABOUTME: Thai/English copy for the DEK NOI landing page.
// ABOUTME: getContent() returns a locale block and falls back to Thai.
export const CONTENT = {
  th: {
    heroEyebrow: 'เด็กน้อย รีวอร์ด',
    tagline: 'สะสมแต้ม แลกของรางวัล',
    heroSub: 'ทุกการใช้บริการที่ร้านเด็กน้อย เปลี่ยนเป็นแต้มสะสม แลกของรางวัลสุดพิเศษได้เลย',
    propsHeading: 'จุดเด่นของเรา',
    valueProps: [
      { emoji: '⭐', title: 'สะสมแต้ม', body: 'รับแต้มทุกครั้งที่ใช้บริการ' },
      { emoji: '🧾', title: 'สแกนบิล', body: 'ถ่ายรูปบิลเพื่อรับแต้มอัตโนมัติ' },
      { emoji: '🎁', title: 'แลกรางวัล', body: 'นำแต้มไปแลกของรางวัลสุดพิเศษ' },
    ],
    openApp: 'เปิดแอป',
    locationHeading: 'ที่ตั้งร้าน',
    locationName: 'Supalai River Resort',
    locationMapUrl: 'https://maps.app.goo.gl/syfFACayWBc6bYyj9',
    contactHeading: 'ติดต่อเรา',
    contactLineLabel: 'แอดไลน์เพื่อรับข่าวสารและโปรโมชั่น',
    contactEmail: 'deknoi24@gmail.com',
    contactPhone: '062-028-3183',
    footer: '© DEK NOI',
  },
  en: {
    heroEyebrow: 'DEK NOI Rewards',
    tagline: 'Collect points, redeem rewards',
    heroSub: 'Every visit to DEK NOI turns into points you can redeem for special rewards.',
    propsHeading: 'What you get',
    valueProps: [
      { emoji: '⭐', title: 'Collect points', body: 'Earn points every time you visit' },
      { emoji: '🧾', title: 'Scan your bill', body: 'Snap a photo of your bill to earn automatically' },
      { emoji: '🎁', title: 'Redeem rewards', body: 'Turn points into special rewards' },
    ],
    openApp: 'Open the App',
    locationHeading: 'Our Location',
    locationName: 'Supalai River Resort',
    locationMapUrl: 'https://maps.app.goo.gl/syfFACayWBc6bYyj9',
    contactHeading: 'Contact Us',
    contactLineLabel: 'Add us on LINE for news and promotions',
    contactEmail: 'deknoi24@gmail.com',
    contactPhone: '062-028-3183',
    footer: '© DEK NOI',
  },
}

export function getContent(lang) {
  return CONTENT[lang] || CONTENT.th
}
