import { createContext, useContext, useEffect, useState } from "react"
import { useLocation } from "react-router-dom"

type Theme = "dark" | "light" | "system"

type ThemeProviderProps = {
  children: React.ReactNode
  defaultTheme?: Theme
  storageKey?: string
}

type ThemeProviderState = {
  theme: Theme
  setTheme: (theme: Theme) => void
}

const initialState: ThemeProviderState = {
  theme: "light",
  setTheme: () => null,
}

const ThemeProviderContext = createContext<ThemeProviderState>(initialState)

const isAdminOrEditorRoute = (): boolean => {
  const pathname = window.location.pathname
  return pathname.startsWith('/admin') || pathname.startsWith('/web-editor')
}

const getStorageKeyForCurrentRoute = (): string => {
  if (isAdminOrEditorRoute()) {
    return "churchlink-admin-ui-theme"
  }
  return "churchlink-ui-theme"
}

export function ThemeProvider({
  children,
  defaultTheme = "light",
  storageKey = "churchlink-ui-theme",
  ...props
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(() => {
    // Load theme from the appropriate storage key based on current route
    const currentStorageKey = getStorageKeyForCurrentRoute()
    return (localStorage.getItem(currentStorageKey) as Theme) || defaultTheme
  })

  useEffect(() => {
    const root = window.document.documentElement
    const urlParams = new URLSearchParams(window.location.search)
    const isPreviewMode = urlParams.get('preview') === 'true'
    const isInIframe = window.self !== window.top && window.parent !== window

    root.classList.remove("light", "dark")

    const allowDark = isAdminOrEditorRoute()

    // Force light mode on main site
    if (!allowDark) {
      root.classList.add("light")
      return
    }

    // For admin/editor routes, apply theme (but not in preview/iframe)
    if (isPreviewMode || isInIframe) {
      root.classList.add("light")
      return
    }

    if (theme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
        .matches
        ? "dark"
        : "light"
      root.classList.add(systemTheme)
      return
    }

    // Apply the selected theme for admin/editor
    root.classList.add(theme)
  }, [theme])

  const value = {
    theme,
    setTheme: (newTheme: Theme) => {
      // Save to the appropriate storage key based on current route
      const currentStorageKey = getStorageKeyForCurrentRoute()
      localStorage.setItem(currentStorageKey, newTheme)
      setTheme(newTheme)
    },
  }

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  )
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext)

  if (context === undefined)
    throw new Error("useTheme must be used within a ThemeProvider")

  return context
}

export function useThemeRouteSync() {
  const { setTheme } = useTheme()
  const location = useLocation()

  useEffect(() => {
    const currentStorageKey = getStorageKeyForCurrentRoute()
    const storedTheme = (localStorage.getItem(currentStorageKey) as Theme) || "light"
    
    // For main site, always force light mode
    if (!isAdminOrEditorRoute()) {
      setTheme("light")
    } else {
      // For admin routes, load from storage
      setTheme(storedTheme)
    }
  }, [location.pathname, setTheme])
}
