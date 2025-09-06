import React from "react";

export interface ContactItem {
  iconUrl?: string;
  label: string;
  value: string;
}

export interface ContactInfoContent {
  items: ContactItem[];
}

interface ContactInfoSectionProps {
  data: ContactInfoContent;
  isEditing: boolean;
  onChange?: (content: ContactInfoContent) => void;
}

const defaultIcons: Record<string, string> = {
  phone: "https://cdn-icons-png.flaticon.com/512/455/455705.png",
  email: "https://cdn-icons-png.flaticon.com/512/561/561127.png",
};

const ContactInfoSection: React.FC<ContactInfoSectionProps> = ({ data, isEditing, onChange }) => {
  const handleUpdate = (index: number, field: keyof ContactItem, value: string) => {
    const updated = [...data.items];
    updated[index][field] = value;
    onChange?.({ items: updated });
  };

  const handleAdd = () => {
    onChange?.({ items: [...data.items, { label: "", value: "" }] });
  };

  const handleRemove = (index: number) => {
    const updated = data.items.filter((_, i) => i !== index);
    onChange?.({ items: updated });
  };

  return (
    <section className="bg-white py-12 text-center">
      <div className="max-w-4xl mx-auto px-4 grid grid-cols-1 sm:grid-cols-2 gap-8">
        {data.items.map((item, idx) => (
          <div key={idx} className="flex flex-col items-center">
            <img
              src={item.iconUrl || (item.label.toLowerCase().includes("email") ? defaultIcons.email : defaultIcons.phone)}
              alt={item.label}
              className="w-16 h-16 mb-2"
            />
            {isEditing ? (
              <div className="flex flex-col gap-2 w-full">
                <input
                  type="text"
                  placeholder="Label"
                  value={item.label}
                  onChange={(e) => handleUpdate(idx, "label", e.target.value)}
                  className="border p-2 rounded bg-white text-black"
                />
                <input
                  type="text"
                  placeholder="Value"
                  value={item.value}
                  onChange={(e) => handleUpdate(idx, "value", e.target.value)}
                  className="border p-2 rounded bg-white text-black"
                />
                <input
                  type="text"
                  placeholder="Icon URL (optional)"
                  value={item.iconUrl || ""}
                  onChange={(e) => handleUpdate(idx, "iconUrl", e.target.value)}
                  className="border p-2 rounded bg-white text-black"
                />
                <button
                  onClick={() => handleRemove(idx)}
                  className="text-sm text-red-500 hover:underline"
                >
                  Remove
                </button>
              </div>
            ) : (
              <>
                <p className="font-semibold">{item.label}</p>
                <p>{item.value}</p>
              </>
            )}
          </div>
        ))}
      </div>
      {isEditing && (
        <button
          onClick={handleAdd}
          className="mt-6 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Add Contact Item
        </button>
      )}
    </section>
  );
};

export default ContactInfoSection;
