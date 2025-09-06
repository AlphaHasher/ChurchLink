import React from "react";

export interface ServiceTimesContent {
  title: string;
  times: { label: string; time: string }[];
}

interface Props {
  data: ServiceTimesContent;
  isEditing?: boolean;
  onChange?: (newData: ServiceTimesContent) => void;
}

const ServiceTimesSection: React.FC<Props> = ({ data, isEditing = false, onChange }) => {
  const handleUpdate = (field: keyof ServiceTimesContent, value: any) => {
    if (onChange) onChange({ ...data, [field]: value });
  };

  const handleTimeUpdate = (index: number, key: "label" | "time", value: string) => {
    const newTimes = [...data.times];
    newTimes[index][key] = value;
    onChange?.({ ...data, times: newTimes });
  };

  const handleAddTime = () => {
    const newTimes = [...data.times, { label: "", time: "" }];
    onChange?.({ ...data, times: newTimes });
  };

  const handleRemoveTime = (index: number) => {
    const newTimes = [...data.times];
    newTimes.splice(index, 1);
    onChange?.({ ...data, times: newTimes });
  };

  return (
    <>
      <div className="mt-4 bg-[#2e403c] text-white py-12 rounded">
        <div className="max-w-6xl mx-auto px-4 text-center">
          {isEditing ? (
            <input
              className="text-3xl font-semibold mb-4 border-b border-white inline-block pb-2 bg-transparent border-none text-center w-full"
              value={data.title}
              onChange={(e) => handleUpdate("title", e.target.value)}
            />
          ) : (
            <h2 className="text-3xl font-semibold mb-4 border-b border-white inline-block pb-2">
              {data.title}
            </h2>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 mt-10">
            {data.times.map((block, index) => (
              <div key={index}>
                {isEditing ? (
                  <>
                    <input
                      type="text"
                      className="font-bold text-lg mb-1 bg-transparent border-b border-white w-full text-center"
                      placeholder="Label"
                      value={block.label}
                      onChange={(e) => handleTimeUpdate(index, "label", e.target.value)}
                    />
                    <input
                      type="text"
                      className="text-md bg-transparent border-b border-white w-full text-center"
                      placeholder="Time"
                      value={block.time}
                      onChange={(e) => handleTimeUpdate(index, "time", e.target.value)}
                    />
                    <button
                      className="text-red-400 mt-1 text-sm"
                      onClick={() => handleRemoveTime(index)}
                    >
                      Remove
                    </button>
                  </>
                ) : (
                  <>
                    <h3 className="font-bold text-lg mb-1">{block.label}</h3>
                    <div className="h-[2px] w-16 bg-white mx-auto my-2" />
                    <p className="text-md">{block.time}</p>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      {isEditing && (
        <div className="mt-2 text-center">
          <button className="text-blue-500" onClick={handleAddTime}>
            ➕ Add Time
          </button>
        </div>
      )}
    </>
  );
};

export default ServiceTimesSection;