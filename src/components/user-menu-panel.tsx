"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import BadgeDisplay from "@/components/badge-display";
import type { Session } from "@supabase/supabase-js";

type TabId = "notifications" | "replies" | "likes" | "badges" | "settings";

type NotificationItem = {
  id: string;
  discussion_id: string;
  actor_name: string;
  preview_text: string;
  is_read: boolean;
  created_at: string;
};

type BadgeItem = {
  badge_id: string;
  awarded_at: string;
  name?: string;
  icon?: string;
  description?: string;
  tier?: string;
  badge_definitions?: { name: string; description: string; icon: string; tier: string };
};

const TIER_COLORS: Record<string, string> = {
  bronze: "bg-amber-50 border-amber-200 text-amber-700",
  silver: "bg-slate-50 border-slate-300 text-slate-600",
  gold: "bg-yellow-50 border-yellow-300 text-yellow-700",
  platinum: "bg-indigo-50 border-indigo-300 text-indigo-700",
};

function formatTimeAgo(d: string): string {
  const diff = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return Math.floor(diff / 60) + "m";
  if (diff < 86400) return Math.floor(diff / 3600) + "h";
  if (diff < 2592000) return Math.floor(diff / 86400) + "d";
  return Math.floor(diff / 2592000) + "mo";
}

