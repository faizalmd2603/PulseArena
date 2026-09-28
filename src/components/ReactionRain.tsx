import React, { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { ReactionData } from '../types';

interface ReactionRainProps {
  eventId: string;
}

interface FloatingEmojiItem {
  id: string;
  emoji: string;
  leftPercent: number;
  speedSec: number;
  sizeRem: number;
  nickname?: string;
  wobbleDelay: number;
}

export const ReactionRain: React.FC<ReactionRainProps> = ({ eventId }) => {
  const [activeItems, setActiveItems] = useState<FloatingEmojiItem[]>([]);

  useEffect(() => {
    if (!eventId) return;

    // Listen to realtime reactions broadcast from players via the database
    const q = query(
      collection(db, 'reactions'),
      where('event_id', '==', eventId)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const now = Date.now();
        const newItems: FloatingEmojiItem[] = [];

        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const data = change.doc.data() as ReactionData;
            // Only animate reactions that happened within the last 8 seconds
            if (now - data.timestamp < 8000) {
              newItems.push({
                id: `${change.doc.id}_${Math.random().toString(36).substring(2, 7)}`,
                emoji: data.emoji,
                leftPercent: 8 + Math.random() * 84, // disperse horizontally
                speedSec: 2.2 + Math.random() * 1.8, // 2.2s - 4.0s rise time
                sizeRem: 2.5 + Math.random() * 1.5, // varied emoji sizes
                nickname: data.nickname,
                wobbleDelay: Math.random() * 0.5,
              });
            }
          }
        });

        if (newItems.length > 0) {
          // Keep maximum 40 active emojis on screen at a time to prevent any performance hit
          setActiveItems((prev) => [...prev.slice(-35), ...newItems]);
        }
      },
      (err) => {
        console.warn('Realtime reactions listener notice:', err);
      }
    );

    return () => unsubscribe();
  }, [eventId]);

  const handleAnimationEnd = (id: string) => {
    setActiveItems((prev) => prev.filter((item) => item.id !== id));
  };

  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden z-50">
      {activeItems.map((item) => (
        <div
          key={item.id}
          onAnimationEnd={() => handleAnimationEnd(item.id)}
          className="absolute bottom-0 select-none animate-float-up flex flex-col items-center drop-shadow-xl"
          style={{
            left: `${item.leftPercent}%`,
            animationDuration: `${item.speedSec}s`,
            animationDelay: `${item.wobbleDelay}s`,
            fontSize: `${item.sizeRem}rem`,
          }}
        >
          <span className="transform active:scale-125 transition-transform hover:scale-110">
            {item.emoji}
          </span>
          {item.nickname && (
            <span className="text-[11px] font-black bg-slate-900/80 text-white border border-white/20 px-2 py-0.5 rounded-full shadow-lg -mt-1 backdrop-blur-sm whitespace-nowrap">
              {item.nickname}
            </span>
          )}
        </div>
      ))}
    </div>
  );
};
