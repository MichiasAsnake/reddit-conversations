'use client';

import { useState } from 'react';

interface SummaryCardProps {
  summary: string | string[];
  full_text: string;
  title?: string;
  description?: string;
  metadata: {
    username: string;
    subreddit: string;
    upvotes: number;
    url?: string;
  };
}

export default function SummaryCard({ summary, full_text, title, description, metadata }: SummaryCardProps) {
  const [isFlipped, setIsFlipped] = useState(false);

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
  };


  return (
    <div className="w-full max-w-2xl">
      {!isFlipped ? (
        /* Front of card */
        <div className="bg-gradient-to-br from-white to-blue-50 border rounded-lg p-5 shadow-md hover:shadow-lg transition-all duration-300">
          <div className="flex flex-col">
            <div className="flex justify-between items-start mb-4">
              <div className="flex-1 min-w-0 pr-4">
                {Array.isArray(summary) ? (
                  <div>
                    <h3 className="font-semibold text-lg mb-2 text-gray-800">{title || '💡 Key Insights'}</h3>
                    {description && (
                      <p className="text-sm text-gray-600 mb-3 leading-relaxed">{description}</p>
                    )}
                    <ul className="space-y-2 text-gray-700">
                      {summary.map((point, idx) => (
                        <li key={idx} className="flex items-start">
                          <span className="text-blue-500 mr-2 mt-1 flex-shrink-0">•</span>
                          <span className="text-sm leading-relaxed break-words">{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <h3 className="font-semibold text-lg text-gray-800 break-words">{summary}</h3>
                )}
              </div>
              <div className="flex-shrink-0 text-center">
                <span className="text-orange-600 font-bold text-base">↑ {metadata.upvotes}</span>
                <div className="text-xs text-gray-500 mt-1">upvotes</div>
              </div>
            </div>
            
            <div className="mt-4 bg-white/80 rounded-lg p-3 border">
              <div className="flex justify-between items-center gap-3">
                <div className="flex gap-2 text-sm text-gray-600 min-w-0 flex-1">
                  <span className="font-medium truncate">{metadata.username}</span>
                  <span className="flex-shrink-0">•</span>
                  <span className="text-blue-600 truncate">{metadata.subreddit}</span>
                </div>
                <button
                  onClick={handleFlip}
                  className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors shadow-sm flex-shrink-0"
                >
                  Read More →
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Back of card */
        <div className="bg-gradient-to-br from-gray-50 to-gray-100 border rounded-lg p-5 shadow-md transition-all duration-300">
          <div className="flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-lg text-gray-800">💬 Full Discussion</h3>
              <button
                onClick={handleFlip}
                className="px-3 py-1.5 text-xs bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors shadow-sm flex-shrink-0"
              >
                ← Back
              </button>
            </div>
            
            <div className="mb-4 bg-white rounded-lg p-4 border max-h-96 overflow-y-auto">
              <p className="text-gray-700 text-sm whitespace-pre-line leading-relaxed break-words">
                {full_text}
              </p>
            </div>
            
            <div className="bg-white/80 rounded-lg p-3 border">
              <div className="flex justify-between items-center gap-3">
                <div className="flex gap-2 text-sm text-gray-600 min-w-0 flex-1">
                  <span className="font-medium truncate">{metadata.username}</span>
                  <span className="flex-shrink-0">•</span>
                  <span className="text-blue-600 truncate">{metadata.subreddit}</span>
                  <span className="flex-shrink-0">•</span>
                  <span className="text-orange-600 font-medium flex-shrink-0">↑ {metadata.upvotes}</span>
                </div>
                {metadata.url && (
                  <a 
                    href={metadata.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 text-xs bg-orange-500 text-white rounded-md hover:bg-orange-600 transition-colors shadow-sm flex-shrink-0"
                  >
                    Reddit →
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}