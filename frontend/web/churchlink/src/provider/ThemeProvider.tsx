import { createContext, useContext, useEffect, useState } from "react"

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

export function ThemeProvider({
  children,
  defaultTheme = "light",
  storageKey = "churchlink-ui-theme",
  ...props
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem(storageKey) as Theme) || defaultTheme
  )

  useEffect(() => {
    const root = window.document.documentElement
    const isAdminRoute = window.location.pathname.startsWith('/admin')
    const isEditorRoute = window.location.pathname.startsWith('/web-editor')
    const urlParams = new URLSearchParams(window.location.search)
    const isPreviewMode = urlParams.get('preview') === 'true'
    const isInIframe = window.self !== window.top && window.parent !== window

    root.classList.remove("light", "dark")

    const allowDark = isAdminRoute || isEditorRoute

    if (theme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
        .matches
        ? "dark"
        : "light"

      // Only apply dark mode for admin/editor routes, otherwise use light mode
      // Never apply dark mode in preview/iframe mode
      const finalTheme = (allowDark && !isPreviewMode && !isInIframe) ? systemTheme : "light"
      root.classList.add(finalTheme)
      return
    }

    // Only apply dark mode for admin/editor routes and not in preview/iframe mode
    const finalTheme = (allowDark && theme === "dark" && !isPreviewMode && !isInIframe) ? "dark" : "light"
    root.classList.add(finalTheme)
  }, [theme])

  const value = {
    theme,
    setTheme: (theme: Theme) => {
      localStorage.setItem(storageKey, theme)
      setTheme(theme)
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
