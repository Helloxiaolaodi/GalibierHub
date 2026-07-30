"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { getBrowserSupabase } from "@/utils/supabase-browser";
import type { Session } from "@supabase/supabase-js";

type NotificationItem = {
  id: string;
  discussion_id: string;
  actor_name: string;
  preview_text: string;
  is_read: boolean;
  created_at: string;
};

function formatNotificationTime(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return Math.floor(diff / 60) + "m";
  if (diff < 86400) return Math.floor(diff / 3600) + "h";
  if (diff < 2592000) return Math.floor(diff / 86400) + "d";
  return Math.floor(diff / 2592000) + "mo";
}

export default function NotificationBell({ session }: { session: Session | null }) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLButtonElement>(null);

  const userId = session?.user?.id;

  const fetchNotifications = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const token = session?.access_token || "";
      const res = await fetch("/api/notifications", {
        headers: token ? { Authorization: "Bearer " + token } : {},
      });
      if (res.ok) {
        const data = await res.json() as { notifications?: NotificationItem[] };
        const items = data.notifications || [];
        setNotifications(items);
        setUnreadCount(items.filter(n => !n.is_read).length);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [userId]);

  // Initial fetch
  useEffect(() => {
    if (userId) fetchNotifications();
  }, [userId, fetchNotifications]);

  // Supabase realtime subscription
  useEffect(() => {
    if (!userId) return;
    const supabase = getBrowserSupabase();
    if (!supabase) return;

    const channel = supabase
      .channel("notifications-" + userId)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "site_notifications", filter: "recipient_id=eq." + userId },
        () => { fetchNotifications(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId, fetchNotifications]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
          bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const markAsRead = async (notifId: string, _discussionId: string) => {
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: notifId, is_read: true }),
      });
      setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, is_read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch { /* ignore */ }
    setOpen(false);
  };

  const markAllRead = async () => {
    try {
      const token = session?.access_token || "";
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) },
        body: JSON.stringify({ mark_all_read: true }),
      });
      setUnreadCount(0);
    } catch { /* ignore */ }
  };

  if (!userId) return null;

  return (
    <div className="relative">
      <button
        ref={bellRef}
        onClick={() => { setOpen(!open); if (!open) fetchNotifications(); }}
        className="relative inline-flex items-center justify-center rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
        aria-label="Notifications"
      >
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full bg-red-500 text-[10px] font-bold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={dropdownRef}
          className="absolute right-0 mt-2 w-80 rounded-lg border border-gray-200 bg-white shadow-lg z-50"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <h4 className="text-sm font-semibold text-gray-900">Notifications</h4>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-xs text-blue-600 hover:text-blue-800 font-medium">
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-[360px] overflow-y-auto">
            {loading && notifications.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-gray-500">Loading...</div>
            )}
            {!loading && notifications.length === 0 && (
              <div className="px-5 py-10 text-center">
                <svg className="mx-auto mb-3 h-10 w-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                <p className="text-sm font-medium text-gray-700">No notifications yet</p>
                <p className="mt-2 text-xs text-gray-500 leading-relaxed max-w-[240px] mx-auto">
                  You will receive activity alerts here, including replies to your posts, @mentions, and updates on discussions you are watching.
                </p>
              </div>
            )}
            {notifications.map(notif => (
              <Link
                key={notif.id}
                href={"/discussions/" + notif.discussion_id}
                onClick={() => markAsRead(notif.id, notif.discussion_id)}
                className={"flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0 " + (!notif.is_read ? "bg-blue-50/50" : "")}
              >
                <div className="flex-shrink-0 mt-0.5">
                  {!notif.is_read && <div className="h-2 w-2 rounded-full bg-blue-500" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900">
                    <span className="font-semibold">{notif.actor_name}</span> replied to your discussion
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5 truncate">{notif.preview_text}</p>
                  <p className="text-xs text-gray-400 mt-1">{formatNotificationTime(notif.created_at)}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
