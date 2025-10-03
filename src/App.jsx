import React from 'react'
import TimeLogger from './components/TimeLogger'
import QuickEntry from './components/QuickEntry'

export default function App() {
  // Check if we're in quick-entry mode based on hash
  const isQuickEntry = window.location.hash === '#quick-entry'

  if (isQuickEntry) {
    return <QuickEntry />
  }

  return <TimeLogger />
}
