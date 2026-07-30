"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  const ownUserId = typeof window !== 'undefined' ? localStorage.getItem('galibierhub-user-id') : null;
  const isOwnCard = !!(userId && ownUserId && userId === ownUserId);

  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const loadProfile = async () => {
      try {
        const sb = getBrowserSupabase();
        if (sb && userId) {
          const { data } = await sb.from("profiles").select("affiliation, research_field, role, bio, avatar_url").eq("id", userId).single();
          if (data) {
            setProfile({
              displayName,
              affiliation: data.affiliation || "",
              researchField: data.research_field || "",
              role: data.role || "",
              bio: data.bio || "",
              avatarUrl: data.avatar_url || null,
              userId: userId || null,
            });
            return;
          }
        }
      } catch {}
      const aff = localStorage.getItem("galibierhub-affiliation") || "";
      const rf = localStorage.getItem("galibierhub-research-field") || "";
      const role = localStorage.getItem("galibierhub-role") || "";
      const bio = localStorage.getItem("galibierhub-bio") || "";
      const avatar = localStorage.getItem("galibierhub-custom-avatar") || "";
      setProfile({
        displayName,
        affiliation: aff,
        researchField: rf,
        role,
        bio,
        avatarUrl: avatar || null,
        userId: userId || null,
      });
    };
    loadProfile();
    if (userId) {
      const following = JSON.parse(localStorage.getItem("galibierhub-following") || "[]");
      setIsFollowing(following.includes(userId));
    }
  }, [open, displayName, userId]);

  const toggleFollow = useCallback(async () => {
    if (!userId || followLoading) return;
    setFollowLoading(true);
    const following = JSON.parse(localStorage.getItem("galibierhub-following") || "[]");
    if (isFollowing) {
      const idx = following.indexOf(userId);
      if (idx > -1) following.splice(idx, 1);
    } else {
      following.push(userId);
    }
    localStorage.setItem("galibierhub-following", JSON.stringify(following));
    setIsFollowing(!isFollowing);
    // Persist to Supabase follows table
    if (ownUserId) {
      try {
        const sb = getBrowserSupabase();
        if (sb) {
          if (isFollowing) {
            await sb.from("follows").delete().eq("follower_id", ownUserId).eq("following_id", userId);
          } else {
            await sb.from("follows").insert({ follower_id: ownUserId, following_id: userId });
          }
        }
      } catch {}
    }
    setFollowLoading(false);
  }, [userId, isFollowing, followLoading, ownUserId]);

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

  const statusColor = onlineStatus === "online" ? "bg-emerald-500" : onlineStatus === "away" ? "bg-amber-400" : "bg-red-400";
  const statusText = onlineStatus === "online" ? "Online" : onlineStatus === "away" ? "Away" : "Busy";

  return (
   <div className="fixed inset-0 z-50" onClick={onClose}>
     <div
        ref={cardRef}
       className="absolute rounded-2xl border border-gray-200 bg-white shadow-2xl p-5 w-[300px]"
        style={{
          top: anchorEl ? anchorEl.getBoundingClientRect().bottom + 8 + window.scrollY : "50%",
          left: anchorEl ? anchorEl.getBoundingClientRect().left + window.scrollX - 120 : "50%",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col items-center">
          {onlineStatus && (
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
      </div>
    </div>
  );
}
