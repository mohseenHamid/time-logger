import React, { useState, useRef, useEffect, useMemo } from 'react'
import { useElectronStore } from '../hooks/useElectronStore'
import { defaultCategories } from '../data/defaultCategories'
import { nowISO, toLocalHM, fuzzyScore } from '../utils/helpers'

export default function QuickEntry() {
  const [categories] = useElectronStore('timelog.categories.v1', defaultCategories())
  const [entries, setEntries] = useElectronStore('timelog.entries.v2', [])
  
  const [text, setText] = useState('')
  const [tsISO, setTsISO] = useState(nowISO())
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0])
  const [showDropdown, setShowDropdown] = useState(false)
  const inputRef = useRef(null)

  // Focus input when window appears
  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.onFocusInput(() => {
        setTimeout(() => {
          inputRef.current?.focus()
        }, 100)
      })
    }
  }, [])

  // Auto-focus on mount
  useEffect(() => {
    setTimeout(() => {
      inputRef.current?.focus()
    }, 100)
  }, [])

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
      .slice(0, 5)
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
    
    // Create new category
    const ticket = freeText.trim()
    const newCat = { 
      id: `cat-${Date.now()}`, 
      ticket, 
      description: 'Ad-hoc', 
      label: `${ticket}`, 
      nonWork: false 
    }
    // Note: We don't update categories here in quick entry to keep it fast
    // The main app will handle new category creation
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
    
    // Clear form
    setText('')
    setTsISO(nowISO())
    setEntryDate(new Date().toISOString().split('T')[0])
    
    // Hide window
    if (window.electronAPI) {
      window.electronAPI.quickEntrySubmitted()
    }
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

  function onEscape(e) {
    if (e.key === 'Escape') {
      if (window.electronAPI) {
        window.electronAPI.hideQuickEntry()
      }
    }
  }

  return (
    <div className="w-full h-full bg-neutral-950/95 backdrop-blur-sm border border-neutral-800 rounded-2xl p-4 shadow-2xl">
      <form onSubmit={onSubmit} className="space-y-3">
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={entryDate}
            onChange={(e) => setEntryDate(e.target.value)}
            className="px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-700 text-neutral-100 text-sm"
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
            className="px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-700 text-neutral-100 w-24"
          />
          <div className="flex-1 relative">
            <input
              ref={inputRef}
              placeholder="Type activity (e.g. 85n, API ticket, lunch)"
              value={text}
              onChange={(e) => {
                setText(e.target.value)
                setShowDropdown(e.target.value.trim().length > 0)
              }}
              onFocus={() => setShowDropdown(text.trim().length > 0)}
              onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
              onKeyDown={onEscape}
              className="w-full px-4 py-2 rounded-xl bg-neutral-900 border border-neutral-700 text-neutral-100 placeholder-neutral-400"
            />
            {showDropdown && filteredCats.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 rounded-xl overflow-hidden border border-neutral-700 bg-neutral-900 shadow-xl z-10">
                {filteredCats.map(c => (
                  <button 
                    type="button" 
                    key={c.id} 
                    onMouseDown={(e) => e.preventDefault()} 
                    onClick={() => onPickFromDropdown(c)} 
                    className="w-full text-left px-4 py-2 hover:bg-neutral-800 text-neutral-100"
                  >
                    <div className="font-medium">{c.ticket}</div>
                    <div className="text-xs opacity-75">{c.description}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        
        <div className="flex gap-2">
          <button 
            type="submit" 
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium"
          >
            Log Entry
          </button>
          <button 
            type="button" 
            onClick={() => {
              setText('')
              setTsISO(nowISO())
              inputRef.current?.focus()
            }} 
            className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300"
          >
            Clear
          </button>
        </div>
      </form>
      
      <div className="mt-2 text-xs text-neutral-500 text-center">
        Press Esc to close • Ctrl+Shift+T to reopen
      </div>
    </div>
  )
}
