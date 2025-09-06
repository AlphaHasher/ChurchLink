import React, { useState } from "react";

export interface MenuItem {
  title: string;
  imageUrl: string;
  description?: string;
  linkUrl?: string;
}

export interface MenuSectionContent {
  items: MenuItem[];
}

interface MenuSectionProps {
  data: MenuSectionContent;
  isEditing: boolean;
  onChange?: (content: MenuSectionContent) => void;
}

const MenuSection: React.FC<MenuSectionProps> = ({ data, isEditing, onChange }) => {
  const [visibleCount, setVisibleCount] = useState(6);

  const updateItem = (index: number, field: keyof MenuItem, value: string) => {
    const updatedItems = [...data.items];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    onChange?.({ items: updatedItems });
  };

  const addItem = () => {
    const updatedItems = [...data.items, { title: "", imageUrl: "", description: "", linkUrl: "" }];
    onChange?.({ items: updatedItems });
  };

  const removeItem = (index: number) => {
    const updatedItems = data.items.filter((_, i) => i !== index);
    onChange?.({ items: updatedItems });
  };

  const displayedItems = data.items.slice(0, visibleCount);

  return (
    <section className="py-12 bg-white">
      <div className="px-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
          {displayedItems.map((item, idx) => (
            isEditing ? (
              <div
                key={idx}
                className=""
              >
                <div
                  className="w-full h-40 bg-cover bg-center transition-transform duration-300 hover:scale-[1.02] rounded"
                  style={{ backgroundImage: `url(${item.imageUrl})` }}
                ></div>
                <div className="p-4">
                  <input
                    type="text"
                    className="w-full border p-2 mb-2"
                    placeholder="Title"
                    value={item.title}
                    onChange={(e) => updateItem(idx, "title", e.target.value)}
                  />
                  <input
                    type="text"
                    className="w-full border p-2 mb-2"
                    placeholder="Image URL"
                    value={item.imageUrl}
                    onChange={(e) => updateItem(idx, "imageUrl", e.target.value)}
                  />
                  <textarea
                    className="w-full border p-2 mb-2"
                    placeholder="Description"
                    value={item.description || ""}
                    onChange={(e) => updateItem(idx, "description", e.target.value)}
                  />
                  <input
                    type="text"
                    className="w-full border p-2 mb-2"
                    placeholder="Link URL"
                    value={item.linkUrl || ""}
                    onChange={(e) => updateItem(idx, "linkUrl", e.target.value)}
                  />
                  <button
                    className="bg-red-500 text-white px-3 py-1 rounded"
                    onClick={() => removeItem(idx)}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <a
                key={idx}
                href={item.linkUrl ? item.linkUrl : "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="block transition duration-300"
              >
                <div
                  className="w-full h-40 bg-cover bg-center transition-transform duration-300 hover:scale-[1.02] rounded"
                  style={{ backgroundImage: `url(${item.imageUrl})` }}
                ></div>
                <div className="p-4">
                  <h3 className="text-xl font-bold text-black mb-2">{item.title}</h3>
                  <p className="text-sm text-gray-700">{item.description}</p>
                </div>
              </a>
            )
          ))}
        </div>

        {!isEditing && data.items.length > visibleCount && (
          <div className="text-center mt-6">
            <button
              className="bg-gray-300 hover:bg-gray-400 text-black px-4 py-2 rounded"
              onClick={() => setVisibleCount(visibleCount + 6)}
            >
              View More
            </button>
          </div>
        )}

        {isEditing && (
          <div className="text-center mt-6">
            <button
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
              onClick={addItem}
            >
              + Add Item
            </button>
          </div>
        )}
      </div>
    </section>
  );
};

export default MenuSection;
