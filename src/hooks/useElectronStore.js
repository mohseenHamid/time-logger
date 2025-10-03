import { useState, useEffect, useCallback } from 'react'

/**
 * Custom hook to sync state with electron-store
 * Automatically syncs across all windows
 */
export function useElectronStore(key, defaultValue) {
  const [value, setValue] = useState(defaultValue)
  const [isLoaded, setIsLoaded] = useState(false)

  // Load initial value
  useEffect(() => {
    const loadValue = async () => {
      if (window.electronAPI) {
        const storedValue = await window.electronAPI.storeGet(key)
        setValue(storedValue !== undefined ? storedValue : defaultValue)
        setIsLoaded(true)
      } else {
        // Fallback to localStorage for web preview
        try {
          const item = localStorage.getItem(key)
          setValue(item ? JSON.parse(item) : defaultValue)
        } catch {
          setValue(defaultValue)
        }
        setIsLoaded(true)
      }
    }
    loadValue()
  }, [key, defaultValue])

  // Listen for updates from other windows
  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.onStoreUpdated((updatedKey, updatedValue) => {
        if (updatedKey === key) {
          setValue(updatedValue)
        }
      })
    }
  }, [key])

  // Update function
  const updateValue = useCallback(async (newValue) => {
    const valueToStore = typeof newValue === 'function' ? newValue(value) : newValue
    
    if (window.electronAPI) {
      await window.electronAPI.storeSet(key, valueToStore)
    } else {
      // Fallback to localStorage
      localStorage.setItem(key, JSON.stringify(valueToStore))
    }
    
    setValue(valueToStore)
  }, [key, value])

  return [value, updateValue, isLoaded]
}
