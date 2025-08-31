import React, { useState } from "react";
import { topics as allTopics } from "@/utils/constants";

interface TopicSelectorProps {
  onSubmit: (selectedTopics: string[]) => void;
  maxTopics?: number;
}

export default function TopicSelector({ onSubmit, maxTopics = 5 }: TopicSelectorProps) {
  const [selected, setSelected] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const handleToggle = (topic: string) => {
    if (selected.includes(topic)) {
      setSelected(selected.filter(t => t !== topic));
    } else if (selected.length < maxTopics) {
      setSelected([...selected, topic]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    await onSubmit(selected);
    setSubmitting(false);
  };

  return (
    <form onSubmit={handleSubmit} className="mb-8">
      <h2 className="text-xl font-bold text-white">Let's setup your experience</h2>
      <h3 className="text-gray-400 mb-4 text-sm">Select upto {maxTopics} topics to follow</h3>
      <div className="flex items-center justify-center flex-wrap  gap-2 mb-4">
        {allTopics.map(topic => {
          const isSelected = selected.includes(topic);
          const disableOption = selected.length >= maxTopics && !isSelected;
          return (
            <button
              type="button"
              key={topic}
              className={`px-1 py-2 w-[31%] rounded-full border transition-colors text-white ${isSelected ? 'gradient-fire border-white border-2 font-bold' : 'bg-white/10 border-white/20 '} ${disableOption ? 'opacity-50 cursor-not-allowed' : ''}`}
              onClick={() => !disableOption && handleToggle(topic)}
              disabled={submitting || disableOption}
            >
              {topic}
            </button>
          );
        })}
      </div>
      <button
        type="submit"
        className="w-full gradient-fire  text-white px-6 py-2 rounded-md font-semibold"
        disabled={selected.length === 0 || submitting}
      >
        {submitting ? "Setting up" : "Confirm"}
      </button>
    </form>
  );
}
