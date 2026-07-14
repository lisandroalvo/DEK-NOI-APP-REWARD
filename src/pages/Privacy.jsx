// ABOUTME: Public bilingual (Thai/English) privacy policy page for the DEK NOI rewards app.
// ABOUTME: Draft PDPA-oriented template — must be reviewed by legal counsel before launch.
import { useState } from 'react'
import { Link } from 'react-router-dom'

const CONTENT = {
  th: {
    switch: 'English',
    title: 'นโยบายความเป็นส่วนตัว',
    draft: 'ฉบับร่าง — ต้องได้รับการตรวจสอบจากที่ปรึกษากฎหมายก่อนเปิดใช้งานจริง',
    sections: [
      ['ผู้ควบคุมข้อมูล', 'เด็กน้อย (Dek Noi) เป็นผู้ควบคุมข้อมูลส่วนบุคคลของคุณสำหรับโปรแกรมสะสมคะแนนนี้'],
      ['ข้อมูลที่เราเก็บ', 'ชื่อ อีเมล เบอร์โทรศัพท์ รูปภาพใบเสร็จที่คุณส่ง และประวัติคะแนน/ยอดใช้จ่ายของคุณ'],
      ['วัตถุประสงค์', 'เพื่อให้บริการโปรแกรมสะสมคะแนน ได้แก่ การให้คะแนน การแลกของรางวัล และการติดต่อคุณเกี่ยวกับสิทธิประโยชน์'],
      ['ฐานทางกฎหมาย', 'เราประมวลผลข้อมูลของคุณบนพื้นฐานของความยินยอมที่คุณให้ไว้ตอนสมัครสมาชิก'],
      ['ระยะเวลาการเก็บรักษา', 'รูปใบเสร็จจะถูกเก็บไว้อย่างถาวรเพื่อให้คุณตรวจสอบประวัติได้ตลอดเวลา (อยู่ระหว่างการตรวจสอบตามหลัก PDPA)'],
      ['การเปิดเผยข้อมูล', 'ข้อมูลถูกจัดเก็บและประมวลผลผ่าน Firebase / Google Cloud ในฐานะผู้ประมวลผลข้อมูลของเรา'],
      ['สิทธิของคุณ', 'ภายใต้ PDPA คุณมีสิทธิเข้าถึง แก้ไข ลบข้อมูล และถอนความยินยอมได้'],
      ['ติดต่อเรา', 'สอบถามหรือใช้สิทธิของคุณได้ทาง LINE: @167fnbxs'],
    ],
    back: 'กลับ',
  },
  en: {
    switch: 'ภาษาไทย',
    title: 'Privacy Policy',
    draft: 'Draft — must be reviewed by legal counsel before launch.',
    sections: [
      ['Data controller', 'Dek Noi (เด็กน้อย) is the controller of your personal data for this loyalty program.'],
      ['What we collect', 'Your name, email, phone number, the receipt images you submit, and your points/spend history.'],
      ['Why we use it', 'To run the loyalty program: awarding points, processing redemptions, and contacting you about rewards.'],
      ['Legal basis', 'We process your data on the basis of the consent you give at registration.'],
      ['How long we keep it', 'Receipt images are kept permanently so you can always review your history (under review for PDPA alignment).'],
      ['Who we share with', 'Data is stored and processed via Firebase / Google Cloud, acting as our data processors.'],
      ['Your rights', 'Under Thailand’s PDPA you may access, correct, or delete your data and withdraw consent.'],
      ['Contact us', 'For any request or to exercise your rights, reach us on LINE: @167fnbxs.'],
    ],
    back: 'Back',
  },
}

export default function Privacy() {
  const [lang, setLang] = useState('th')
  const t = CONTENT[lang]

  return (
    <div className="min-h-screen bg-white">
      <div className="fixed top-0 left-0 right-0">
        <div className="h-2" style={{ background: '#CC0000' }} />
        <div className="h-2" style={{ background: '#FFE600' }} />
      </div>

      <div className="max-w-2xl mx-auto px-5 py-10">
        <div className="flex items-center justify-between mb-4">
          <Link to="/register" className="text-sm font-bold" style={{ color: '#CC0000' }}>← {t.back}</Link>
          <button onClick={() => setLang(lang === 'th' ? 'en' : 'th')}
            className="text-sm font-bold px-3 py-1.5 rounded-lg border-2 border-gray-200 hover:bg-gray-50">
            {t.switch}
          </button>
        </div>

        <h1 className="text-2xl font-black text-gray-900 mb-2">{t.title}</h1>

        <div className="mb-6 p-3 bg-yellow-50 border-2 border-yellow-300 rounded-xl text-sm font-bold text-yellow-900">
          ⚠️ {t.draft}
        </div>

        <div className="space-y-5">
          {t.sections.map(([heading, body]) => (
            <section key={heading}>
              <h2 className="text-base font-black text-gray-900 mb-1">{heading}</h2>
              <p className="text-sm text-gray-700 leading-relaxed">{body}</p>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
