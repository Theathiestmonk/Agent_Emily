import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

const UsageStats = ({ userPlan }) => {
  const { user } = useAuth();
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userSubscriptionPlan, setUserSubscriptionPlan] = useState(null);
  const [monthlyPostsCount, setMonthlyPostsCount] = useState(0);

  // Get API URL
  const getApiBaseUrl = () => {
    const envUrl = import.meta.env.VITE_API_URL;
    if (envUrl) {
      if (envUrl.startsWith(':')) {
        return `http://localhost${envUrl}`;
      }
      if (!envUrl.startsWith('http://') && !envUrl.startsWith('https://')) {
        return `http://${envUrl}`;
      }
      return envUrl;
    }
    return 'http://localhost:8000';
  };
  const API_BASE_URL = getApiBaseUrl().replace(/\/$/, '');

  // Get authentication token from session
  const getAuthToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token;
  };

  const fetchMonthlyPostsCount = useCallback(async () => {
    try {
      const token = await getAuthToken();
      if (!token) {
        console.error('No authentication token');
        return 0;
      }

      const response = await fetch(`${API_BASE_URL}/content/monthly-count`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch monthly posts count: ${response.status}`);
      }

      const data = await response.json();
      return data.count || 0;
    } catch (error) {
      console.error('Error fetching monthly posts count:', error);
      return 0;
    }
  }, []);

  useEffect(() => {
    if (user?.id) {
      fetchAllUsageStats();
    }
  }, [user?.id]);

  // Real-time subscription to created_content table
  // Only listen to INSERT events - we don't decrease count on DELETE
  // This maintains usage tracking even if posts are deleted
  useEffect(() => {
    if (!user?.id || !usage) return;

    // Subscribe to real-time INSERT events in created_content table
    const channel = supabase
      .channel('created_content_updates')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'created_content',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          const newPost = payload.new;
          console.log('🔄 New post created, updating monthly count...', newPost);
          
          // Check if the post was created in the current month
          if (newPost.created_at) {
            const postDate = new Date(newPost.created_at);
            const now = new Date();
            const isCurrentMonth = postDate.getMonth() === now.getMonth() && 
                                  postDate.getFullYear() === now.getFullYear();
            
            if (isCurrentMonth) {
              // Increment the count locally (more efficient and immediate)
              // Backend uses soft delete, so deleted posts still count towards usage
              setUsage(prev => {
                if (!prev) return prev;
                const newCount = (prev.posts_used || 0) + 1;
                console.log(`✅ Monthly posts count incremented: ${prev.posts_used} → ${newCount}`);
                return {
                  ...prev,
                  posts_used: newCount
                };
              });
              setMonthlyPostsCount(prev => {
                const newCount = prev + 1;
                console.log(`✅ Monthly posts count state updated: ${prev} → ${newCount}`);
                return newCount;
              });
            } else {
              console.log('ℹ️ Post created in different month, not updating count');
            }
          } else {
            console.log('⚠️ Post created_at missing, skipping count update');
          }
        }
      )
      .subscribe();

    // Cleanup subscription on unmount
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, usage]);

  const getUserLimits = (plan) => {
    const limits = {
      'freemium': { tasks: 100, images: 20 },
      'starter': { tasks: 1000, images: 200 },
      'advanced': { tasks: 5000, images: 800 },
      'pro': { tasks: -1, images: 1500 }, // -1 = unlimited tasks
      'admin': { tasks: -1, images: -1 } // Admin = unlimited everything
    };
    return limits[plan] || limits['freemium'];
  };

  const fetchAllUsageStats = async () => {
    try {
      setLoading(true);

      // Fetch both profile data and monthly posts count in parallel
      // Backend now uses soft delete (status='deleted'), so count includes deleted posts
      // This maintains accurate monthly usage tracking
      const [profileResult, postsCount] = await Promise.all([
        supabase
        .from('profiles')
        .select('subscription_plan, tasks_completed_this_month, images_generated_this_month, current_month_start')
        .eq('id', user.id)
          .single(),
        fetchMonthlyPostsCount()
      ]);

      const { data: profile, error } = profileResult;

      if (error) {
        console.error('Error fetching usage stats from Supabase:', error);
        return;
      }

      if (!profile) {
        console.error('No profile data found');
        return;
      }

      console.log('Fetched profile data from Supabase:', profile);

      // Determine the user's plan (use the passed prop or fetched data)
      const plan = userPlan || profile.subscription_plan || 'freemium';
      setUserSubscriptionPlan(plan);

      // Map database plan names to our credit service plan names (case-insensitive)
      const planMapping = {
        'starter': 'starter',
        'free_trial': 'freemium',  // Map free_trial to freemium for credit limits
        'pro': 'pro',
        'admin': 'admin',
        'advanced': 'advanced'
      };
      const creditPlan = planMapping[plan.toLowerCase()] || 'freemium';

      // Get limits for the plan
      const limits = getUserLimits(creditPlan);

      // Format the usage data
      const usageData = {
        tasks_used: profile.tasks_completed_this_month || 0,
        tasks_limit: limits.tasks,
        images_used: profile.images_generated_this_month || 0,
        images_limit: limits.images,
        month_start: profile.current_month_start,
        posts_used: postsCount, // Use persistent monthly posts count (never decreases)
        posts_limit: limits.images // Use same limit as images for posts
      };

      console.log('Processed usage stats:', usageData);
      setUsage(usageData);
      setMonthlyPostsCount(postsCount);

    } catch (error) {
      console.error('Error fetching usage stats:', error);
    } finally {
      setLoading(false);
    }
  };

  // Don't show anything while loading for the first time
  if (!usage) return null;

  const getProgressColor = (used, limit) => {
    const percentage = limit === -1 ? 0 : (used / limit) * 100;
    if (percentage >= 90) return 'bg-red-500 dark:bg-red-500';
    if (percentage >= 75) return 'bg-orange-500 dark:bg-orange-500';
    if (percentage >= 50) return 'bg-yellow-500 dark:bg-yellow-500';
    return 'bg-green-500 dark:bg-green-500';
  };

  const formatLimit = (limit) => {
    return limit === -1 ? '∞' : limit.toString();
  };

  return (
    <div className={`space-y-3 ${loading ? 'opacity-75' : ''}`}>
      <h3 className="text-xs font-normal text-gray-700 dark:text-gray-400 uppercase tracking-wide">
        {userSubscriptionPlan ? `${userSubscriptionPlan.replace('_', ' ').toUpperCase()} - ` : ''}Monthly Usage
        {loading && <span className="ml-1 text-xs">⟳</span>}
      </h3>

      <div className="space-y-3">
        {/* Tasks Usage */}
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-gray-700 dark:text-gray-400 font-medium">Tasks</span>
            <span className="text-gray-800 dark:text-gray-400 font-semibold">
              {usage.tasks_used}/{usage.tasks_limit === -1 ? '∞' : formatLimit(usage.tasks_limit)}
            </span>
          </div>
          <div className="w-full bg-gray-300 dark:bg-gray-700 rounded-full h-1.5">
            {usage.tasks_limit === -1 ? (
              <div className="w-full bg-gradient-to-r from-green-500 to-blue-600 dark:from-green-400 dark:to-blue-500 rounded-full h-1.5">
              </div>
            ) : (
              <div
                className={`h-1.5 rounded-full transition-all duration-300 ${getProgressColor(usage.tasks_used, usage.tasks_limit)}`}
                style={{
                  width: `${Math.min((usage.tasks_used / (usage.tasks_limit === -1 ? usage.tasks_used + 1 : usage.tasks_limit)) * 100, 100)}%`
                }}
              ></div>
            )}
          </div>
        </div>

        {/* Posts Usage - from created_content table */}
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-gray-700 dark:text-gray-400 font-medium">Posts</span>
            <span className="text-gray-800 dark:text-gray-400 font-semibold">
              {usage.posts_used}/{usage.posts_limit === -1 ? '∞' : formatLimit(usage.posts_limit)}
            </span>
          </div>
          <div className="w-full bg-gray-300 dark:bg-gray-700 rounded-full h-1.5">
            {usage.posts_limit === -1 ? (
              <div className="w-full bg-gradient-to-r from-green-500 to-blue-600 dark:from-green-400 dark:to-blue-500 rounded-full h-1.5">
              </div>
            ) : (
              <div
                className={`h-1.5 rounded-full transition-all duration-300 ${getProgressColor(usage.posts_used, usage.posts_limit)}`}
                style={{
                  width: `${Math.min((usage.posts_used / usage.posts_limit) * 100, 100)}%`
                }}
              ></div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UsageStats;
