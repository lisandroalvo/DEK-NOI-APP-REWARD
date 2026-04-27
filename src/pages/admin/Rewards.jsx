import { useEffect, useState } from 'react'
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { Plus, Pencil, Trash2, X, Gift } from 'lucide-react'

const EMPTY = { name: '', description: '', pointsCost: '', emoji: '', available: true }

export default function AdminRewards() {
  const [rewards, setRewards] = useState([])
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)

  const load = () => getDocs(collection(db, 'rewards')).then(snap => setRewards(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
  useEffect(() => { load() }, [])

  const open = (r = null) => {
    setForm(r ? { name: r.name, description: r.description, pointsCost: String(r.pointsCost), emoji: r.emoji || '', available: r.available } : EMPTY)
    setModal(r ?? 'new')
  }

  const save = async () => {
    setSaving(true)
    const data = { ...form, pointsCost: parseInt(form.pointsCost) || 0, updatedAt: serverTimestamp() }
    try {
      if (modal === 'new') await addDoc(collection(db, 'rewards'), { ...data, createdAt: serverTimestamp() })
      else await updateDoc(doc(db, 'rewards', modal.id), data)
      setModal(null); load()
    } finally { setSaving(false) }
  }

  const remove = async (id) => { if (!confirm('Delete this reward?')) return; await deleteDoc(doc(db, 'rewards', id)); load() }
  const toggle = async (r) => { await updateDoc(doc(db, 'rewards', r.id), { available: !r.available }); load() }
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  return (
    <div className="p-6 md:p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-black text-gray-900">Rewards</h1>
        <button onClick={() => open()} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-black text-white" style={{ background: '#CC0000' }}>
          <Plus size={16} /> New Reward
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {rewards.map(r => (
          <div key={r.id} className={`bg-white rounded-2xl shadow-sm border-2 p-4 ${!r.available ? 'opacity-50' : ''}`}
            style={{ borderColor: r.available ? '#CC0000' : '#e5e7eb' }}>
            <div className="flex justify-between items-start mb-3">
              <span className="text-3xl">{r.emoji || '🎁'}</span>
              <div className="flex gap-1">
                <button onClick={() => open(r)} className="p-1.5 hover:bg-gray-100 rounded-lg"><Pencil size={14} className="text-gray-500" /></button>
                <button onClick={() => remove(r.id)} className="p-1.5 hover:bg-red-50 rounded-lg"><Trash2 size={14} style={{ color: '#CC0000' }} /></button>
              </div>
            </div>
            <h3 className="font-black text-gray-900">{r.name}</h3>
            <p className="text-xs text-gray-500 mt-1 mb-3">{r.description}</p>
            <div className="flex items-center justify-between">
              <span className="font-black text-sm" style={{ color: '#CC0000' }}>⭐ {r.pointsCost} pts</span>
              <button onClick={() => toggle(r)} className="text-xs px-2.5 py-1 rounded-full font-black"
                style={r.available ? { background: '#FFE600', color: '#CC0000' } : { background: '#f3f4f6', color: '#666' }}>
                {r.available ? 'Active' : 'Hidden'}
              </button>
            </div>
          </div>
        ))}
        {rewards.length === 0 && (
          <div className="col-span-3 text-center py-16 text-gray-400">
            <Gift size={40} className="mx-auto mb-2 opacity-20" />
            <p>No rewards yet. Add your first one!</p>
          </div>
        )}
      </div>

      {modal !== null && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex justify-between items-center mb-5">
              <h2 className="font-black text-gray-900">{modal === 'new' ? 'New Reward' : 'Edit Reward'}</h2>
              <button onClick={() => setModal(null)}><X size={20} className="text-gray-400" /></button>
            </div>
            <div className="space-y-4">
              {[
                { label: 'Reward name', key: 'name', placeholder: 'Free coffee', type: 'text' },
                { label: 'Description', key: 'description', placeholder: 'One free coffee of any size', type: 'text' },
                { label: 'Points cost', key: 'pointsCost', placeholder: '500', type: 'number' },
                { label: 'Emoji', key: 'emoji', placeholder: '☕', type: 'text' },
              ].map(({ label, key, placeholder, type }) => (
                <div key={key}>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">{label}</label>
                  <input type={type} value={form[key]} onChange={set(key)} placeholder={placeholder}
                    className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none"
                    onFocus={e => e.target.style.borderColor = '#CC0000'}
                    onBlur={e => e.target.style.borderColor = '#e5e7eb'}
                  />
                </div>
              ))}
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.available} onChange={e => setForm(f => ({ ...f, available: e.target.checked }))} className="w-4 h-4" />
                <span className="text-sm font-semibold text-gray-700">Available to customers</span>
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
