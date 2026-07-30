"use client";

import { useEffect, useRef, useState } from "react";
import BadgeDisplay from "@/components/badge-display";

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
}: {
  open: boolean;
  onClose: () => void;
  displayName: string;
  userId?: string | null;
  anchorEl?: HTMLElement | null;
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

  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    // Read profile from localStorage
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
  }, [open, displayName, userId]);

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

  return (
   <div className="fixed inset-0 z-50" onClick={onClose}>
     <div
        ref={cardRef}
       className="absolute rounded-2xl border border-gray-200 bg-white shadow-2xl p-5 w-72"
        style={{
          top: anchorEl ? anchorEl.getBoundingClientRect().bottom + 8 + window.scrollY : "50%",
          left: anchorEl ? anchorEl.getBoundingClientRect().left + window.scrollX - 120 : "50%",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col items-center">
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
            <div className="h-16 w-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-xl font-semibold text-white ring-2 ring-gray-100">
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
            <span className="mt-1 inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
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
                <input type="text" value={profile.affiliation} onChange={e => { setProfile(p=>({...p, affiliation: e.target.value})); localStorage.setItem("galibierhub-affiliation", e.target.value); }} className="text-sm text-gray-700 bg-transparent border-b border-gray-200 focus:border-blue-500 outline-none w-full" placeholder="Add affiliation..." />
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
                <input type="text" value={profile.researchField} onChange={e => { setProfile(p=>({...p, researchField: e.target.value})); localStorage.setItem("galibierhub-research-field", e.target.value); }} className="text-sm text-gray-700 bg-transparent border-b border-gray-200 focus:border-blue-500 outline-none w-full" placeholder="Add research field..." />
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
                <textarea value={profile.bio} onChange={e => { setProfile(p=>({...p, bio: e.target.value})); localStorage.setItem("galibierhub-bio", e.target.value); }} rows={2} className="text-sm text-gray-700 bg-transparent border border-gray-200 focus:border-blue-500 outline-none w-full rounded resize-none" placeholder="Add bio..." />
              </div>
            </div>
          }
        </div>

        <p className="mt-3 text-[10px] text-gray-400 text-center">Click fields to edit your profile</p>
      </div>
    </div>
  );
}
