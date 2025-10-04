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
      try {
        if (window.electronAPI) {
          const storedValue = await window.electronAPI.storeGet(key)
          setValue(storedValue !== undefined ? storedValue : defaultValue)
        } else {
          // Fallback to localStorage for web preview
          const item = localStorage.getItem(key)
          setValue(item ? JSON.parse(item) : defaultValue)
        }
      } catch (error) {
        console.error(`Failed to load value for key "${key}":`, error)
        setValue(defaultValue)
      } finally {
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

  // Update function - use setValue's functional update to avoid stale closure
  const updateValue = useCallback(async (newValue) => {
    // Use setValue's callback form to get the latest value
    setValue(currentValue => {
      const valueToStore = typeof newValue === 'function' ? newValue(currentValue) : newValue

      // Perform async update without blocking state update
      if (window.electronAPI) {
        window.electronAPI.storeSet(key, valueToStore)
      } else {
        // Fallback to localStorage
        try {
          localStorage.setItem(key, JSON.stringify(valueToStore))
        } catch (error) {
          console.error('Failed to save to localStorage:', error)
        }
      }

      return valueToStore
    })
  }, [key])

  return [value, updateValue, isLoaded]
}