export default function UserMenuPanel({ session, githubUser, isAdmin, onSignOut }: { session: Session | null; githubUser: string | null; isAdmin: boolean; onSignOut?: () => void }) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("notifications");
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [badges, setBadges] = useState<BadgeItem[]>([]);
  const [notifUnread, setNotifUnread] = useState(0);
  const [loadingNotifs, setLoadingNotifs] = useState(false);
  const [loadingBadges, setLoadingBadges] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [pauseNotifications, setPauseNotifications] = useState(false);
  const [onlineStatus, setOnlineStatus] = useState<"online" | "away" | "busy">("online");

  const userId = session?.user?.id;
  const displayName = isAdmin ? "GalibierHub Team" : (githubUser || "Visitor");

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    if (!userId) return;
    setLoadingNotifs(true);
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) {
        const data = await res.json() as { notifications?: NotificationItem[] };
        const items = data.notifications || [];
        setNotifications(items);
        setNotifUnread(items.filter(n => !n.is_read).length);
      }
    } catch {}
    finally { setLoadingNotifs(false); }
  }, [userId]);

  // Fetch badges
  const fetchBadges = useCallback(async () => {
    if (!userId) return;
    setLoadingBadges(true);
    try {
      const res = await fetch("/api/badges?user_id=" + encodeURIComponent(userId));
      if (res.ok) {
        const data = await res.json() as { badges?: BadgeItem[] };
        const tierOrder: Record<string,number> = { platinum:4, gold:3, silver:2, bronze:1 };
        const sorted = (data.badges || []).sort((a, b) => {
          const defA = a.badge_definitions || a;
          const defB = b.badge_definitions || b;
          return (tierOrder[defB.tier as string] || 0) - (tierOrder[defA.tier as string] || 0);
        });
        setBadges(sorted);
      }
    } catch {}
    finally { setLoadingBadges(false); }
  }, [userId]);

  useEffect(() => { if (open && userId) { fetchNotifications(); fetchBadges(); } }, [open, userId, fetchNotifications, fetchBadges]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node) &&
          triggerRef.current && !triggerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const markAsRead = async (notifId: string) => {
    try {
      await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: notifId, is_read: true }) });
      setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, is_read: true } : n));
      setNotifUnread(prev => Math.max(0, prev - 1));
    } catch {}
  };

  const markAllRead = async () => {
    try {
      const token = session?.access_token || "";
      await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) }, body: JSON.stringify({ mark_all_read: true }) });
      setNotifUnread(0);
    } catch {}
  };

  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    {
      id: "notifications", label: "Notifications",
      icon: <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
    },
    {
      id: "replies", label: "Replies",
      icon: <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
    },
    {
      id: "likes", label: "Likes",
      icon: <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
    },
    {
      id: "badges", label: "Badges",
      icon: <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" /></svg>
    },
    {
      id: "settings", label: "Settings",
      icon: <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
    },
  ];

  const showNotificationBadge = notifUnread > 0 && activeTab !== "notifications";

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 shadow-sm transition-all"
      >
        <span className="h-6 w-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-xs font-semibold text-white">
          {displayName ? displayName.substring(0, 1).toUpperCase() : "?"}
        </span>
        <span className="hidden sm:inline max-w-[120px] truncate">{displayName}</span>
        {showNotificationBadge && (
          <span className="inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full bg-red-500 text-[10px] font-bold text-white">
            {notifUnread > 9 ? "9+" : notifUnread}
          </span>
        )}
        <svg className={`h-4 w-4 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </button>

      {open && (
        <div ref={panelRef} className="absolute right-0 mt-2 w-[380px] rounded-2xl border border-gray-200 bg-white shadow-2xl z-50 overflow-hidden">
          {/* Status bar */}
          <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${onlineStatus === "online" ? "bg-green-500" : onlineStatus === "away" ? "bg-amber-400" : "bg-red-400"}`} />
              <select value={onlineStatus} onChange={e => setOnlineStatus(e.target.value as typeof onlineStatus)}
                className="text-xs text-gray-600 bg-transparent border-none outline-none cursor-pointer">
                <option value="online">Online</option>
                <option value="away">Away</option>
                <option value="busy">Busy</option>
              </select>
            </div>
            <button onClick={() => setPauseNotifications(!pauseNotifications)}
              className={`text-xs ${pauseNotifications ? "text-amber-600 bg-amber-50" : "text-gray-500 hover:text-gray-700"} px-2 py-1 rounded-md transition-colors`}>
              {pauseNotifications ? "Paused" : "Pause notifications"}
            </button>
          </div>

          {/* Side tabs + content */}
          <div className="flex" style={{ minHeight: 300 }}>
            {/* Side tabs */}
            <div className="w-12 flex-shrink-0 border-r border-gray-100 bg-gray-50/50 flex flex-col items-center py-2 gap-1">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative flex items-center justify-center w-9 h-9 rounded-lg transition-colors ${activeTab === tab.id ? "bg-white text-blue-600 shadow-sm ring-1 ring-gray-200" : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"}`}
                  title={tab.label}
                >
                  {tab.icon}
                  {tab.id === "notifications" && notifUnread > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-red-500 text-[8px] font-bold text-white flex items-center justify-center">
                      {notifUnread > 9 ? "" : notifUnread}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Content area */}
            <div className="flex-1 flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
                <h4 className="text-sm font-semibold text-gray-900">{tabs.find(t => t.id === activeTab)?.label || ""}</h4>
                {activeTab === "notifications" && notifUnread > 0 && (
                  <button onClick={markAllRead} className="text-xs text-blue-600 hover:text-blue-800 font-medium">Mark all read</button>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto max-h-[300px]">
                {/* Notifications tab */}
                {activeTab === "notifications" && (
                  <>
                    {loadingNotifs ? (
                      <div className="px-4 py-8 text-center text-sm text-gray-400">Loading...</div>
                    ) : notifications.length === 0 ? (
                      <div className="px-5 py-10 text-center">
                        <svg className="mx-auto mb-3 h-10 w-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                        <p className="text-sm font-medium text-gray-700">No notifications yet</p>
                        <p className="mt-2 text-xs text-gray-500 leading-relaxed max-w-[260px] mx-auto">
                          You will receive activity alerts here, including replies to your posts, @mentions, and updates on discussions you are watching.
                        </p>
                      </div>
                    ) : (
                      notifications.map(notif => (
                        <Link key={notif.id} href={"/discussions/" + notif.discussion_id} onClick={() => { markAsRead(notif.id); }}
                          className={"flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0 " + (!notif.is_read ? "bg-blue-50/50" : "")}>
                          {!notif.is_read && <div className="mt-1.5 h-2 w-2 rounded-full bg-blue-500 flex-shrink-0" />}
                          <div className={`flex-1 min-w-0 ${notif.is_read ? "ml-5" : ""}`}>
                            <p className="text-sm text-gray-900"><span className="font-semibold">{notif.actor_name}</span> replied</p>
                            <p className="text-xs text-gray-500 mt-0.5 truncate">{notif.preview_text}</p>
                            <p className="text-xs text-gray-400 mt-1">{formatTimeAgo(notif.created_at)}</p>
                          </div>
                        </Link>
                      ))
                    )}
                  </>
                )}

                {/* Replies tab */}
                {activeTab === "replies" && (
                  <div className="px-5 py-10 text-center">
                    <svg className="mx-auto mb-3 h-10 w-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
                    <p className="text-sm font-medium text-gray-700">Your replies</p>
                    <p className="mt-2 text-xs text-gray-500 leading-relaxed max-w-[260px] mx-auto">
                      Track discussions you have participated in. Your replies across all topics will appear here.
                    </p>
                    <Link href="/discussions" className="mt-3 inline-block text-xs text-blue-600 hover:text-blue-800 font-medium">Browse discussions</Link>
                  </div>
                )}

                {/* Likes tab */}
                {activeTab === "likes" && (
                  <div className="px-5 py-10 text-center">
                    <svg className="mx-auto mb-3 h-10 w-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
                    <p className="text-sm font-medium text-gray-700">Likes you have received</p>
                    <p className="mt-2 text-xs text-gray-500 leading-relaxed max-w-[260px] mx-auto">
                      See who liked your posts and replies. Likes help surface quality contributions.
                    </p>
                  </div>
                )}

                {/* Badges tab */}
                {activeTab === "badges" && (
                  <>
                    {loadingBadges ? (
                      <div className="px-4 py-8 text-center text-sm text-gray-400">Loading...</div>
                    ) : badges.length === 0 ? (
                      <div className="px-5 py-10 text-center">
                        <svg className="mx-auto mb-3 h-10 w-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" /></svg>
                        <p className="text-sm font-medium text-gray-700">No badges yet</p>
                        <p className="mt-2 text-xs text-gray-500 leading-relaxed max-w-[260px] mx-auto">
                          Badges are earned by participating in the community. Post discussions, reply to others, and receive likes to unlock achievements.
                        </p>
                      </div>
                    ) : (
                      <div className="p-3 space-y-2">
                        {badges.map(badge => {
                          const def = badge.badge_definitions || badge;
                          const colors = TIER_COLORS[(def.tier as string) || "bronze"];
                          return (
                            <div key={badge.badge_id} className={`flex items-start gap-3 rounded-xl border p-3 ${colors}`}>
                              <span className="text-xl flex-shrink-0">{def.icon || "🏅"}</span>
                              <div className="min-w-0">
                                <p className="text-sm font-semibold">{def.name}</p>
                                <p className="text-xs mt-0.5 opacity-80">{def.description}</p>
                                <p className="text-xs mt-1 opacity-60">{formatTimeAgo(badge.awarded_at)}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}

                {/* Settings tab */}
                {activeTab === "settings" && (
                  <div className="p-4 space-y-2">
                    <Link href="/discussions" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                      <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                      <span>Drafts</span>
                    </Link>
                    <Link href="/discussions" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                      <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                      <span>Activity</span>
                    </Link>
                    <Link href="/discussions" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                      <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                      <span>Preferences</span>
                    </Link>
                  </div>
                )}
              </div>

              {/* Footer links */}
              <div className="border-t border-gray-100 px-4 py-2 flex items-center justify-between">
                <Link href="/discussions" className="text-xs text-gray-400 hover:text-gray-600">View all</Link>
                {onSignOut ? (
                  <button onClick={onSignOut} className="text-xs text-gray-400 hover:text-red-500 transition-colors">Sign out</button>
                ) : (
                  <span className="text-xs text-gray-300">GalibierHub</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
