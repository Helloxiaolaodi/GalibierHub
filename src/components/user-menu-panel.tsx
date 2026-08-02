"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import BadgeDisplay from "@/components/badge-display";
import { getBrowserSupabase } from "@/utils/supabase-browser";
import { getBadgeIcon } from "@/lib/badge-ids";
import type { Session } from "@supabase/supabase-js";

type TabId = "notifications" | "replies" | "likes" | "following" | "badges" | "settings";

type NotificationItem = {
  id: string;
  discussion_id: string;
  actor_name: string;
  preview_text: string;
  is_read: boolean;
  created_at: string;
};

function getNotificationLabel(previewText: string): string {
  const t = (previewText || "").toLowerCase();
  if (t.includes("started following")) return "started following you";
  if (t.includes("stopped following")) return "stopped following you";
  if (t.includes("liked your reply")) return "liked your reply";
  if (t.includes("liked your discussion")) return "liked your discussion";
  if (t.includes("liked your post")) return "liked your post";
  if (t.includes("mentioned")) return "mentioned you in a reply";
  if (t.includes("badge")) return "earned a new badge";
  if (t.includes("replied")) return "replied to your discussion";
  if (t.startsWith("@")) return "mentioned you";
  return previewText ? previewText : "replied to your discussion";
}

type BadgeItem = {
  badge_id: string;
  awarded_at: string;
  id?: string;
  name?: string;
  icon?: string;
  description?: string;
  tier?: string;
  badge_definitions?: { id?: string; name: string; description: string; icon: string; tier: string };
};
type ReplyItem = {
  id: string;
  feedback_id: string;
  author_name?: string;
  message: string;
  created_at: string;
  thread_title?: string;
};
type LikeItem = {
  entry_id: string;
  title: string;
  like_count: number;
  comment_id?: string;
};
type FollowingItem = {
  id: string;
  username?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
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

export default function UserMenuPanel({ session, githubUser, isAdmin, onSignOut, avatarUrl }: { session: Session | null; githubUser: string | null; isAdmin: boolean; onSignOut?: () => void; avatarUrl?: string | null }) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("notifications");
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [badges, setBadges] = useState<BadgeItem[]>([]);
  const [replies, setReplies] = useState<ReplyItem[]>([]);
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [likesReceived, setLikesReceived] = useState<LikeItem[]>([]);
  const [loadingLikes, setLoadingLikes] = useState(false);
  const [followingUsers, setFollowingUsers] = useState<FollowingItem[]>([]);
  const [loadingFollowing, setLoadingFollowing] = useState(false);
  const [followersUsers, setFollowersUsers] = useState<FollowingItem[]>([]);
  const [loadingFollowers, setLoadingFollowers] = useState(false);
  const [notifUnread, setNotifUnread] = useState(0);
  const [loadingNotifs, setLoadingNotifs] = useState(false);
  const [loadingBadges, setLoadingBadges] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [pauseNotifications, setPauseNotifications] = useState(false);
  const [onlineStatus, setOnlineStatus] = useState<"online" | "away" | "busy">(() => {
    if (typeof window === "undefined") return "online";
    const saved = localStorage.getItem("galibierhub-online-status");
    return saved === "away" || saved === "busy" ? saved : "online";
  });
  const [userBio, setUserBio] = useState<string>('');
  const [bioText, setBioText] = useState('');

  // Profile fields as React state (initialized from localStorage)
  const [profileAffiliation, setProfileAffiliation] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('galibierhub-affiliation') || ''; return '';
  });
  const [profileResearchField, setProfileResearchField] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('galibierhub-research-field') || ''; return '';
  });
  const [profileRole, setProfileRole] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('galibierhub-role') || ''; return '';
  });
  const [profileBio, setProfileBio] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('galibierhub-bio') || ''; return '';
  });
  const [customAvatar, setCustomAvatar] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('galibierhub-custom-avatar') || ''; return '';
  });
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    const uid = session?.user?.id;
    if (!uid) return;
    localStorage.setItem("galibierhub-online-status", onlineStatus);
    try {
      const presence = JSON.parse(localStorage.getItem("galibierhub-user-presence") || "{}") as Record<string, { status: string; updatedAt: number }>;
      presence[uid] = { status: onlineStatus, updatedAt: Date.now() };
      localStorage.setItem("galibierhub-user-presence", JSON.stringify(presence));
    } catch {
      localStorage.setItem("galibierhub-user-presence", JSON.stringify({ [uid]: { status: onlineStatus, updatedAt: Date.now() } }));
    }
    window.dispatchEvent(new Event("galibierhub-presence-updated"));
    const sb = getBrowserSupabase();
    if (sb) {
      void (async () => {
        try {
          const { error } = await sb.from("user_presence").upsert(
            { user_id: uid, status: onlineStatus, updated_at: new Date().toISOString() },
            { onConflict: "user_id" }
          );
          if (error) {
            // The presence table may not be deployed yet; localStorage remains the fallback.
          }
        } catch {}
      })();
    }
  }, [onlineStatus, session?.user?.id]);

  const resolvedAvatar = isAdmin ? '/galibierhub-logo.svg' : (customAvatar || avatarUrl);

  // Listen for settings updates from other pages
  useEffect(() => {
    const handler = () => {
      setProfileAffiliation(localStorage.getItem('galibierhub-affiliation') || '');
      setProfileResearchField(localStorage.getItem('galibierhub-research-field') || '');
      setProfileRole(localStorage.getItem('galibierhub-role') || '');
      setProfileBio(localStorage.getItem('galibierhub-bio') || '');
      setCustomAvatar(localStorage.getItem('galibierhub-custom-avatar') || '');
      setUserBio(localStorage.getItem('galibierhub-bio') || '');
    };
    window.addEventListener('galibierhub-settings-updated', handler);
    return () => window.removeEventListener('galibierhub-settings-updated', handler);
  }, []);

  const userId = session?.user?.id;
  const emailPrefix = session?.user?.email ? session.user.email.split("@")[0] : null;
  const displayName = isAdmin ? "GalibierHub Team" : (githubUser || emailPrefix || "User");

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    if (!userId) return;
    setLoadingNotifs(true);
    try {
      const token = session?.access_token || "";
      const res = await fetch("/api/notifications", {
        headers: token ? { Authorization: "Bearer " + token } : {},
      });
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
  // Fetch replies – replies made to this user's discussions
  const fetchReplies = useCallback(async () => {
    if (!userId) return;
    setLoadingReplies(true);
    try {
      const sb = getBrowserSupabase();
      if (!sb) { setLoadingReplies(false); return; }
      // Try by user_id first
      const { data: myPostsById } = await sb.from("site_feedback").select("id, title").eq("user_id", userId);
      if (myPostsById && myPostsById.length > 0) {
        const postIds = (myPostsById || []).map((post: { id: string }) => post.id);
        const titleMap = new Map((myPostsById || []).map((post: { id: string; title: string }) => [post.id, post.title]));
        const { data: comments } = await sb.from("feedback_comments")
          .select("id, feedback_id, author_name, message, created_at")
          .in("feedback_id", postIds)
          .order("created_at", { ascending: false })
          .limit(50);
        setReplies((comments || []).map((comment: { id: string; feedback_id: string; author_name?: string; message: string; created_at: string }) => ({
          ...comment,
          thread_title: titleMap.get(comment.feedback_id) || "Your discussion",
        })));
        setLoadingReplies(false);
        return;
      }
      // Fallback: match by display_name
      const displayName = session?.user?.user_metadata?.full_name
        || session?.user?.user_metadata?.name
        || session?.user?.user_metadata?.user_name
        || session?.user?.email?.split("@")[0]
        || githubUser
        || "";
      if (!displayName) { setReplies([]); setLoadingReplies(false); return; }
      const { data: myPostsByName } = await sb.from("site_feedback").select("id, title").ilike("display_name", displayName);
      if (myPostsByName && myPostsByName.length > 0) {
        const postIds = myPostsByName.map((post: { id: string }) => post.id);
        const titleMap = new Map(myPostsByName.map((post: { id: string; title: string }) => [post.id, post.title]));
        const { data: comments } = await sb.from("feedback_comments")
          .select("id, feedback_id, author_name, message, created_at")
          .in("feedback_id", postIds)
          .order("created_at", { ascending: false })
          .limit(50);
        setReplies((comments || []).map((comment: { id: string; feedback_id: string; author_name?: string; message: string; created_at: string }) => ({
          ...comment,
          thread_title: titleMap.get(comment.feedback_id) || "Your discussion",
        })));
      } else {
        setReplies([]);
      }
    } catch { setReplies([]); }
    finally { setLoadingReplies(false); }
  }, [userId, session, githubUser]);

  // Fetch likes received
  const fetchLikesReceived = useCallback(async () => {
    if (!userId) return;
    setLoadingLikes(true);
    try {
      const sb = getBrowserSupabase();
      if (!sb) { setLoadingLikes(false); return; }
      const { data: myEntries } = await sb.from("site_feedback").select("id, title").eq("user_id", userId);
      const entryIds = (myEntries || []).map((e: { id: string }) => e.id);
      const entryLikes: LikeItem[] = [];
      if (entryIds.length > 0) {
        const { data: reactions } = await sb.from("site_reactions").select("entry_id").eq("reaction_type", "like").in("entry_id", entryIds);
        const countMap: Record<string, number> = {};
        (reactions || []).forEach((r: { entry_id: string }) => { countMap[r.entry_id] = (countMap[r.entry_id] || 0) + 1; });
        entryLikes.push(...(myEntries || [])
          .filter((e: { id: string }) => countMap[e.id])
          .map((e: { id: string; title: string }) => ({ entry_id: e.id, title: e.title, like_count: countMap[e.id] })));
      }

      const { data: myComments } = await sb.from("feedback_comments").select("id, feedback_id").eq("user_id", userId);
      const commentIds = (myComments || []).map((c: { id: string }) => c.id);
      const commentLikes: LikeItem[] = [];
      if (commentIds.length > 0) {
        const { data: reactions } = await sb.from("site_reactions").select("comment_id").eq("reaction_type", "like").in("comment_id", commentIds);
        const countMap: Record<string, number> = {};
        (reactions || []).forEach((r: { comment_id: string }) => { countMap[r.comment_id] = (countMap[r.comment_id] || 0) + 1; });
        const feedbackIds = [...new Set((myComments || []).map((c: { feedback_id: string }) => c.feedback_id))];
        const { data: threads } = await sb.from("site_feedback").select("id, title").in("id", feedbackIds);
        const titleMap = new Map((threads || []).map((t: { id: string; title: string }) => [t.id, t.title]));
        commentLikes.push(...(myComments || [])
          .filter((c: { id: string }) => countMap[c.id])
          .map((c: { id: string; feedback_id: string }) => ({
            entry_id: c.feedback_id,
            comment_id: c.id,
            title: titleMap.get(c.feedback_id) || "Your reply",
            like_count: countMap[c.id],
          })));
      }

      setLikesReceived([...entryLikes, ...commentLikes].sort((a, b) => b.like_count - a.like_count));
    } catch { setLikesReceived([]); }
    finally { setLoadingLikes(false); }
  }, [userId]);

  // Fetch users this account follows and followers via API
  const fetchFollowing = useCallback(async () => {
    if (!userId) return;
    setLoadingFollowing(true);
    try {
      const token = session?.access_token || "";
      const res = await fetch("/api/follows?type=following", {
        headers: token ? { Authorization: "Bearer " + token } : {},
      });
      if (res.ok) {
        const data = await res.json() as { following?: FollowingItem[] };
        setFollowingUsers(data.following || []);
      } else {
        setFollowingUsers([]);
      }
    } catch {
      setFollowingUsers([]);
    } finally {
      setLoadingFollowing(false);
    }
  }, [userId, session]);

  // Fetch users who follow this account
  const fetchFollowers = useCallback(async () => {
    if (!userId) return;
    setLoadingFollowers(true);
    try {
      const token = session?.access_token || "";
      const res = await fetch("/api/follows?type=followers", {
        headers: token ? { Authorization: "Bearer " + token } : {},
      });
      if (res.ok) {
        const data = await res.json() as { followers?: FollowingItem[] };
        setFollowersUsers(data.followers || []);
      } else {
        setFollowersUsers([]);
      }
    } catch {
      setFollowersUsers([]);
    } finally {
      setLoadingFollowers(false);
    }
  }, [userId, session]);


  useEffect(() => { if (open && userId) { fetchNotifications(); fetchBadges(); fetchReplies(); fetchLikesReceived(); fetchFollowing(); fetchFollowers(); } }, [open, userId, fetchNotifications, fetchBadges, fetchReplies, fetchLikesReceived, fetchFollowing, fetchFollowers]);

  // Poll notifications as a fallback when Realtime is not available.
  useEffect(() => {
    if (!userId) return;
    const timer = setInterval(() => {
      void fetchNotifications();
      void fetchReplies();
      void fetchLikesReceived();
      void fetchFollowing();
      void fetchFollowers();
    }, 15000);
    return () => clearInterval(timer);
  }, [userId, fetchNotifications, fetchReplies, fetchLikesReceived, fetchFollowing, fetchFollowers]);

  // Sync profile from Supabase on panel open (fallback when localStorage is empty)
  useEffect(() => {
    if (!open || !userId) return;
    const sb = getBrowserSupabase();
    if (!sb) return;
    sb.from("profiles").select("display_name, affiliation, research_field, role, bio, avatar_url").eq("id", userId).single().then(({ data }) => {
      if (!data) return;
      if (data.display_name) { localStorage.setItem("galibierhub-display-name", data.display_name); }
      if (data.affiliation !== undefined) { localStorage.setItem("galibierhub-affiliation", data.affiliation || ""); setProfileAffiliation(data.affiliation || ""); }
      if (data.research_field !== undefined) { localStorage.setItem("galibierhub-research-field", data.research_field || ""); setProfileResearchField(data.research_field || ""); }
      if (data.role !== undefined) { localStorage.setItem("galibierhub-role", data.role || ""); setProfileRole(data.role || ""); }
      if (data.bio !== undefined) { localStorage.setItem("galibierhub-bio", data.bio || ""); setProfileBio(data.bio || ""); }
      if (data.avatar_url !== undefined) { localStorage.setItem("galibierhub-custom-avatar", data.avatar_url || ""); setCustomAvatar(data.avatar_url || ""); }
    }, () => {});
  }, [open, userId]);

  // Listen for localStorage changes from other tabs (e.g., Settings/Preferences page)
  useEffect(() => {
    const handler = () => {
      const aff = localStorage.getItem("galibierhub-affiliation") || "";
      const rf = localStorage.getItem("galibierhub-research-field") || "";
      const role = localStorage.getItem("galibierhub-role") || "";
      const bio = localStorage.getItem("galibierhub-bio") || "";
      const avatar = localStorage.getItem("galibierhub-custom-avatar") || "";
      setProfileAffiliation(aff);
      setProfileResearchField(rf);
      setProfileRole(role);
      setProfileBio(bio);
      setCustomAvatar(avatar);
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  // Supabase Realtime subscription for notifications
  useEffect(() => {
    if (!userId) return;
    const sb = getBrowserSupabase();
    if (!sb) return;
    const channel = sb
      .channel('realtime:notifications')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'site_notifications', filter: `recipient_id=eq.${userId}` },
        (payload: { new: NotificationItem }) => {
          if (payload.new) {
            setNotifications((prev) => [payload.new, ...prev]);
            setNotifUnread((count) => count + 1);
          }
        }
      )
      .subscribe();
    return () => { sb.removeChannel(channel); };
  }, [userId]);

  // Realtime refresh for replies and likes received
  useEffect(() => {
    if (!userId) return;
    const sb = getBrowserSupabase();
    if (!sb) return;
    const channel = sb
      .channel('realtime:user-activity-' + userId)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'feedback_comments' },
        () => { fetchReplies(); fetchNotifications(); }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'site_reactions' },
        () => { fetchLikesReceived(); fetchNotifications(); }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'follows', filter: `follower_id=eq.${userId}` },
        () => { fetchFollowing(); fetchFollowers(); }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'follows', filter: `following_id=eq.${userId}` },
        () => { fetchFollowing(); fetchFollowers(); }
      )
      .subscribe();
    return () => { sb.removeChannel(channel); };
  }, [userId, fetchReplies, fetchLikesReceived, fetchNotifications, fetchFollowing, fetchFollowers]);

  // Refresh Following/Followers immediately when follow state changes in profile cards or pages
  useEffect(() => {
    const handler = () => { fetchFollowing(); fetchFollowers(); };
    window.addEventListener('galibierhub-follows-updated', handler);
    return () => window.removeEventListener('galibierhub-follows-updated', handler);
  }, [fetchFollowing, fetchFollowers]);

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
      const token = session?.access_token || "";
      await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) }, body: JSON.stringify({ id: notifId, is_read: true }) });
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
      id: "following", label: "Following",
      icon: <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
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
        {resolvedAvatar ? (
          <img src={resolvedAvatar} alt={displayName || "User"} className="h-6 w-6 rounded-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} referrerPolicy="no-referrer" />
        ) : (
          <span className="h-6 w-6 rounded-full bg-gradient-to-br from-slate-500 to-slate-700 flex items-center justify-center text-xs font-semibold text-white">
            {displayName ? displayName.substring(0, 1).toUpperCase() : "?"}
          </span>
        )}
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
                  className={`relative flex items-center justify-center w-9 h-9 rounded-lg transition-colors ${activeTab === tab.id ? "bg-white text-teal-600 shadow-sm ring-1 ring-gray-200" : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"}`}
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
                  <button onClick={markAllRead} className="text-xs text-teal-600 hover:text-slate-800 font-medium">Mark all read</button>
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
                          className={"flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0 " + (!notif.is_read ? "bg-teal-50/50" : "")}>
                          {!notif.is_read && <div className="mt-1.5 h-2 w-2 rounded-full bg-slate-700 flex-shrink-0" />}
                          <div className={`flex-1 min-w-0 ${notif.is_read ? "ml-5" : ""}`}>
                            <p className="text-sm text-gray-900"><span className="font-semibold">{notif.actor_name}</span> {getNotificationLabel(notif.preview_text)}</p>
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
                  <>
                    {loadingReplies ? (
                      <div className="px-4 py-8 text-center text-sm text-gray-400">Loading...</div>
                    ) : replies.length === 0 ? (
                      <div className="px-5 py-10 text-center">
                        <svg className="mx-auto mb-3 h-10 w-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
                        <p className="text-sm font-medium text-gray-700">No replies yet</p>
                        <p className="mt-2 text-xs text-gray-500 leading-relaxed max-w-[260px] mx-auto">Replies to your discussions will appear here.</p>
                      </div>
                    ) : (
                      replies.map(r => (
                        <Link key={r.id} href={"/discussions/" + r.feedback_id + "?reply=" + encodeURIComponent(r.id)} className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0">
                          <svg className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-gray-900 truncate">{r.thread_title}</p>
                            {r.author_name && <p className="text-xs text-gray-500 truncate mt-0.5">{r.author_name}</p>}
                            <p className="text-xs text-gray-500 truncate mt-0.5">{r.message.substring(0, 60)}{r.message.length>60?"...":""}</p>
                            <p className="text-xs text-gray-400 mt-1">{formatTimeAgo(r.created_at)}</p>
                          </div>
                        </Link>
                      ))
                    )}
                  </>
                )}
                {activeTab === "likes" && (
                  <>
                    {loadingLikes ? (
                      <div className="px-4 py-8 text-center text-sm text-gray-400">Loading...</div>
                    ) : likesReceived.length === 0 ? (
                      <div className="px-5 py-10 text-center">
                        <svg className="mx-auto mb-3 h-10 w-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
                        <p className="text-sm font-medium text-gray-700">No likes yet</p>
                        <p className="mt-2 text-xs text-gray-500 leading-relaxed max-w-[260px] mx-auto">Likes on your posts and replies will appear here once other users react to your contributions.</p>
                      </div>
                    ) : (
                      likesReceived.map(item => (
                        <Link key={item.entry_id + (item.comment_id || "")} href={"/discussions/" + item.entry_id + (item.comment_id ? "?reply=" + encodeURIComponent(item.comment_id) : "")} className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0">
                          <span className="h-5 w-5 flex-shrink-0 flex items-center justify-center rounded-full bg-red-50 text-red-500 text-[10px]">
                            <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24"><path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-gray-900 truncate">{item.title}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{item.like_count} {item.like_count === 1 ? "like" : "likes"} received</p>
                          </div>
                        </Link>
                      ))
                    )}
                  </>
                )}
                {activeTab === "following" && (
                  <div className="p-3 space-y-5">
                    <section>
                      <h5 className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">Following</h5>
                      {loadingFollowing ? (
                        <div className="px-3 py-6 text-center text-sm text-gray-400">Loading...</div>
                      ) : followingUsers.length === 0 ? (
                        <p className="px-3 py-4 text-xs text-gray-500">No followed users yet.</p>
                      ) : (
                        <div className="space-y-2">
                          {followingUsers.map(user => (
                            <Link key={user.id} href={user.username ? `/user/${user.username}` : `/user/${user.id}`} className="flex items-center gap-3 rounded-xl border border-gray-100 p-3 hover:bg-gray-50 transition-colors">
                              {user.avatar_url ? (
                                <img src={user.avatar_url} alt={user.display_name || user.username || "User"} className="h-9 w-9 rounded-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} referrerPolicy="no-referrer" />
                              ) : (
                                <span className="h-9 w-9 rounded-full bg-gradient-to-br from-slate-500 to-slate-700 flex items-center justify-center text-xs font-semibold text-white">
                                  {(user.display_name || user.username || "?").substring(0, 1).toUpperCase()}
                                </span>
                              )}
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-gray-900 truncate">{user.display_name || user.username || "User"}</p>
                                {user.username && <p className="text-xs text-gray-400 truncate">@{user.username}</p>}
                              </div>
                            </Link>
                          ))}
                        </div>
                      )}
                    </section>
                    <section>
                      <h5 className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">Followers</h5>
                      {loadingFollowers ? (
                        <div className="px-3 py-6 text-center text-sm text-gray-400">Loading...</div>
                      ) : followersUsers.length === 0 ? (
                        <p className="px-3 py-4 text-xs text-gray-500">No followers yet.</p>
                      ) : (
                        <div className="space-y-2">
                          {followersUsers.map(user => (
                            <Link key={user.id} href={user.username ? `/user/${user.username}` : `/user/${user.id}`} className="flex items-center gap-3 rounded-xl border border-gray-100 p-3 hover:bg-gray-50 transition-colors">
                              {user.avatar_url ? (
                                <img src={user.avatar_url} alt={user.display_name || user.username || "User"} className="h-9 w-9 rounded-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} referrerPolicy="no-referrer" />
                              ) : (
                                <span className="h-9 w-9 rounded-full bg-gradient-to-br from-slate-500 to-slate-700 flex items-center justify-center text-xs font-semibold text-white">
                                  {(user.display_name || user.username || "?").substring(0, 1).toUpperCase()}
                                </span>
                              )}
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-gray-900 truncate">{user.display_name || user.username || "User"}</p>
                                {user.username && <p className="text-xs text-gray-400 truncate">@{user.username}</p>}
                              </div>
                            </Link>
                          ))}
                        </div>
                      )}
                    </section>
                  </div>
                )}
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
                              <span className="text-xl flex-shrink-0">{getBadgeIcon(def.id, def.icon)}</span>
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
                  <div className="p-3 space-y-2">
                    {/* Profile card summary */}
                    <div className="flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50/50 p-3 mb-2">
                      {resolvedAvatar ? (
                        <img src={resolvedAvatar} alt={displayName||"User"} className="h-10 w-10 rounded-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} referrerPolicy="no-referrer" />
                      ) : (
                        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-slate-600 to-slate-900 flex items-center justify-center text-sm font-semibold text-white">
                          {displayName ? displayName.substring(0,1).toUpperCase() : "?"}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-gray-900 truncate">{displayName}</p>
                        {profileAffiliation && <p className="text-xs text-gray-500 truncate">{profileAffiliation}</p>}
                        {profileRole && <p className="text-xs text-gray-400 truncate">{profileRole}</p>}
                      </div>
                    </div>
                    {/* View Full Profile */}
                    <Link href={githubUser ? `/user/${githubUser}` : (userId ? `/user/${userId}` : "#")} className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                      <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                      <span>View Full Profile</span>
                    </Link>
                    {/* Settings */}
                    <Link href="/settings/preferences" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                      <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                      <span>Settings</span>
                    </Link>
                    {/* Activity */}
                    <Link href={githubUser ? `/user/${githubUser}?tab=activity` : (userId ? `/user/${userId}?tab=activity` : "/discussions")} className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                      <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                      <span>Activity</span>
                    </Link>
                    {/* Moderation Dashboard - admin only */}
                    {isAdmin && (
                      <Link href="/discussions?mod=1" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-amber-700 hover:bg-amber-50 transition-colors">
                        <svg className="h-4 w-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
                        <span>Moderation Dashboard</span>
                      </Link>
                    )}
                    <hr className="border-gray-100 my-1" />
                    {/* Switch Account */}
                    <button type="button" onClick={onSignOut} className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-amber-50 hover:text-amber-700 transition-colors w-full text-left">
                      <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                      <span>Switch Account</span>
                    </button>
                    <button type="button" onClick={() => setPauseNotifications(!pauseNotifications)} className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors w-full text-left">
                      <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                      <span>{pauseNotifications ? "Resume notifications" : "Pause notifications"}</span>
                    </button>
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
