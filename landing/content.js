// ABOUTME: Thai/English copy for the DEK NOI landing page.
// ABOUTME: getContent() returns a locale block and falls back to Thai.
export const CONTENT = {
  th: {
    tagline: 'สะสมแต้ม แลกของรางวัล ที่ร้านเด็กน้อย',
    valueProps: [
      { title: 'สะสมแต้ม', body: 'รับแต้มทุกครั้งที่ใช้บริการ' },
      { title: 'สแกนบิล', body: 'ถ่ายรูปบิลเพื่อรับแต้มอัตโนมัติ' },
      { title: 'แลกรางวัล', body: 'นำแต้มไปแลกของรางวัลสุดพิเศษ' },
    ],
    openApp: 'เปิดแอป',
    locationHeading: 'ที่ตั้งร้าน',
    locationName: 'Supalai River Resort',
    locationMapUrl: 'https://maps.google.com/?q=Supalai+River+Resort',
    contactHeading: 'ติดต่อเรา',
    contactEmail: 'deknoi24@gmail.com',
    contactPhone: '062-028-3183',
    footer: '© DEK NOI',
  },
  en: {
    tagline: 'Collect points and redeem rewards at DEK NOI',
    valueProps: [
      { title: 'Collect points', body: 'Earn points every time you visit' },
      { title: 'Scan your bill', body: 'Snap a photo of your bill to earn automatically' },
      { title: 'Redeem rewards', body: 'Turn points into special rewards' },
    ],
    openApp: 'Open the App',
    locationHeading: 'Our Location',
    locationName: 'Supalai River Resort',
    locationMapUrl: 'https://maps.google.com/?q=Supalai+River+Resort',
    contactHeading: 'Contact Us',
    contactEmail: 'deknoi24@gmail.com',
    contactPhone: '062-028-3183',
    footer: '© DEK NOI',
  },
}

export function getContent(lang) {
  return CONTENT[lang] || CONTENT.th
}
