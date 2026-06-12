'use client';

import { useChatStore } from '@/store/chatStore';
import { useAuthStore } from '@/store/authStore';

export function TypingIndicator() {
  const { activeConversationId, typingUsers } = useChatStore();
  const { userId } = useAuthStore();

  if (!activeConversationId) return null;

  const typers = typingUsers[activeConversationId] ?? {};
  // Exclude current user and only show active typers
  const typingCount = Object.entries(typers).filter(
    ([uid, isTyping]) => isTyping && uid !== userId,
  ).length;

  if (typingCount === 0) return null;

  const label =
    typingCount === 1
      ? 'Someone is typing'
      : `${typingCount} people are typing`;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label}
      style={{ padding: '0 16px 4px 16px', minHeight: '20px', background: 'transparent' }}
    >
      <div
        style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#FFFFFF', borderRadius: '12px', padding: '4px 10px', fontSize: '12px', color: '#888888' }}
      >
        {/* Animated dots */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }} aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="animate-bounce"
              style={{
                display: 'inline-block',
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: '#AAAAAA',
                animationDelay: `${i * 150}ms`,
                animationDuration: '900ms',
              }}
            />
          ))}
        </div>
        <span>{label}</span>
      </div>
    </div>
  );
}
