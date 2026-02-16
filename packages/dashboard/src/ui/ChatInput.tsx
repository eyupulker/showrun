import type React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { COMMAND_REGISTRY } from './chatCommands.js';

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onStop?: () => void;
  isLoading: boolean;
  placeholder?: string;
  disabled?: boolean;
}

export default function ChatInput({
  value,
  onChange,
  onSend,
  onStop,
  isLoading,
  placeholder = 'Type a message...',
  disabled = false,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, []);

  // Compute matching commands for autocomplete
  const suggestions = useMemo(() => {
    const trimmed = value.trim();
    if (!trimmed.startsWith('/') || trimmed.includes(' ')) return [];
    const partial = trimmed.slice(1).toLowerCase();
    return COMMAND_REGISTRY.filter(
      (cmd) => cmd.name.startsWith(partial) || cmd.aliases?.some((a) => a.startsWith(partial))
    );
  }, [value]);

  // Reset selection when suggestions change
  useEffect(() => {
    setSelectedIndex(0);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Autocomplete navigation
    if (suggestions.length > 0) {
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
        return;
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        const cmd = suggestions[selectedIndex];
        if (cmd) {
          onChange(`/${cmd.name} `);
        }
        return;
      }
      if (e.key === 'Escape') {
        // Clear input to dismiss autocomplete
        onChange('');
        return;
      }
    }

    // Submit on Enter (without Shift)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isLoading && value.trim() && !disabled) {
        onSend();
      }
    }
  };

  const handleSuggestionClick = (cmdName: string) => {
    onChange(`/${cmdName} `);
    textareaRef.current?.focus();
  };

  return (
    <div className="chat-input-container">
      <div className="chat-input-wrapper" style={{ position: 'relative' }}>
        {/* Autocomplete dropdown */}
        {suggestions.length > 0 && (
          <div
            style={{
              position: 'absolute',
              bottom: '100%',
              left: 0,
              right: 0,
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '8px',
              marginBottom: '4px',
              overflow: 'hidden',
              zIndex: 10,
              boxShadow: '0 -4px 12px rgba(0, 0, 0, 0.15)',
            }}
          >
            {suggestions.map((cmd, idx) => (
              <div
                key={cmd.name}
                onClick={() => handleSuggestionClick(cmd.name)}
                style={{
                  padding: '8px 12px',
                  cursor: 'pointer',
                  display: 'flex',
                  gap: '8px',
                  alignItems: 'baseline',
                  backgroundColor: idx === selectedIndex ? 'var(--bg-card-active)' : 'transparent',
                  borderBottom:
                    idx < suggestions.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                }}
              >
                <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--accent-blue)' }}>
                  /{cmd.name}
                </span>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  {cmd.description}
                </span>
              </div>
            ))}
          </div>
        )}

        <textarea
          ref={textareaRef}
          className="chat-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={isLoading || disabled}
          rows={1}
        />
        {isLoading ? (
          <button className="stop-btn" onClick={onStop} type="button">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
            Stop
          </button>
        ) : (
          <button
            className="send-btn"
            onClick={onSend}
            disabled={!value.trim() || disabled}
            type="button"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
            Send
          </button>
        )}
      </div>
    </div>
  );
}
