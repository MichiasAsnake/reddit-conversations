'use client';

import { useState } from 'react';
import Image from 'next/image';
import SummaryCard from './components/SummaryCard';

interface Card {
  summary: string | string[];
  full_text: string;
  username: string;
  subreddit: string;
  upvotes: number;
  url?: string;
  title?: string;
  description?: string;
}

interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  cards?: Card[];
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (input.length === 0 || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: input.trim()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const lastUserMessage = messages.filter(m => m.type === 'user').slice(-1)[0];
      const previousQuery = lastUserMessage?.content;
      
      const response = await fetch('/api/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          query: input.trim(),
          previousQuery: previousQuery 
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch response');
      }

      const data = await response.json();

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: `Found ${data.cards.length} relevant discussions`,
        cards: data.cards
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: 'Sorry, I encountered an error processing your request.'
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen w-full bg-gray-50">
      <header className="flex align-middle bg-white shadow-sm border-b-gray-400 px-6 py-4">
        <div className="flex items-center gap-3 p-5">
         <Image src="/logo.svg" alt="logo" width={50} height={100}/>
        </div>
        <div className='flex-1 flex flex-col justify-center'>
          <h1 className="text-2xl font-bold text-gray-800">Reddit Chat Assistant</h1>
        <p className="text-sm text-gray-600 mt-1">Get AI-summarized insights from Reddit discussions</p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">
        {messages.length === 0 && (
          <div className="text-center mt-24">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-white text-2xl">💬</span>
            </div>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">Welcome to Reddit Chat Assistant</h2>
            <p className="text-gray-600 max-w-md mx-auto">Ask me anything about Reddit discussions and I&apos;ll find relevant threads with AI-powered summaries!</p>
            <div className="mt-6 text-sm text-gray-500">
              <p>Try asking about: &quot;programming tips&quot;, &quot;career advice&quot;, or &quot;technology trends&quot;</p>
            </div>
          </div>
        )}
        
        {messages.map((message) => (
  <div
    key={message.id}
    className={`w-full ${message.type === 'user' ? 'flex justify-end' : 'space-y-4'}`}
  >
    {message.type === 'user' ? (
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-2xl rounded-br-md px-5 py-3 shadow-sm max-w-[90%]">
        <p className="text-sm leading-relaxed">{message.content}</p>
      </div>
    ) : (
      <>
        <div className="flex justify-start">
          <div className="bg-white rounded-2xl rounded-bl-md px-5 py-3 shadow-sm border max-w-[90%]">
            <p className="text-gray-800 text-sm leading-relaxed">{message.content}</p>
          </div>
        </div>
        {message.cards && (
          <div className="space-y-4">
            {message.cards.map((card, index) => (
              <SummaryCard
                key={index}
                summary={card.summary}
                full_text={card.full_text}
                title={card.title}
                description={card.description}
                metadata={{
                  username: card.username,
                  subreddit: card.subreddit,
                  upvotes: card.upvotes,
                  url: card.url
                }}
              />
            ))}
          </div>
        )}
      </>
    )}
  </div>
))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white rounded-2xl rounded-bl-md px-5 py-4 shadow-sm border">
              <div className="flex items-center gap-3">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                </div>
                <span className="text-gray-600 text-sm">Searching Reddit discussions and generating summaries...</span>
              </div>
            </div>
          </div>
        )}
        </div>
      </div>

      <div className="bg-gradient-to-t from-white to-gray-50/50 px-6 py-6 border-t border-gray-300">
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto">
          <div className="flex gap-3 items-end bg-white rounded-3xl border-2 border-gray-200 px-4 py-3 shadow-lg hover:border-gray-300 focus-within:border-blue-500 transition-all">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about any topic on Reddit..."
              className="p-2 flex-1 outline-none text-gray-800 placeholder-gray-500 text-base bg-transparent resize-none"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={input.length === 0 || isLoading}
              className={`p-2 rounded-full transition-all ${
                input.length === 0 || isLoading
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-700 hover:to-blue-800 hover:scale-105 active:scale-95 cursor-pointer shadow-md'
              }`}
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                </svg>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
