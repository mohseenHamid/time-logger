import React, { useMemo, useRef, useState, useEffect } from 'react'
import { useElectronStore } from '../hooks/useElectronStore'
import { defaultCategories } from '../data/defaultCategories'
import { 
  nowISO, 
  toLocalHM, 
  startOfDay, 
  endOfDay, 
  startOfWeekMonday, 
  endOfWeekMonday, 
  startOfMonth, 
  endOfMonth, 
  fuzzyScore, 
  humanHM 
} from '../utils/helpers'

export default function TimeLogger() {
  const [tab, setTab] = useState('log') // 'log' | 'categories'
  const [range, setRange] = useState('day') // 'day' | 'week' | 'month'
  const [totalsView, setTotalsView] = useState('work') // 'work' | 'all'

  const [categories, setCategories] = useElectronStore('timelog.categories.v1', defaultCategories())
  const [entries, setEntries] = useElectronStore('timelog.entries.v2', [])
  const [text, setText] = useState('')
  const [tsISO, setTsISO] = useState(nowISO())
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0]) // YYYY-MM-DD format
  const [showDropdown, setShowDropdown] = useState(false)
  const [editingEntry, setEditingEntry] = useState(null)
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [newCategory, setNewCategory] = useState({ ticket: '', description: '', nonWork: false })
  const [bulkDeleteMode, setBulkDeleteMode] = useState(false)
  const [selectedCategories, setSelectedCategories] = useState(new Set())
  const inputRef = useRef(null)

  // Filter categories for dropdown once user has typed >= 1 char
  const filteredCats = useMemo(() => {
    const q = text.trim()
    if (q.length === 0) return []
    const scored = categories.map(c => ({ 
      c, 
      score: Math.max(
        fuzzyScore(q, c.label), 
        fuzzyScore(q, c.ticket), 
        fuzzyScore(q, c.description)
      ) 
    }))
    return scored
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
      .map(s => s.c)
  }, [text, categories])

  function pickCategoryForFreeText(freeText) {
    const candidates = categories.map(c => ({ 
      c, 
      score: Math.max(
        fuzzyScore(freeText, c.label), 
        fuzzyScore(freeText, c.ticket), 
        fuzzyScore(freeText, c.description)
      ) 
    }))
    candidates.sort((a, b) => b.score - a.score)
    const top = candidates[0]
    if (top && top.score >= 60) return top.c
    
    const ticket = freeText.trim()
    const newCat = { 
      id: `cat-${Date.now()}`, 
      ticket, 
      description: 'Ad-hoc', 
      label: `${ticket}`, 
      nonWork: false 
    }
    setCategories(prev => [...prev, newCat])
    return newCat
  }

  function addEntry(cat) {
    // Combine the selected date with the time
    const [hours, minutes] = toLocalHM(tsISO).split(':').map(Number)
    const entryDateTime = new Date(entryDate)
    entryDateTime.setHours(hours, minutes, 0, 0)
    
    const entry = { 
      id: `e-${Date.now()}`, 
      tsISO: entryDateTime.toISOString(), 
      rawText: cat.ticket, // Store the final selected ticket, not the typed text
      categoryId: cat.id, 
      label: cat.label 
    }
    const next = [...entries, entry].sort((a, b) => new Date(a.tsISO) - new Date(b.tsISO))
    setEntries(next)
    setText('')
    setTsISO(nowISO())
    setEntryDate(new Date().toISOString().split('T')[0]) // Reset to today
    inputRef.current?.focus()
  }

  function onSubmit(e) {
    e.preventDefault()
    const freeText = text.trim()
    if (!freeText) return
    const cat = pickCategoryForFreeText(freeText)
    addEntry(cat)
  }

  function onPickFromDropdown(c) {
    setText(`${c.ticket}`)
    setTimeout(() => addEntry(c), 0)
  }

  function deleteEntry(entryId) {
    if (confirm('Are you sure you want to delete this entry?')) {
      setEntries(prev => prev.filter(e => e.id !== entryId))
    }
  }

  function startEditEntry(entry) {
    setEditingEntry(entry)
    setText(entry.rawText)
    setTsISO(entry.tsISO)
    setEntryDate(new Date(entry.tsISO).toISOString().split('T')[0])
  }

  function saveEditEntry() {
    if (!editingEntry) return
    const freeText = text.trim()
    if (!freeText) return
    
    // Combine the selected date with the time
    const [hours, minutes] = toLocalHM(tsISO).split(':').map(Number)
    const entryDateTime = new Date(entryDate)
    entryDateTime.setHours(hours, minutes, 0, 0)
    
    const cat = pickCategoryForFreeText(freeText)
    const updatedEntry = {
      ...editingEntry,
      tsISO: entryDateTime.toISOString(),
      rawText: cat.ticket, // Store the final selected ticket
      categoryId: cat.id,
      label: cat.label
    }
    
    setEntries(prev => prev.map(e => e.id === editingEntry.id ? updatedEntry : e))
    setEditingEntry(null)
    setText('')
    setTsISO(nowISO())
    setEntryDate(new Date().toISOString().split('T')[0])
  }

  function cancelEdit() {
    setEditingEntry(null)
    setText('')
    setTsISO(nowISO())
    setEntryDate(new Date().toISOString().split('T')[0])
  }

  function openCategoryModal() {
    setNewCategory({ ticket: '', description: '', nonWork: false })
    setShowCategoryModal(true)
  }

  function saveCategoryFromModal() {
    if (!newCategory.ticket.trim()) return
    
    const cat = {
      id: `cat-${Date.now()}`,
      ticket: newCategory.ticket.trim(),
      description: newCategory.description.trim() || 'Custom category',
      label: `${newCategory.ticket.trim()} — ${newCategory.description.trim() || 'Custom category'}`,
      nonWork: newCategory.nonWork
    }
    
    setCategories(prev => [cat, ...prev])
    setShowCategoryModal(false)
    setNewCategory({ ticket: '', description: '', nonWork: false })
  }

  function cancelCategoryModal() {
    setShowCategoryModal(false)
    setNewCategory({ ticket: '', description: '', nonWork: false })
  }

  function toggleBulkDeleteMode() {
    setBulkDeleteMode(!bulkDeleteMode)
    setSelectedCategories(new Set())
  }

  function toggleCategorySelection(categoryId) {
    setSelectedCategories(prev => {
      const newSet = new Set(prev)
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId)
      } else {
        newSet.add(categoryId)
      }
      return newSet
    })
  }

  function selectAllCategories() {
    setSelectedCategories(new Set(categories.map(c => c.id)))
  }

  function deselectAllCategories() {
    setSelectedCategories(new Set())
  }

  function bulkDeleteSelected() {
    if (selectedCategories.size === 0) return
    
    const count = selectedCategories.size
    if (confirm(`Delete ${count} selected categor${count === 1 ? 'y' : 'ies'}?`)) {
      setCategories(prev => prev.filter(c => !selectedCategories.has(c.id)))
      setSelectedCategories(new Set())
      setBulkDeleteMode(false)
    }
  }

  // Range filtering
  const today = new Date()
  const rangeBounds = useMemo(() => {
    if (range === 'day') return { start: startOfDay(today), end: endOfDay(today) }
    if (range === 'week') return { start: startOfWeekMonday(today), end: endOfWeekMonday(today) }
    return { start: startOfMonth(today), end: endOfMonth(today) } // month
  }, [range])

  const inRangeEntries = useMemo(() => {
    return entries.filter(e => {
      const d = new Date(e.tsISO)
      return d >= rangeBounds.start && d <= rangeBounds.end
    }).sort((a, b) => new Date(a.tsISO) - new Date(b.tsISO))
  }, [entries, rangeBounds])

  // Durations per entry
  const rowsWithDurations = useMemo(() => {
    // group by day
    const byDay = new Map()
    for (const e of inRangeEntries) {
      const key = new Date(e.tsISO).toDateString()
      if (!byDay.has(key)) byDay.set(key, [])
      byDay.get(key).push(e)
    }
    const result = []
    for (const [, list] of byDay) {
      list.sort((a, b) => new Date(a.tsISO) - new Date(b.tsISO))
      for (let i = 0; i < list.length; i++) {
        const current = list[i]
        const next = list[i + 1]
        const minutes = next ? Math.max(0, Math.round((new Date(next.tsISO) - new Date(current.tsISO)) / 60000)) : 0
        result.push({ ...current, minutes })
      }
    }
    return result.sort((a, b) => new Date(a.tsISO) - new Date(b.tsISO))
  }, [inRangeEntries])

  // Totals by activity
  const totalsByActivity = useMemo(() => {
    const map = new Map()
    for (const r of rowsWithDurations) {
      const cat = categories.find(c => c.id === r.categoryId)
      if (!cat) continue
      if (totalsView === 'work' && cat.nonWork) continue
      const key = cat.label
      map.set(key, (map.get(key) || 0) + r.minutes)
    }
    const rows = Array.from(map.entries())
      .map(([label, minutes]) => ({ label, minutes, hm: humanHM(minutes) }))
      .sort((a, b) => b.minutes - a.minutes)
    const total = rows.reduce((s, r) => s + r.minutes, 0)
    return { rows, total, totalHM: humanHM(total) }
  }, [rowsWithDurations, categories, totalsView])

  return (
    <div className="min-h-screen p-6 bg-neutral-950 text-neutral-100">
      <div className="max-w-4xl mx-auto grid gap-6">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Time Logger</h1>
          <nav className="flex gap-2">
            <button 
              onClick={() => setTab('log')} 
              className={`px-4 py-2 rounded-xl font-medium ${
                tab === 'log' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
              }`}
            >
              Log & Timeline
            </button>
            <button 
              onClick={() => setTab('categories')} 
              className={`px-4 py-2 rounded-xl font-medium ${
                tab === 'categories' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
              }`}
            >
              Categories
            </button>
          </nav>
        </header>

        {tab === 'log' && (
          <>
            {/* Quick logger */}
            <section className="bg-neutral-900 rounded-2xl p-6 border border-neutral-800">
              <h2 className="text-lg font-semibold mb-4">
                {editingEntry ? 'Edit Entry' : 'Quick Entry'}
              </h2>
              <form onSubmit={editingEntry ? (e) => { e.preventDefault(); saveEditEntry(); } : onSubmit} className="grid gap-4">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-center">
                  <input
                    type="date"
                    value={entryDate}
                    onChange={(e) => setEntryDate(e.target.value)}
                    className="px-3 py-2 rounded-xl bg-neutral-800 border border-neutral-700 text-neutral-100"
                  />
                  <input
                    type="time"
                    value={toLocalHM(tsISO)}
                    onChange={(e) => {
                      const [h, m] = e.target.value.split(':').map(Number)
                      const d = new Date()
                      d.setHours(h, m, 0, 0)
                      setTsISO(d.toISOString())
                    }}
                    className="px-3 py-2 rounded-xl bg-neutral-800 border border-neutral-700 text-neutral-100"
                  />
                  <div className="md:col-span-3 relative">
                    <input
                      ref={inputRef}
                      placeholder="Type activity (e.g. 85n, API ticket, lunch)"
                      value={text}
                      onChange={(e) => {
                        setText(e.target.value)
                        setShowDropdown(e.target.value.trim().length > 0)
                      }}
                      onFocus={() => setShowDropdown(text.trim().length > 0)}
                      onBlur={() => setTimeout(() => setShowDropdown(false), 120)}
                      className="w-full px-4 py-2 rounded-xl bg-neutral-800 border border-neutral-700 text-neutral-100 placeholder-neutral-400"
                    />
                    {showDropdown && filteredCats.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 rounded-xl overflow-hidden border border-neutral-700 bg-neutral-800 shadow-xl z-10">
                        {filteredCats.map(c => (
                          <button 
                            type="button" 
                            key={c.id} 
                            onMouseDown={(e) => e.preventDefault()} 
                            onClick={() => onPickFromDropdown(c)} 
                            className="w-full text-left px-4 py-3 hover:bg-neutral-700 text-neutral-100"
                          >
                            <div className="font-medium">{c.ticket}</div>
                            <div className="text-sm opacity-75">{c.description}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex gap-3">
                  <button 
                    type="submit" 
                    className="px-6 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium"
                  >
                    {editingEntry ? 'Save Changes' : 'Log Entry'}
                  </button>
                  {editingEntry ? (
                    <button 
                      type="button" 
                      onClick={cancelEdit}
                      className="px-6 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300"
                    >
                      Cancel
                    </button>
                  ) : (
                    <button 
                      type="button" 
                      onClick={() => {
                        setText('')
                        setTsISO(nowISO())
                        inputRef.current?.focus()
                      }} 
                      className="px-6 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </form>
            </section>

            {/* Timeline + Range */}
            <section className="bg-neutral-900 rounded-2xl p-6 border border-neutral-800">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Timeline</h2>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setRange('day')} 
                    className={`px-3 py-1.5 rounded-xl text-sm font-medium ${
                      range === 'day' 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                    }`}
                  >
                    Day
                  </button>
                  <button 
                    onClick={() => setRange('week')} 
                    className={`px-3 py-1.5 rounded-xl text-sm font-medium ${
                      range === 'week' 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                    }`}
                  >
                    Week
                  </button>
                  <button 
                    onClick={() => setRange('month')} 
                    className={`px-3 py-1.5 rounded-xl text-sm font-medium ${
                      range === 'month' 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                    }`}
                  >
                    Month
                  </button>
                </div>
              </div>
              {rowsWithDurations.length === 0 ? (
                <div className="text-center py-8 text-neutral-400">
                  No entries in this range.
                </div>
              ) : (
                <div className="space-y-2">
                  {rowsWithDurations.map(r => {
                    const cat = categories.find(c => c.id === r.categoryId)
                    const nonWork = cat?.nonWork
                    return (
                      <div 
                        key={r.id} 
                        className={`flex items-center justify-between px-4 py-3 rounded-xl border ${
                          nonWork 
                            ? 'border-neutral-800 bg-neutral-800/50 opacity-70' 
                            : 'border-neutral-700 bg-neutral-800'
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <div className="text-sm text-neutral-400 w-32">
                            {new Date(r.tsISO).toLocaleDateString()} {toLocalHM(r.tsISO)}
                          </div>
                          <div className="font-medium">{r.label}</div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-sm font-medium">{r.minutes} min</div>
                          <div className="flex gap-1">
                            <button
                              onClick={() => startEditEntry(r)}
                              className="px-2 py-1 text-xs rounded bg-blue-600 hover:bg-blue-700 text-white"
                              title="Edit entry"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => deleteEntry(r.id)}
                              className="px-2 py-1 text-xs rounded bg-red-600 hover:bg-red-700 text-white"
                              title="Delete entry"
                            >
                              Del
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>

            {/* Totals */}
            <section className="bg-neutral-900 rounded-2xl p-6 border border-neutral-800">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Totals</h2>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setTotalsView('work')} 
                    className={`px-3 py-1.5 rounded-xl text-sm font-medium ${
                      totalsView === 'work' 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                    }`}
                  >
                    Work only
                  </button>
                  <button 
                    onClick={() => setTotalsView('all')} 
                    className={`px-3 py-1.5 rounded-xl text-sm font-medium ${
                      totalsView === 'all' 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                    }`}
                  >
                    All activities
                  </button>
                </div>
              </div>
              {totalsByActivity.rows.length === 0 ? (
                <div className="text-center py-8 text-neutral-400">
                  No time logged yet.
                </div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-neutral-700">
                  <table className="w-full">
                    <thead className="bg-neutral-800">
                      <tr>
                        <th className="text-left px-4 py-3 font-medium">Activity</th>
                        <th className="text-right px-4 py-3 font-medium">Minutes</th>
                        <th className="text-right px-4 py-3 font-medium">Hours</th>
                      </tr>
                    </thead>
                    <tbody>
                      {totalsByActivity.rows.map(r => (
                        <tr key={r.label} className="border-t border-neutral-800">
                          <td className="px-4 py-3">{r.label}</td>
                          <td className="px-4 py-3 text-right">{r.minutes}</td>
                          <td className="px-4 py-3 text-right font-mono">{r.hm}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-neutral-700 font-semibold bg-neutral-800">
                        <td className="px-4 py-3">Total</td>
                        <td className="px-4 py-3 text-right">{totalsByActivity.total}</td>
                        <td className="px-4 py-3 text-right font-mono">{totalsByActivity.totalHM}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </section>
          </>
        )}

        {tab === 'categories' && (
          <section className="bg-neutral-900 rounded-2xl p-6 border border-neutral-800">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-semibold">Categories</h2>
              <div className="flex gap-2">
                {!bulkDeleteMode ? (
                  <>
                    <button
                      onClick={toggleBulkDeleteMode}
                      className="px-3 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-medium"
                    >
                      Bulk Delete
                    </button>
                    <button
                      onClick={openCategoryModal}
                      className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium"
                    >
                      + Add Category
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={selectAllCategories}
                      className="px-3 py-2 rounded-xl bg-neutral-700 hover:bg-neutral-600 text-white text-sm"
                    >
                      Select All
                    </button>
                    <button
                      onClick={deselectAllCategories}
                      className="px-3 py-2 rounded-xl bg-neutral-700 hover:bg-neutral-600 text-white text-sm"
                    >
                      Clear
                    </button>
                    <button
                      onClick={bulkDeleteSelected}
                      disabled={selectedCategories.size === 0}
                      className="px-3 py-2 rounded-xl bg-red-600 hover:bg-red-700 disabled:bg-neutral-700 disabled:cursor-not-allowed text-white text-sm font-medium"
                    >
                      Delete ({selectedCategories.size})
                    </button>
                    <button
                      onClick={toggleBulkDeleteMode}
                      className="px-3 py-2 rounded-xl bg-neutral-600 hover:bg-neutral-500 text-white text-sm"
                    >
                      Cancel
                    </button>
                  </>
                )}
              </div>
            </div>
            <p className="text-sm text-neutral-400 mb-6">
              Manage preset categories for quick logging. Toggle "Non-work" to exclude from work-only totals.
            </p>
            <div className="space-y-4">
              {/* Header row with labels */}
              <div className={`grid gap-3 items-center px-4 py-2 text-sm font-medium text-neutral-400 border-b border-neutral-700 ${bulkDeleteMode ? 'grid-cols-1 md:grid-cols-6' : 'grid-cols-1 md:grid-cols-5'}`}>
                {bulkDeleteMode && <div className="w-8">Select</div>}
                <div>Ticket Code</div>
                <div className="md:col-span-2">Description</div>
                <div>Generated Label</div>
                <div className="justify-self-end">Settings</div>
              </div>
              
              {categories.map((c) => (
                <div 
                  key={c.id} 
                  className={`grid gap-3 items-center p-4 rounded-xl border border-neutral-700 bg-neutral-800 ${bulkDeleteMode ? 'grid-cols-1 md:grid-cols-6' : 'grid-cols-1 md:grid-cols-5'}`}
                >
                  {bulkDeleteMode && (
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        checked={selectedCategories.has(c.id)}
                        onChange={() => toggleCategorySelection(c.id)}
                        className="w-4 h-4 rounded"
                      />
                    </div>
                  )}
                  <div className="space-y-1">
                    <label className="block text-xs text-neutral-400 md:hidden">Ticket Code</label>
                    <input
                      value={c.ticket}
                      onChange={(e) => 
                        setCategories(prev => 
                          prev.map(x => 
                            x.id === c.id 
                              ? { ...x, ticket: e.target.value, label: `${e.target.value} — ${x.description}` } 
                              : x
                          )
                        )
                      }
                      placeholder="e.g., 85n, API"
                      className="w-full px-3 py-2 rounded-lg bg-neutral-900 border border-neutral-600 text-neutral-100 placeholder-neutral-500"
                    />
                  </div>
                  <div className="md:col-span-2 space-y-1">
                    <label className="block text-xs text-neutral-400 md:hidden">Description</label>
                    <input
                      value={c.description}
                      onChange={(e) => 
                        setCategories(prev => 
                          prev.map(x => 
                            x.id === c.id 
                              ? { ...x, description: e.target.value, label: `${x.ticket} — ${e.target.value}` } 
                              : x
                          )
                        )
                      }
                      placeholder="e.g., Work item, Meeting, Break"
                      className="w-full px-3 py-2 rounded-lg bg-neutral-900 border border-neutral-600 text-neutral-100 placeholder-neutral-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs text-neutral-400 md:hidden">Generated Label</label>
                    <div className="text-sm text-neutral-400 font-mono bg-neutral-900 px-3 py-2 rounded-lg border border-neutral-700">
                      {c.label}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 justify-self-end">
                    <label className="flex items-center gap-2">
                      <input 
                        type="checkbox" 
                        checked={c.nonWork} 
                        onChange={(e) => 
                          setCategories(prev => 
                            prev.map(x => 
                              x.id === c.id 
                                ? { ...x, nonWork: e.target.checked } 
                                : x
                            )
                          )
                        } 
                        className="rounded"
                      />
                      <span className="text-sm">Non-work</span>
                    </label>
                    <button
                      onClick={() => {
                        if (confirm(`Delete category "${c.label}"?`)) {
                          setCategories(prev => prev.filter(x => x.id !== c.id))
                        }
                      }}
                      className="px-2 py-1 text-xs rounded bg-red-600 hover:bg-red-700 text-white"
                      title="Delete category"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Category Modal */}
        {showCategoryModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-neutral-900 rounded-2xl p-6 w-full max-w-md mx-4 border border-neutral-700">
              <h3 className="text-lg font-semibold mb-4">Add New Category</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-2">
                    Ticket Code *
                  </label>
                  <input
                    type="text"
                    value={newCategory.ticket}
                    onChange={(e) => setNewCategory(prev => ({ ...prev, ticket: e.target.value }))}
                    placeholder="e.g., 85n, MEETING, API"
                    className="w-full px-3 py-2 rounded-lg bg-neutral-800 border border-neutral-600 text-neutral-100 placeholder-neutral-500"
                    autoFocus
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-2">
                    Description
                  </label>
                  <input
                    type="text"
                    value={newCategory.description}
                    onChange={(e) => setNewCategory(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="e.g., Work item, Daily meeting, Break"
                    className="w-full px-3 py-2 rounded-lg bg-neutral-800 border border-neutral-600 text-neutral-100 placeholder-neutral-500"
                  />
                </div>
                
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="nonWork"
                    checked={newCategory.nonWork}
                    onChange={(e) => setNewCategory(prev => ({ ...prev, nonWork: e.target.checked }))}
                    className="rounded"
                  />
                  <label htmlFor="nonWork" className="text-sm text-neutral-300">
                    Non-work activity (exclude from work totals)
                  </label>
                </div>
                
                {newCategory.ticket && (
                  <div className="p-3 bg-neutral-800 rounded-lg">
                    <div className="text-xs text-neutral-400 mb-1">Preview:</div>
                    <div className="text-sm font-mono text-neutral-200">
                      {newCategory.ticket} — {newCategory.description || 'Custom category'}
                    </div>
                  </div>
                )}
              </div>
              
              <div className="flex gap-3 mt-6">
                <button
                  onClick={saveCategoryFromModal}
                  disabled={!newCategory.ticket.trim()}
                  className="flex-1 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-neutral-700 disabled:cursor-not-allowed text-white font-medium"
                >
                  Add Category
                </button>
                <button
                  onClick={cancelCategoryModal}
                  className="px-4 py-2 rounded-xl bg-neutral-700 hover:bg-neutral-600 text-neutral-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
