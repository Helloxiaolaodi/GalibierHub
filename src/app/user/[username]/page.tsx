"use client";

import { useCallback, useEffect, useState, use } from "react";
import Link from "next/link";
import { getBrowserSupabase } from "@/utils/supabase-browser";
import BadgeDisplay from "@/components/badge-display";

type ProfileData = {
  id: string;
  username: string;
  display_name: string;
  bio: string;
  affiliation: string;
  research_field: string;
  role: string;
  avatar_url: string | null;
  created_at: string;
  reputation_score: number;
};

type BadgeItem = { badge_id: string; awarded_at: string; name?: string; icon?: string; description?: string; tier?: string };
type ActivityItem = { id: string; title: string; type: "post" | "reply"; created_at: string; feedback_id?: string };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function getInitials(n: string): string {
  if (!n) return "?";
  const p = n.trim().split(/\s+/);
  return p.length >= 2 ? (p[0][0] + p[1][0]).toUpperCase() : n.substring(0, 2).toUpperCase();
}

function formatTimeAgo(d: string): string {
  const diff = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return Math.floor(diff / 60) + "m ago";
  if (diff < 86400) return Math.floor(diff / 3600) + "h ago";
  if (diff < 2592000) return Math.floor(diff / 86400) + "d ago";
  return Math.floor(diff / 2592000) + "mo ago";
}

type TabId = "profile" | "activity" | "saves";

