import { format } from "date-fns"
import { CalendarIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

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
                                className="w-[200px] justify-start text-left font-normal !bg-white !text-black border border-gray-300 shadow-sm hover:!bg-gray-100"
                            >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {date ? format(date, "PPP") : <span>Pick a date</span>}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-2 !bg-white !text-black rounded-md shadow-md border border-gray-200">
                            <Calendar
                                mode="single"
                                selected={date}
                                onSelect={(d) => d && onDateChange(d)}
                                initialFocus
                                className="!bg-white !text-black"
                                classNames={{
                                    nav_button: "!bg-transparent !text-black !shadow-none !p-0 hover:!text-gray-700",
                                    head_cell: "w-10 text-center text-xs text-muted-foreground",
                                    cell: "w-10 h-10 text-center align-middle p-0",
                                    day: cn(
                                        buttonVariants({ variant: "ghost" }),
                                        "w-10 h-10 p-0 font-normal !bg-transparent",
                                        "aria-selected:!bg-blue-400 aria-selected:!text-white aria-selected:!border-none"
                                    ),
                                    day_selected: "!bg-blue-400 text-white !border-none !ring-0 !outline-none"
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
                                    className="!bg-white !text-black border border-gray-300 data-[state=checked]:!bg-blue-500 data-[state=checked]:!text-white  data-[state=checked]:!border-transparent  focus-visible:!ring-0 focus:!outline-none"
                                />
                                <Label htmlFor={val} className="capitalize !text-black text-sm">
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
