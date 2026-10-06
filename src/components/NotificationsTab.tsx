/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Bell, MessageCircle, ShieldAlert } from 'lucide-react';
import { SystemNotification, User, SystemSettings } from '../types';
import { formatThaiDateTime } from '../utils/thaiTime';

interface NotificationsTabProps {
  notifications: SystemNotification[];
  currentUser: User | null;
  settings: SystemSettings;
  onNavigate: (tab: string) => void;
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
}

export default function NotificationsTab({
  notifications,
  currentUser,
  settings,
  onNavigate,
  onMarkAsRead,
  onMarkAllAsRead
}: NotificationsTabProps) {
  // Filter notifications relevant to current user: either target "all" or specific user's ID
  const relevantList = notifications
    .filter(notif => {
      // Exclude default seed announcements (welcome, maintenance notices)
      if (notif.isSystemAnnouncement || notif.id === 'N00001' || notif.id === 'N00002') return false;
      if (notif.title?.includes('ยินดีต้อนรับ') || notif.title?.includes('ปิดปรับปรุง')) return false;
      return notif.userId === 'all' || (currentUser && notif.userId === currentUser.id);
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <div className="px-4 py-8 md:px-8 max-w-xl mx-auto pb-32 animate-fade-in">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-black text-gray-800 uppercase tracking-wider block font-display mb-1 flex items-center gap-1.5 font-sans">
            <Bell size={17} className="text-[#FF1E27] fill-[#FF1E27]/10" />
            ศูนย์การแจ้งเตือนข่าวสาร (Notifications)
          </h2>
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest font-mono">
            Direct Alerts & Announcements
          </p>
        </div>
        <div className="flex items-center gap-2">
          {currentUser && relevantList.some(n => !n.readBy || !n.readBy.includes(currentUser.id)) && (
            <button
              onClick={onMarkAllAsRead}
              className="text-[10px] bg-red-50 hover:bg-red-100 text-[#FF1E27] px-2.5 py-1 rounded-lg font-bold transition-all border border-red-100 select-none cursor-pointer"
            >
              ✓ อ่านทั้งหมด (Read All)
            </button>
          )}
          <span className="text-[10px] bg-gray-100 px-2 py-1 rounded font-mono font-bold text-gray-600 shrink-0">
            {relevantList.length} ALERTS
          </span>
        </div>
      </div>

      {relevantList.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-3xl border border-gray-100 shadow-sm p-8 flex flex-col items-center">
          <Bell size={36} className="text-gray-300 stroke-[1.2] mb-2" />
          <p className="text-xs font-bold text-gray-400">คุณยังไม่มีข้อความแจ้งเตือนใหม่ในกล่องจดหมาย</p>
        </div>
      ) : (
        <div className="space-y-4">
          {relevantList.map((notif) => {
            const dateStr = formatThaiDateTime(notif.createdAt);

            const isUnread = currentUser && (!notif.readBy || !notif.readBy.includes(currentUser.id));

            // Normal Notification (e.g., customized push or transaction notifications)
            const customBgColor = notif.highlightColor || '#ffffff';
            const isCustomHighlighted = !!notif.highlightColor;

            return (
              <div
                key={notif.id}
                id={`notif-${notif.id}`}
                onClick={() => {
                  if (isUnread) onMarkAsRead(notif.id);
                }}
                className={`bg-white rounded-2xl p-4 border flex gap-3.5 shadow-sm transition-all hover:border-gray-300 active:scale-[0.99] cursor-pointer relative overflow-hidden ${
                  isUnread ? 'border-red-300 bg-red-50/5 ring-1 ring-red-100' : 'border-gray-100'
                }`}
                style={isCustomHighlighted ? {
                  borderLeft: `5px solid ${customBgColor}`,
                  boxShadow: `0 4px 14px ${customBgColor}10`
                } : undefined}
              >
                {isUnread && (
                  <span className="absolute top-2.5 right-2.5 flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                  </span>
                )}

                <div 
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ backgroundColor: isCustomHighlighted ? `${customBgColor}12` : '#F9FAFB' }}
                >
                  {isCustomHighlighted ? (
                    <ShieldAlert size={18} style={{ color: customBgColor }} />
                  ) : (
                    <MessageCircle size={18} className="text-[#FF1E27]" />
                  )}
                </div>

                <div className="flex-1 space-y-1 pr-4">
                  <div className="flex justify-between items-start gap-1">
                    <h4 className={`text-xs sm:text-sm leading-snug ${isUnread ? 'font-extrabold text-gray-900' : 'font-bold text-gray-700'}`}>
                      {notif.title}
                    </h4>
                    <span className="text-[8px] font-bold text-gray-400 font-mono shrink-0">
                      {dateStr}
                    </span>
                  </div>
                  <p className="text-[11px] font-medium text-gray-500 leading-relaxed">
                    {notif.message}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