export default function UserProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = use(params);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [badges, setBadges] = useState<BadgeItem[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [activeTab, setActiveTab] = useState<TabId>("profile");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [postCount, setPostCount] = useState(0);
  const [replyCount, setReplyCount] = useState(0);
  const [likeCount, setLikeCount] = useState(0);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (typeof window !== "undefined" && window.location.search.includes("tab=activity")) {
      setActiveTab("activity");
    }
  }, []);

  // Load profile by username
  useEffect(() => {
    if (!username) return;
    const loadProfile = async () => {
      setLoading(true);
      setError(null);
      try {
        const sb = getBrowserSupabase();
        if (!sb) throw new Error("Supabase client not initialized.");

        let profileQuery = sb.from("profiles").select("*");
        profileQuery = UUID_RE.test(username)
          ? profileQuery.eq("id", username)
          : profileQuery.eq("username", username);
        const { data, error: queryError } = await profileQuery.single();

        if (queryError || !data) {
          throw new Error("User not found.");
        }

        setProfile(data as ProfileData);

        // Fetch badges
        const { data: badgeData } = await sb
          .from("user_badges")
          .select("*")
          .eq("user_id", data.id);
        setBadges(badgeData || []);

        // Fetch post count
        const { count: pCount } = await sb
          .from("site_feedback")
          .select("*", { count: "exact", head: true })
          .eq("user_id", data.id);
        setPostCount(pCount || 0);

        // Fetch reply count
        const { count: rCount } = await sb
          .from("feedback_comments")
          .select("*", { count: "exact", head: true })
          .eq("user_id", data.id);
        setReplyCount(rCount || 0);

        // Check if current user is following
        const storedId = localStorage.getItem("galibierhub-user-id");
        setCurrentUserId(storedId);
        if (storedId && storedId !== data.id) {
          const { data: followData } = await sb
            .from("follows")
            .select("*")
            .eq("follower_id", storedId)
            .eq("following_id", data.id)
            .single();
          setIsFollowing(!!followData);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load profile.");
      } finally {
        setLoading(false);
      }
    };
    loadProfile();
  }, [username]);

  // Load activities
  useEffect(() => {
    if (!profile) return;
    const loadActivities = async () => {
      try {
        const sb = getBrowserSupabase();
        if (!sb) return;

        const { data: posts } = await sb
          .from("site_feedback")
          .select("id, title, created_at")
          .eq("user_id", profile.id)
          .order("created_at", { ascending: false })
          .limit(20);

        const { data: replies } = await sb
          .from("feedback_comments")
          .select("id, message, created_at, feedback_id")
          .eq("user_id", profile.id)
          .order("created_at", { ascending: false })
          .limit(20);

        const mapped: ActivityItem[] = [
          ...(posts || []).map((p: { id: string; title: string; created_at: string }) => ({
            id: p.id,
            title: p.title,
            type: "post" as const,
            created_at: p.created_at,
          })),
          ...(replies || []).map((r: { id: string; message: string; created_at: string; feedback_id: string }) => ({
            id: r.id,
            title: r.message?.substring(0, 100) || "Reply",
            type: "reply" as const,
            created_at: r.created_at,
            feedback_id: r.feedback_id,
          })),
        ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        setActivities(mapped.slice(0, 30));
      } catch {}
    };
    loadActivities();
  }, [profile]);

  const toggleFollow = useCallback(async () => {
    if (!currentUserId || !profile) return;
    setFollowLoading(true);
    try {
      const sb = getBrowserSupabase();
      if (!sb) return;
      if (isFollowing) {
        await sb.from("follows").delete().eq("follower_id", currentUserId).eq("following_id", profile.id);
        setIsFollowing(false);
      } else {
        await sb.from("follows").insert({ follower_id: currentUserId, following_id: profile.id });
        try {
          const { data: { session } } = await sb.auth.getSession();
          const actorName = session?.user?.user_metadata?.name
            || session?.user?.user_metadata?.full_name
            || session?.user?.user_metadata?.user_name
            || session?.user?.user_metadata?.preferred_username
            || session?.user?.user_metadata?.login
            || (session?.user?.email ? session.user.email.split("@")[0] : null)
            || "User";
          await fetch("/api/notifications", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(session?.access_token ? { Authorization: "Bearer " + session.access_token } : {}),
            },
            body: JSON.stringify({
              recipient_id: profile.id,
              discussion_id: null,
              actor_name: actorName,
              preview_text: "started following you",
            }),
          });
        } catch {}
        setIsFollowing(true);
      }
    } catch {} finally {
      setFollowLoading(false);
    }
  }, [currentUserId, profile, isFollowing]);

  if (!mounted) return null;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-slate-300 border-t-slate-600 rounded-full"></div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-slate-800 mb-2">User not found</h1>
          <p className="text-gray-500 mb-4">{error || "The requested profile does not exist."}</p>
          <Link href="/" className="text-sm text-slate-600 hover:text-slate-800 font-medium hover:underline">Back to Home</Link>
        </div>
      </div>
    );
  }

  const displayName = profile.display_name || profile.username;
  const isOwnProfile = currentUserId === profile.id;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Back nav */}
      <div className="max-w-4xl mx-auto px-4 py-3">
        <Link href="/" className="text-xs text-slate-500 hover:text-slate-700 inline-flex items-center gap-1">
          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          Back to Home
        </Link>
      </div>

      {/* Profile Header */}
      <div className="max-w-4xl mx-auto px-4 pb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row items-start gap-5">
            {/* Avatar */}
            <div className="flex-shrink-0">
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt={displayName} className="w-20 h-20 rounded-full object-cover border-2 border-gray-100" />
              ) : (
                <div className="w-20 h-20 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 text-xl font-semibold border-2 border-gray-100">
                  {getInitials(displayName)}
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-xl font-semibold text-slate-800">{displayName}</h1>
                {profile.role && profile.role !== "user" && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700">
                    {profile.role}
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-500 mt-0.5">@{profile.username}</p>

              {profile.affiliation && (
                <p className="text-sm text-gray-600 mt-1.5">{profile.affiliation}</p>
              )}
              {profile.research_field && (
                <p className="text-xs text-gray-500 mt-0.5">Research: {profile.research_field}</p>
              )}

              <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                <span>Joined {new Date(profile.created_at).toLocaleDateString("en-US", { year: "numeric", month: "short" })}</span>
                <span>{postCount} posts</span>
                <span>{replyCount} replies</span>
              </div>
            </div>

            {/* Follow / Edit buttons */}
            <div className="flex-shrink-0">
              {isOwnProfile ? (
                <Link href="/settings/preferences" className="inline-flex items-center px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                  Edit Profile
                </Link>
              ) : (
                <button
                  onClick={toggleFollow}
                  disabled={followLoading || !currentUserId}
                  className={`inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isFollowing
                      ? "bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200"
                      : "bg-slate-800 text-white hover:bg-slate-700"
                  }`}
                >
                  {followLoading ? "..." : isFollowing ? "Following" : "Follow"}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-4 flex border-b border-gray-200">
          {(["profile", "activity", "saves"] as TabId[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2.5 text-sm font-medium transition-colors capitalize ${
                activeTab === tab
                  ? "text-slate-800 border-b-2 border-slate-800"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="mt-4">
          {/* Profile Tab */}
          {activeTab === "profile" && (
            <div className="space-y-4">
              {/* Bio */}
              <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                <h3 className="text-sm font-semibold text-slate-700 mb-2">About</h3>
                <p className="text-sm text-gray-600 whitespace-pre-wrap">{profile.bio || "No bio provided yet."}</p>
              </div>

              {/* Badges */}
              {badges.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                  <h3 className="text-sm font-semibold text-slate-700 mb-3">Badges</h3>
                  <div className="flex flex-wrap gap-2">
                    {badges.map((b) => (
                      <span
                        key={b.badge_id}
                        className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200"
                        title={b.description || b.name || b.badge_id}
                      >
                        {b.icon || ""} {b.name || b.badge_id}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Activity Tab */}
          {activeTab === "activity" && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm divide-y divide-gray-100">
              {activities.length === 0 ? (
                <div className="p-6 text-center text-sm text-gray-500">No activity yet.</div>
              ) : (
                activities.map((item) => (
                  <div key={item.id} className="px-5 py-3 flex items-center gap-3">
                    <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium ${item.type === "post" ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700"}`}>
                      {item.type === "post" ? "P" : "R"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <Link
                        href={item.type === "post" ? `/discussions/${item.id}` : item.feedback_id ? `/discussions/${item.feedback_id}` : "#"}
                        className="text-sm text-slate-700 hover:text-slate-900 font-medium truncate block"
                      >
                        {item.title}
                      </Link>
                      <span className="text-xs text-gray-400">{formatTimeAgo(item.created_at)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Saves Tab */}
          {activeTab === "saves" && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 text-center">
              <p className="text-sm text-gray-500">Saved discussions will appear here.</p>
              <p className="text-xs text-gray-400 mt-1">Bookmark posts to keep track of useful content.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
