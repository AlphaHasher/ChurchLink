import { Moon, Sun } from "lucide-react"
import { Button } from "@/shared/components/ui/button"
import { useTheme } from "@/provider/ThemeProvider"

interface ModeToggleProps {
  className?: string;
}

export function ModeToggle({ className }: ModeToggleProps) {
  const { theme, setTheme } = useTheme();

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark")
  }

  return (
    <Button 
      variant="outline" 
      size="icon" 
      onClick={toggleTheme}
      className={`relative h-7 w-7 border-transparent hover:border-border hover:bg-accent hover:text-accent-foreground dark:hover:text-white ${className}`}
      title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
    >
      <Moon className="h-[0.9rem] w-[0.9rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Sun className="absolute h-[0.9rem] w-[0.9rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  )
}