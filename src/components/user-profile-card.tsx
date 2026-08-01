"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import BadgeDisplay from "@/components/badge-display";
import { getBrowserSupabase } from "@/utils/supabase-browser";

type ProfileData = {
  displayName: string;
  affiliation: string;
  researchField: string;
  role: string;
  bio: string;
  avatarUrl: string | null;
  userId: string | null;
};

type PresenceMap = Record<string, { status: "online" | "away" | "busy"; updatedAt: number }>;

function getInitials(n: string): string {
  if (!n) return "?";
  const p = n.trim().split(/\s+/);
  return p.length >= 2 ? (p[0][0] + p[1][0]).toUpperCase() : n.substring(0, 2).toUpperCase();
}

export default function UserProfileCard({
  open,
  onClose,
  displayName,
  userId,
  anchorEl,
  onlineStatus,
}: {
  open: boolean;
  onClose: () => void;
  displayName: string;
  userId?: string | null;
  anchorEl?: HTMLElement | null;
  onlineStatus?: "online" | "away" | "busy";
}) {
 const [profile, setProfile] = useState<ProfileData>({
   displayName,
   affiliation: "",
   researchField: "",
   role: "",
   bio: "",
   avatarUrl: null,
   userId: userId || null,
 });
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    try { return localStorage.getItem("galibierhub-user-id"); } catch { return null; }
  });
  const [presence, setPresence] = useState<PresenceMap>(() => {
    if (typeof window === "undefined") return {};
    try { return JSON.parse(localStorage.getItem("galibierhub-user-presence") || "{}") as PresenceMap; } catch { return {}; }
  });
  const isOwnCard = !!(userId && currentUserId && userId === currentUserId);

  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const loadProfile = async () => {
      let actorId = currentUserId;
      let savedProfileData: { display_name?: string; affiliation?: string | null; research_field?: string | null; role?: string | null; bio?: string | null; avatar_url?: string | null } | null = null;
      try {
        const sb = getBrowserSupabase();
        if (sb && userId) {
          const sessionRes = await sb.auth.getSession();
          const sessionId = sessionRes.data.session?.user?.id;
          if (sessionId) actorId = sessionId;
          if (sessionId && sessionId !== currentUserId) setCurrentUserId(sessionId);
          try {
            const { data } = await sb.from("profiles").select("display_name, affiliation, research_field, role, bio, avatar_url").eq("id", userId).single();
            if (data) savedProfileData = data;
          } catch {}
          if (actorId) {
            try {
              const { data: followData } = await sb.from("follows").select("id").eq("follower_id", actorId).eq("following_id", userId).maybeSingle();
              if (!cancelled) setIsFollowing(!!followData);
            } catch {}
          }
          try {
            const { data: presenceRow } = await sb.from("user_presence").select("status, updated_at").eq("user_id", userId).maybeSingle();
            if (!cancelled && presenceRow?.status) {
              setPresence(prev => ({
                ...prev,
                [userId]: {
                  status: presenceRow.status as "online" | "away" | "busy",
                  updatedAt: new Date(presenceRow.updated_at).getTime(),
                },
              }));
            }
          } catch {}
        }
      } catch {}
      if (!cancelled && savedProfileData) {
        setProfile({
          displayName: savedProfileData.display_name || displayName,
          affiliation: savedProfileData.affiliation || "",
          researchField: savedProfileData.research_field || "",
          role: savedProfileData.role || "",
          bio: savedProfileData.bio || "",
          avatarUrl: savedProfileData.avatar_url || null,
          userId: userId || null,
        });
        return;
      }
      const aff = localStorage.getItem("galibierhub-affiliation") || "";
      const rf = localStorage.getItem("galibierhub-research-field") || "";
      const role = localStorage.getItem("galibierhub-role") || "";
      const bio = localStorage.getItem("galibierhub-bio") || "";
      const avatar = localStorage.getItem("galibierhub-custom-avatar") || "";
      if (!cancelled) setProfile({
        displayName,
        affiliation: aff,
        researchField: rf,
        role,
        bio,
        avatarUrl: avatar || null,
        userId: userId || null,
      });
      if (!cancelled && userId) {
        const following = JSON.parse(localStorage.getItem("galibierhub-following") || "[]");
        setIsFollowing(following.includes(userId));
      }
    };
    loadProfile();
    return () => { cancelled = true; };
  }, [open, displayName, userId, currentUserId]);

  useEffect(() => {
    if (!open || !userId) return;
    const sb = getBrowserSupabase();
    if (!sb) return;
    const channel = sb.channel("user-presence-" + userId)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "user_presence",
        filter: "user_id=eq." + userId,
      }, (payload) => {
        const row = (payload.new || {}) as { status?: string; updated_at?: string };
        const status = row.status;
        if (status === "online" || status === "away" || status === "busy") {
          setPresence(prev => ({
            ...prev,
            [userId]: {
              status,
              updatedAt: new Date(row.updated_at || Date.now()).getTime(),
            },
          }));
        }
      })
      .subscribe();
    return () => {
      sb.removeChannel(channel);
    };
  }, [open, userId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const syncPresence = () => {
      try { setPresence(JSON.parse(localStorage.getItem("galibierhub-user-presence") || "{}") as PresenceMap); } catch {}
    };
    syncPresence();
    window.addEventListener("storage", syncPresence);
    window.addEventListener("galibierhub-presence-updated", syncPresence);
    return () => {
      window.removeEventListener("storage", syncPresence);
      window.removeEventListener("galibierhub-presence-updated", syncPresence);
    };
  }, []);

  // Listen for settings updates (e.g., from Settings/Preferences page)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const refreshProfile = () => {
      if (!userId) return;
      const aff = localStorage.getItem("galibierhub-affiliation") || "";
      const rf = localStorage.getItem("galibierhub-research-field") || "";
      const role = localStorage.getItem("galibierhub-role") || "";
      const bio = localStorage.getItem("galibierhub-bio") || "";
      const avatar = localStorage.getItem("galibierhub-custom-avatar") || "";
      const displayName = localStorage.getItem("galibierhub-display-name") || "";
      setProfile(prev => ({
        ...prev,
        displayName: displayName || prev.displayName,
        affiliation: aff,
        researchField: rf,
        role,
        bio,
        avatarUrl: avatar || null,
      }));
    };
    window.addEventListener("galibierhub-settings-updated", refreshProfile);
    window.addEventListener("storage", refreshProfile);
    return () => {
      window.removeEventListener("galibierhub-settings-updated", refreshProfile);
      window.removeEventListener("storage", refreshProfile);
    };
  }, [userId]);

  const toggleFollow = useCallback(async () => {
    if (!userId || followLoading) return;
    setFollowLoading(true);
    let actorId = currentUserId;
    try {
      const sb = getBrowserSupabase();
      if (sb && !actorId) {
        const { data: { session } } = await sb.auth.getSession();
        actorId = session?.user?.id || null;
        if (actorId) {
          setCurrentUserId(actorId);
          localStorage.setItem("galibierhub-user-id", actorId);
        }
      }
    } catch {}
    if (!actorId) {
      setFollowLoading(false);
      return;
    }
    const following = JSON.parse(localStorage.getItem("galibierhub-following") || "[]");
    if (isFollowing) {
      const idx = following.indexOf(userId);
      if (idx > -1) following.splice(idx, 1);
    } else {
      following.push(userId);
    }
    localStorage.setItem("galibierhub-following", JSON.stringify(following));
    const nowFollowing = !isFollowing;
    setIsFollowing(nowFollowing);
    // Persist to Supabase follows table and notify the target user
    try {
      const sb = getBrowserSupabase();
      if (sb) {
        const { data: { session } } = await sb.auth.getSession();
        const actorName = session?.user?.user_metadata?.name
          || session?.user?.user_metadata?.full_name
          || session?.user?.user_metadata?.user_name
          || session?.user?.user_metadata?.preferred_username
          || session?.user?.user_metadata?.login
          || (session?.user?.email ? session.user.email.split("@")[0] : null)
          || "User";
        const token = session?.access_token || "";
        if (isFollowing) {
          await sb.from("follows").delete().eq("follower_id", actorId).eq("following_id", userId);
          await fetch("/api/notifications", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: "Bearer " + token } : {}),
            },
            body: JSON.stringify({
              recipient_id: userId,
              discussion_id: null,
              actor_name: actorName,
              preview_text: "stopped following you",
            }),
          });
        } else {
          await sb.from("follows").insert({ follower_id: actorId, following_id: userId });
          await fetch("/api/notifications", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: "Bearer " + token } : {}),
            },
            body: JSON.stringify({
              recipient_id: userId,
              discussion_id: null,
              actor_name: actorName,
              preview_text: "started following you",
            }),
          });
        }
      }
    } catch {}
    if (nowFollowing) {
      window.dispatchEvent(new Event("galibierhub-follows-updated"));
    }
    setFollowLoading(false);
  }, [userId, isFollowing, followLoading, currentUserId]);

  const handleSaveProfile = async () => {
    if (!userId) return;
    setSavingProfile(true);
    localStorage.setItem("galibierhub-affiliation", profile.affiliation);
    localStorage.setItem("galibierhub-research-field", profile.researchField);
    localStorage.setItem("galibierhub-role", profile.role);
    localStorage.setItem("galibierhub-bio", profile.bio);
    try {
      const sb = getBrowserSupabase();
      if (sb) {
        await sb.from("profiles").upsert({
          id: userId,
          affiliation: profile.affiliation,
          research_field: profile.researchField,
          role: profile.role,
          bio: profile.bio,
          avatar_url: profile.avatarUrl,
          display_name: profile.displayName,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'id' });
      }
    } catch {}
    setProfileSaved(true);
    setSavingProfile(false);
    setTimeout(() => setProfileSaved(false), 2500);
  };

  useEffect(() => {
   if (!open) return;
   const handleClick = (e: MouseEvent) => {
     if (anchorEl && anchorEl.contains(e.target as Node)) return;
      if (cardRef.current && cardRef.current.contains(e.target as Node)) return;
     onClose();
   };
   document.addEventListener("mousedown", handleClick);
   return () => document.removeEventListener("mousedown", handleClick);
  }, [open, onClose, anchorEl]);

  if (!open) return null;

  const targetPresence = userId ? presence[userId] : null;
  const effectiveStatus = targetPresence?.status || (isOwnCard ? (onlineStatus || "online") : "offline");
  const statusColor = effectiveStatus === "online" ? "bg-emerald-500" : effectiveStatus === "away" ? "bg-amber-400" : effectiveStatus === "busy" ? "bg-red-400" : "bg-gray-300";
  const statusText = effectiveStatus === "online" ? "Online" : effectiveStatus === "away" ? "Away" : effectiveStatus === "busy" ? "Busy" : "Offline";

  const cardWidth = 300;
  const estimatedHeight = Math.min(window.innerHeight - 16, 460);
  const anchorRect = anchorEl?.getBoundingClientRect();
  let top = anchorRect ? anchorRect.bottom + 8 : Math.max(8, (window.innerHeight - estimatedHeight) / 2);
  let left = anchorRect ? anchorRect.left + anchorRect.width - cardWidth : Math.max(8, (window.innerWidth - cardWidth) / 2);
  if (anchorRect) {
    top = Math.max(8, Math.min(top, window.innerHeight - estimatedHeight - 8));
    left = Math.max(8, Math.min(left, window.innerWidth - cardWidth - 8));
  }

  return createPortal(
    <div
      ref={cardRef}
      className="fixed z-[100] rounded-2xl border border-gray-200 bg-white shadow-2xl p-5"
      style={{ top, left, width: cardWidth }}
      onClick={(e) => e.stopPropagation()}
    >
        <div className="flex flex-col items-center">
          {userId && (
           <div className="flex items-center gap-1.5 mb-2">
              <span className={`h-2 w-2 rounded-full ${statusColor}`} />
             <span className="text-[10px] font-medium text-gray-500">{statusText}</span>
            </div>
          )}
          {profile.avatarUrl ? (
            <img
              src={profile.avatarUrl}
              alt={profile.displayName}
              className="h-16 w-16 rounded-full object-cover ring-2 ring-gray-100"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="h-16 w-16 rounded-full bg-gradient-to-br from-slate-500 to-slate-700 flex items-center justify-center text-xl font-semibold text-white ring-2 ring-gray-100">
              {getInitials(profile.displayName)}
            </div>
          )}
          <h3 className="mt-3 text-base font-semibold text-gray-900">{profile.displayName}</h3>
          {profile.userId && (
            <div className="mt-1">
              <BadgeDisplay userId={profile.userId} showScore={true} />
            </div>
          )}
          {profile.role && (
            <span className="mt-1 inline-flex items-center rounded-full bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-slate-700 ring-1 ring-inset ring-slate-200">
              {profile.role}
            </span>
          )}
        </div>

        <div className="mt-4 space-y-2 border-t border-gray-100 pt-3">
          {
            <div className="flex items-start gap-2">
              <svg className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              <div>
                <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">Institution</p>
                <input type="text" value={profile.affiliation} onChange={e => setProfile(p=>({...p, affiliation: e.target.value}))} className="text-sm text-gray-700 bg-transparent border-b border-gray-200 focus:border-slate-500 outline-none w-full" placeholder="Add affiliation..." />
              </div>
            </div>
          }
          {
            <div className="flex items-start gap-2">
              <svg className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              <div>
                <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">Research Field</p>
                <input type="text" value={profile.researchField} onChange={e => setProfile(p=>({...p, researchField: e.target.value}))} className="text-sm text-gray-700 bg-transparent border-b border-gray-200 focus:border-slate-500 outline-none w-full" placeholder="Add research field..." />
              </div>
            </div>
          }
          {
            <div className="flex items-start gap-2">
              <svg className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
              </svg>
              <div>
                <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">Bio</p>
                <textarea value={profile.bio} onChange={e => setProfile(p=>({...p, bio: e.target.value}))} rows={2} className="text-sm text-gray-700 bg-transparent border border-gray-200 focus:border-slate-500 outline-none w-full rounded resize-none" placeholder="Add bio..." />
              </div>
            </div>
          }
        </div>

        <div className="mt-3 flex items-center gap-2">
          {!isOwnCard && userId && (
           <button
             onClick={toggleFollow}
             disabled={followLoading}
              className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${isFollowing ? 'bg-gray-100 text-gray-700 border border-gray-300 hover:bg-red-50 hover:text-red-600 hover:border-red-200' : 'bg-slate-800 text-white hover:bg-slate-700'}`}
           >
              {followLoading ? "..." : isFollowing ? "Unfollow" : "Follow"}
            </button>
          )}
          {isOwnCard && (
            <button
              onClick={handleSaveProfile}
              disabled={savingProfile}
              className="flex-1 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-50 transition-colors"
            >
              {savingProfile ? "Saving..." : profileSaved ? "Saved!" : "Save Profile"}
            </button>
          )}
        </div>

        {!isOwnCard && !userId && (
          <p className="mt-3 text-[10px] text-gray-400 text-center">Sign in to follow users</p>
        )}
      </div>,
    document.body,
  );
}
