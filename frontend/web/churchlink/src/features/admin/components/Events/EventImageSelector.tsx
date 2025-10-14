import { useEffect, useState } from "react"
import { Button } from "@/shared/components/ui/button"
import { fetchStrapiImages, processStrapiRedirect } from "@/helpers/StrapiInteraction"
import { Label } from "@/shared/components/ui/label"
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
} from "@/shared/components/ui/command"

interface ImageFile {
    id: number
    name: string
    url: string
}

interface EventImageSelectorProps {
    value?: string
    onChange: (url: string) => void
}

const STRAPI_BASE = import.meta.env.VITE_STRAPI_URL

export function EventImageSelector({ value, onChange }: EventImageSelectorProps) {
    const [searchTerm, setSearchTerm] = useState("")
    const [results, setResults] = useState<ImageFile[]>([])
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        const delayDebounce = setTimeout(() => {
            if (searchTerm.trim() !== "") {
                setLoading(true)
                fetchStrapiImages(searchTerm).then((res) => {
                    setResults(res)
                    setLoading(false)
                })
            } else {
                setResults([])
            }
        }, 300)

        return () => clearTimeout(delayDebounce)
    }, [searchTerm])

    return (
        <div className="flex flex-col gap-4">
            <Label className="text-sm font-medium">Enter Image File Name (Optional)</Label>

            <div className="flex gap-4 items-start flex-wrap">
                <div className="w-[300px]">
                    <Command className="rounded-md border shadow-sm">
                        <CommandInput
                            placeholder="Search image by name..."
                            value={searchTerm}
                            onValueChange={setSearchTerm}
                            className="placeholder:text-sm"
                        />
                        <CommandEmpty>{loading ? "Loading..." : "No results found."}</CommandEmpty>
                        {results.length > 0 && (
                            <CommandGroup heading="Results">
                                {results.map((img) => (
                                    <CommandItem
                                        key={img.id}
                                        value={img.name}
                                        onSelect={() => {
                                            onChange(`${STRAPI_BASE}${img.url}`)
                                            setSearchTerm("")
                                            setResults([])
                                        }}
                                    >
                                        <img src={`${STRAPI_BASE}${img.url}`} alt={img.name} className="w-8 h-8 object-cover rounded mr-2" />

                                        <span>{img.name}</span>
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        )}
                    </Command>
                </div>

                <Button
                    type="button"
                    onClick={processStrapiRedirect}
                    className="!bg-blue-500 text-white hover:!bg-blue-600"
                >
                    Open Media Library
                </Button>
                
                {value && (
                    <Button
                        type="button"
                        onClick={() => onChange("")}
                        className="!bg-gray-500 text-white hover:!bg-gray-600"
                    >
                        Clear Image
                    </Button>
                )}
            </div>

            {value && (
                <div className="mt-4">
                    <Label className="text-sm">Selected Image Preview:</Label>
                    <img
                        src={value.startsWith(STRAPI_BASE) ? value : `${STRAPI_BASE}/uploads/${value}`}
                        alt="Selected"
                        className="mt-2 rounded border w-48 h-32 object-cover"
                    />
                </div>
            )}
        </div>
    )
}