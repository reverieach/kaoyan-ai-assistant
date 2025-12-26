'use client'

import { useState, useRef, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Plus, X } from 'lucide-react'

interface TagInputProps {
    value?: string[]
    onChange: (tags: string[]) => void
    placeholder?: string
}

export function TagInput({ value = [], onChange, placeholder = "输入标签按回车..." }: TagInputProps) {
    const [inputValue, setInputValue] = useState('')
    const inputRef = useRef<HTMLInputElement>(null)

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault()
            addTag()
        } else if (e.key === 'Backspace' && !inputValue && value.length > 0) {
            removeTag(value.length - 1)
        }
    }

    const addTag = () => {
        const trimmed = inputValue.trim()
        if (trimmed && !value.includes(trimmed)) {
            onChange([...value, trimmed])
            setInputValue('')
        }
    }

    const removeTag = (index: number) => {
        onChange(value.filter((_, i) => i !== index))
    }

    return (
        <div className="flex flex-wrap gap-2 p-2 border rounded-md bg-white focus-within:ring-2 ring-ring ring-offset-2">
            {value.map((tag, index) => (
                <Badge key={index} variant="secondary" className="flex items-center gap-1">
                    {tag}
                    <X
                        className="w-3 h-3 cursor-pointer hover:text-destructive"
                        onClick={() => removeTag(index)}
                    />
                </Badge>
            ))}
            <Input
                ref={inputRef}
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={addTag}
                className="flex-1 border-none !ring-0 !ring-offset-0 min-w-[120px] h-6 p-0 text-sm"
                placeholder={value.length === 0 ? placeholder : ""}
            />
        </div>
    )
}
