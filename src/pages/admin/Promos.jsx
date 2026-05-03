import { useEffect, useState } from 'react'
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, orderBy, query } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { Plus, Pencil, Trash2, X, Megaphone } from 'lucide-react'
import ImageUploadSimple from '../../components/ImageUploadSimple'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const EMPTY = { title: '', description: '', month: '', bonusPoints: '', active: true, imageUrl: null }

export default function AdminPromos() {
  const [promos, setPromos] = useState([])
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)

  const load = () => getDocs(query(collection(db, 'promos'), orderBy('createdAt', 'desc'))).then(snap => setPromos(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
  useEffect(() => { load() }, [])

  const open = (p = null) => {
    setForm(p ? { title: p.title, description: p.description, month: p.month || '', bonusPoints: String(p.bonusPoints || ''), active: p.active, imageUrl: p.imageUrl || null } : EMPTY)
    setModal(p ?? 'new')
  }

  const save = async () => {
    setSaving(true)
    const data = { ...form, bonusPoints: form.bonusPoints ? parseInt(form.bonusPoints) : null, updatedAt: serverTimestamp() }
    
    console.log('💾 Saving promo...')
    console.log('Form data:', {
      title: form.title,
      hasImage: !!form.imageUrl,
      imageSize: form.imageUrl ? Math.round(form.imageUrl.length / 1024) + ' KB' : 'No image'
    })
    
    try {
      if (modal === 'new') {
        console.log('Creating new promo...')
        await addDoc(collection(db, 'promos'), { ...data, createdAt: serverTimestamp() })
        console.log('✅ Promo created successfully')
      } else {
        console.log('Updating promo:', modal.id)
        await updateDoc(doc(db, 'promos', modal.id), data)
        console.log('✅ Promo updated successfully')
      }
      setModal(null)
      load()
    } catch (error) {
      console.error('❌ Save error:', error)
      alert('Failed to save promo: ' + error.message)
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id) => { if (!confirm('Delete this promo?')) return; await deleteDoc(doc(db, 'promos', id)); load() }
  const toggle = async (p) => { await updateDoc(doc(db, 'promos', p.id), { active: !p.active }); load() }
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  return (
    <div className="p-4 sm:p-6 md:p-8 w-full max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-black text-gray-900">Promos</h1>
        <button onClick={() => open()} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-black text-white" style={{ background: '#CC0000' }}>
          <Plus size={16} /> New Promo
        </button>
      </div>
      

      <div className="space-y-3 max-w-4xl">
        {promos.map(p => (
          <div key={p.id} className={`bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100 ${!p.active ? 'opacity-50' : ''}`}>
            <div className="h-1.5" style={{ background: '#CC0000' }} />
            <div className="h-1.5" style={{ background: '#FFE600' }} />
            <div className="p-4 flex gap-4 items-start">
              {p.imageUrl && (
                <img 
                  src={p.imageUrl} 
                  alt={p.title}
                  className="w-32 h-20 object-cover rounded-lg shrink-0 border-2 border-gray-200"
                />
              )}
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-black uppercase tracking-wide" style={{ color: '#CC0000' }}>{p.month || 'General'}</span>
                  {p.bonusPoints && <span className="text-xs font-black px-2 py-0.5 rounded-full" style={{ background: '#FFE600', color: '#CC0000' }}>⭐ {p.bonusPoints}x bonus</span>}
                </div>
                <h3 className="font-black text-gray-900">{p.title}</h3>
                <p className="text-sm text-gray-500 mt-1">{p.description}</p>
              </div>
              <div className="flex gap-1 ml-4 shrink-0 items-center">
                <button onClick={() => toggle(p)} className="text-xs px-2.5 py-1 rounded-full font-black"
                  style={p.active ? { background: '#FFE600', color: '#CC0000' } : { background: '#f3f4f6', color: '#666' }}>
                  {p.active ? 'Active' : 'Hidden'}
                </button>
                <button onClick={() => open(p)} className="p-1.5 hover:bg-gray-100 rounded-lg"><Pencil size={14} className="text-gray-500" /></button>
                <button onClick={() => remove(p.id)} className="p-1.5 hover:bg-red-50 rounded-lg"><Trash2 size={14} style={{ color: '#CC0000' }} /></button>
              </div>
            </div>
          </div>
        ))}
        {promos.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <Megaphone size={40} className="mx-auto mb-2 opacity-20" />
            <p>No promos yet. Create your first one!</p>
          </div>
        )}
      </div>

      {modal !== null && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex justify-between items-center mb-5">
              <h2 className="font-black text-gray-900">{modal === 'new' ? 'New Promo' : 'Edit Promo'}</h2>
              <button onClick={() => setModal(null)}><X size={20} className="text-gray-400" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Title</label>
                <input value={form.title} onChange={set('title')} placeholder="Double points weekend!"
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none"
                  onFocus={e => e.target.style.borderColor = '#CC0000'} onBlur={e => e.target.style.borderColor = '#e5e7eb'} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Description</label>
                <textarea value={form.description} onChange={set('description')} rows={3} placeholder="Details…"
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none resize-none"
                  onFocus={e => e.target.style.borderColor = '#CC0000'} onBlur={e => e.target.style.borderColor = '#e5e7eb'} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Month</label>
                <select value={form.month} onChange={set('month')}
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none"
                  onFocus={e => e.target.style.borderColor = '#CC0000'} onBlur={e => e.target.style.borderColor = '#e5e7eb'}>
                  <option value="">General / No specific month</option>
                  {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Bonus Points Multiplier</label>
                <input type="number" value={form.bonusPoints} onChange={set('bonusPoints')} placeholder="e.g. 2 for 2x"
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none"
                  onFocus={e => e.target.style.borderColor = '#CC0000'} onBlur={e => e.target.style.borderColor = '#e5e7eb'} />
              </div>
              <ImageUploadSimple
                value={form.imageUrl}
                onChange={(url) => setForm(f => ({ ...f, imageUrl: url }))}
                label="Promo Image (for carousel)"
              />
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.active} onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} className="w-4 h-4" />
                <span className="text-sm font-semibold text-gray-700">Show to customers</span>
              </label>
              <div className="flex gap-3 pt-1">
                <button onClick={() => setModal(null)} className="flex-1 py-2.5 border-2 border-gray-200 rounded-xl text-sm font-bold text-gray-600">Cancel</button>
                <button onClick={save} disabled={saving} className="flex-1 py-2.5 rounded-xl text-sm font-black text-white disabled:opacity-60" style={{ background: '#CC0000' }}>
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
