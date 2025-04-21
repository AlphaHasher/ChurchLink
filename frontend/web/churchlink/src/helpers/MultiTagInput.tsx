import React, { useState } from 'react';

interface MultiTagInputProps {
  label?: string;
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  suggestions?: string[];
  datalistId?: string;
}

const MultiTagInput: React.FC<MultiTagInputProps> = ({
  label,
  value,
  onChange,
  placeholder = 'Add item',
  suggestions = [],
  datalistId = 'multitag-suggestions',
}) => {
  const [input, setInput] = useState('');

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const trimmed = input.trim();
      if (trimmed && !value.includes(trimmed)) {
        onChange([...value, trimmed]);
        setInput('');
      }
    }
  };

  const removeTag = (index: number) => {
    const newTags = [...value];
    newTags.splice(index, 1);
    onChange(newTags);
  };

  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-sm font-medium">{label}</label>}
      <div className="flex flex-wrap gap-2 items-center">
        {value.map((tag, i) => (
          <span key={i} className="bg-gray-200 text-sm px-2 py-1 rounded flex items-center">
            {tag}
            <button
              type="button"
              className="ml-1 text-red-600 hover:text-red-800"
              onClick={() => removeTag(i)}
            >
              ×
            </button>
          </span>
        ))}
        <input
          type="text"
          className="border px-2 py-1 rounded"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          list={datalistId}
        />
        {suggestions.length > 0 && (
          <datalist id={datalistId}>
            {suggestions.map((s, i) => (
              <option key={i} value={s} />
            ))}
          </datalist>
        )}
      </div>
    </div>
  );
};

export default MultiTagInput;