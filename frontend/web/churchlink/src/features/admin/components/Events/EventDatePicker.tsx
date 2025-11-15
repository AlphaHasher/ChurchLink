import { format } from "date-fns"
import { CalendarIcon } from "lucide-react"
import { Button } from "@/shared/components/ui/button"
import { Calendar } from "@/shared/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover"
import { RadioGroup, RadioGroupItem } from "@/shared/components/ui/radio-group"
import { Label } from "@/shared/components/ui/label"
import { cn } from "@/lib/utils"
import { buttonVariants } from "@/shared/components/ui/button"

type Recurrence = "never" | "weekly" | "monthly" | "yearly"

interface EventDatePickerProps {
    date?: Date
    recurring?: Recurrence
    onDateChange?: (date: Date) => void
    onRecurrenceChange?: (value: Recurrence) => void
}

export function EventDatePicker({
    date = new Date(),
    recurring = "never",
    onDateChange = () => { },
    onRecurrenceChange = () => { },
}: EventDatePickerProps) {
    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-start gap-8 flex-wrap">
                <div className="flex flex-col gap-2">
                    <Label className="text-sm font-medium">Select Date</Label>
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                className={cn(
                                    "w-[200px] justify-start text-left font-normal",
                                    "bg-white dark:bg-gray-800 text-black dark:text-white border border-gray-300 dark:border-gray-600",
                                    "shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700"
                                )}
                            >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {date ? format(date, "PPP") : <span>Pick a date</span>}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className={cn(
                            "w-auto p-0",
                            "bg-white dark:bg-gray-800 text-black dark:text-white",
                            "border border-gray-200 dark:border-gray-600 rounded-md shadow-lg"
                        )} align="start">
                            <Calendar
                                mode="single"
                                selected={date}
                                onSelect={(d) => d && onDateChange(d)}
                                initialFocus
                                className="bg-white dark:bg-gray-800 text-black dark:text-white"
                                classNames={{
                                    nav_button: cn(
                                        "bg-transparent text-black dark:text-white shadow-none p-0",
                                        "hover:text-gray-900 dark:hover:text-gray-300"
                                    ),
                                    head_cell: "w-10 text-center text-sm text-muted-foreground dark:text-muted-foreground/80",
                                    cell: "w-10 h-10 text-center align-middle p-0",
                                    day: cn(
                                        buttonVariants({ variant: "ghost" }),
                                        "w-10 h-10 p-0 font-normal bg-transparent",
                                        "text-black dark:text-white",
                                        "hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100",
                                        "aria-selected:bg-blue-500 aria-selected:text-white aria-selected:border-none aria-selected:dark:bg-blue-600",
                                        "focus-visible:bg-transparent focus-visible:outline-none focus-visible:ring-0"
                                    ),
                                    day_selected: "bg-blue-500 text-white border-none dark:bg-blue-600 dark:text-white",
                                    day_disabled: "text-gray-400 dark:text-gray-500"
                                }}
                            />
                        </PopoverContent>
                    </Popover>
                </div>
                <div className="flex flex-col gap-2">
                    <Label className="text-sm font-medium">Recurring</Label>
                    <RadioGroup
                        defaultValue={recurring}
                        value={recurring}
                        onValueChange={(val) => onRecurrenceChange(val as Recurrence)}
                        className="flex flex-wrap gap-4"
                    >
                        {["never", "weekly", "monthly", "yearly"].map((val) => (
                            <div key={val} className="flex items-center space-x-2">
                                <RadioGroupItem
                                    value={val}
                                    id={val}
                                    className={cn(
                                        "bg-white dark:bg-gray-800 text-black dark:text-white border border-gray-300 dark:border-gray-600",
                                        "data-[state=checked]:bg-blue-500 data-[state=checked]:text-white data-[state=checked]:border-transparent",
                                        "focus-visible:ring-0 focus-visible:outline-none hover:bg-gray-50 dark:hover:bg-gray-700"
                                    )}
                                />
                                <Label htmlFor={val} className={cn(
                                    "capitalize text-sm",
                                    "text-black dark:text-white"
                                )}>
                                    {val}
                                </Label>
                            </div>
                        ))}
                    </RadioGroup>
                </div>
            </div>
        </div>
    )
}
