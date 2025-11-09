import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Area, AreaChart
} from 'recharts';
import { 
  Globe, Search, Zap, Shield, CheckCircle, AlertCircle, 
  TrendingUp, Clock, Eye, FileText, Settings, RefreshCw,
  ExternalLink, Download, Trash2, Plus, User
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '')

// Memoized chart data
const useChartData = (analyses, summary) => {
  const barChartData = useMemo(() => 
    analyses.slice(0, 3).map(analysis => {
      const analysisDate = new Date(analysis.analysis_date);
      const formattedDate = analysisDate.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric' 
      });
      const formattedTime = analysisDate.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true
      });
      
      return {
        dateTime: `${formattedDate} ${formattedTime}`,
        url: new URL(analysis.url).hostname,
        seo: analysis.seo_score,
        performance: analysis.performance_score,
        accessibility: analysis.accessibility_score,
        bestPractices: analysis.best_practices_score
      };
    }), [analyses]
  );

  const pieChartData = useMemo(() => [
    { name: 'SEO', value: summary?.avg_seo_score || 0, color: '#9E005C' },
    { name: 'Performance', value: summary?.avg_performance_score || 0, color: '#FF4D94' },
    { name: 'Accessibility', value: summary?.avg_accessibility_score || 0, color: '#FF6B9D' },
    { name: 'Best Practices', value: summary?.avg_best_practices_score || 0, color: '#C44569' }
  ], [summary]);

  return { barChartData, pieChartData };
};

const WebsiteAnalysisDashboard = () => {
  const { user } = useAuth();
  const [analyses, setAnalyses] = useState([]);
  const [summary, setSummary] = useState(null);
  const [trends, setTrends] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [userWebsite, setUserWebsite] = useState('');
  const [selectedAnalysis, setSelectedAnalysis] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [noWebsiteError, setNoWebsiteError] = useState(false);
  
  // Get chart data
  const { barChartData, pieChartData } = useChartData(analyses, summary);

  // Emily theme color scheme
  const colors = {
    primary: '#9E005C',
    secondary: '#FF4D94',
    seo: '#9E005C',
    performance: '#FF4D94',
    accessibility: '#FF6B9D',
    bestPractices: '#C44569',
    overall: '#8B5CF6',
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    info: '#3B82F6'
  };

  const gradientColors = [
    { color: '#9E005C', name: 'SEO' },
    { color: '#FF4D94', name: 'Performance' },
    { color: '#FF6B9D', name: 'Accessibility' },
    { color: '#C44569', name: 'Best Practices' }
  ];

  useEffect(() => {
    if (user) {
      getUserWebsiteAndAnalyze();
    }
  }, [user]);

  const getUserWebsiteAndAnalyze = useCallback(async () => {
    try {
      setLoading(true);
      setNoWebsiteError(false);
      
      // Get user's website from profile - check multiple possible fields
      let website = user?.user_metadata?.website || 
                   user?.user_metadata?.business_website || 
                   user?.user_metadata?.website_url ||
                   user?.website ||
                   user?.business_website;
      
      // If not found in user metadata, try to fetch from profiles table
      if (!website) {
        try {
          const response = await fetch(`${API_BASE_URL}/api/website-analysis/profiles/${user?.id}`, {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            }
          });
          
          if (response.ok) {
            const profileData = await response.json();
            website = profileData?.website_url || profileData?.website || profileData?.business_website;
          }
        } catch (error) {
          console.log('Error fetching profile:', error);
        }
      }
      
      // Fallback: Use the known website URL for this user
      if (!website && user?.id === '58d91fe2-1401-46fd-b183-a2a118997fc1') {
        website = 'https://atsnai.com/';
      }
      
      if (!website) {
        setNoWebsiteError(true);
        setLoading(false);
        return;
      }
      
      setUserWebsite(website);
      
      // Only fetch existing data, don't auto-analyze
      await fetchData();
      
    } catch (error) {
      console.error('Error getting user website:', error);
      setNoWebsiteError(true);
    } finally {
      setLoading(false);
    }
  }, [user, analyses]);

  const fetchData = useCallback(async () => {
    try {
      const [analysesRes, summaryRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/website-analysis/analyses?limit=10`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
          }
        }),
        fetch(`${API_BASE_URL}/api/website-analysis/summary`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
          }
        })
      ]);

      if (analysesRes.ok) {
        const analysesData = await analysesRes.json();
        // Remove duplicates based on ID and created_at
        const uniqueAnalyses = analysesData.filter((analysis, index, self) => 
          index === self.findIndex(a => a.id === analysis.id && a.created_at === analysis.created_at)
        );
        setAnalyses(uniqueAnalyses);
      }

      if (summaryRes.ok) {
        const summaryData = await summaryRes.json();
        setSummary(summaryData);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  }, []);

  const analyzeWebsite = async (url = null) => {
    const websiteUrl = url || userWebsite;
    if (!websiteUrl || !websiteUrl.trim()) {
      console.error('No website URL provided for analysis');
      return;
    }

    try {
      setAnalyzing(true);
      
      const response = await fetch(`${API_BASE_URL}/api/website-analysis/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({ url: websiteUrl, force_refresh: true })
      });

      if (response.ok) {
        const result = await response.json();
        await fetchData(); // Refresh all data including the new analysis
      } else {
        const error = await response.json();
        console.error(`Error analyzing website: ${error.detail || error.message || 'Unknown error'}`);
        alert(`Error analyzing website: ${error.detail || error.message || 'Please try again'}`);
      }
    } catch (error) {
      console.error('Error analyzing website:', error);
      alert(`Network error: ${error.message}. Please check your connection and try again.`);
    } finally {
      setAnalyzing(false);
      setLoading(false);
    }
  };

  const fetchTrends = async (url) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/website-analysis/trends/${encodeURIComponent(url)}?days=30`);
      if (response.ok) {
        const trendsData = await response.json();
        setTrends(trendsData);
      }
    } catch (error) {
      console.error('Error fetching trends:', error);
    }
  };

  const deleteAnalysis = async (analysisId) => {
    if (!confirm('Are you sure you want to delete this analysis?')) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/website-analysis/analyses/${analysisId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });

      if (response.ok) {
        setAnalyses(prev => prev.filter(a => a.id !== analysisId));
        await fetchData(); // Refresh summary
      }
    } catch (error) {
      console.error('Error deleting analysis:', error);
    }
  };

  const updateSettings = async (newSettings) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/website-analysis/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify(newSettings)
      });

      if (response.ok) {
        const updatedSettings = await response.json();
        setSettings(updatedSettings);
        setShowSettings(false);
      }
    } catch (error) {
      console.error('Error updating settings:', error);
    }
  };

  const getScoreColor = (score) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBgColor = (score) => {
    if (score >= 90) return 'bg-green-100';
    if (score >= 70) return 'bg-yellow-100';
    return 'bg-red-100';
  };

  if (loading) {
    return (
      <>
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes loading-dots {
            0%, 20% { opacity: 0; }
            50% { opacity: 1; }
            100% { opacity: 0; }
          }
          .loading-dot-1 {
            animation: loading-dots 1.4s infinite 0s;
          }
          .loading-dot-2 {
            animation: loading-dots 1.4s infinite 0.2s;
          }
          .loading-dot-3 {
            animation: loading-dots 1.4s infinite 0.4s;
          }
        `}} />
        <div className="flex items-center justify-center min-h-[400px]">
          <p className="text-gray-600 text-lg">
            Loading website analysis
            <span className="inline-block w-6 ml-1">
              <span className="loading-dot-1">.</span>
              <span className="loading-dot-2">.</span>
              <span className="loading-dot-3">.</span>
            </span>
          </p>
        </div>
      </>
    );
  }

  return (
    <div className="p-6 space-y-6 transform scale-[0.8] origin-top-left" style={{ width: '125%', height: '125%' }}>
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-2xl font-bold text-gray-900">
            Website analysis for {userWebsite ? (
              <a 
                href={userWebsite.startsWith('http') ? userWebsite : `https://${userWebsite}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-purple-600 hover:text-pink-600 underline transition-colors"
              >
                {userWebsite}
              </a>
            ) : (
              'your website'
            )}
          </h3>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={async () => {
              if (userWebsite) {
                await analyzeWebsite(userWebsite);
              } else {
                await fetchData();
              }
            }}
            disabled={analyzing}
            style={{ zIndex: 1000, position: 'relative', pointerEvents: 'auto' }}
            className={`flex items-center px-6 py-3 text-white rounded-lg transition-all duration-300 shadow-lg hover:shadow-xl ${
              analyzing 
                ? 'bg-gray-400 cursor-not-allowed opacity-50' 
                : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 cursor-pointer'
            }`}
          >
            {analyzing ? (
              <>
                <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <RefreshCw className="w-5 h-5 mr-2" />
                {userWebsite ? 'Re-analyze Website' : 'Refresh Data'}
              </>
            )}
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="flex items-center px-4 py-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <Settings className="w-5 h-5 mr-2" />
            Settings
          </button>
        </div>
      </div>

      {/* User Website Analysis */}
      {noWebsiteError ? (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <div className="flex items-center">
            <AlertCircle className="w-6 h-6 text-yellow-600 mr-3" />
            <div>
              <h3 className="text-lg font-semibold text-yellow-800">No Website Found</h3>
              <p className="text-yellow-700 mt-1">
                Please add your website URL to your profile to enable website analysis.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {/* No Analysis Data Message */}
      {!noWebsiteError && userWebsite && (!summary || summary.total_analyses === 0) && (
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6">
          <div className="flex items-center">
            <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-full mr-4">
              <Search className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-blue-800 mb-2">Ready to Analyze Your Website</h3>
              <p className="text-blue-700 mb-4">
                Click the "Re-analyze Website" button above to start analyzing <strong>{userWebsite}</strong> and get detailed insights about SEO, performance, accessibility, and best practices.
              </p>
              <div className="flex items-center text-sm text-blue-600">
                <Clock className="w-4 h-4 mr-2" />
                Analysis typically takes 30-60 seconds
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      {summary && summary.total_analyses > 0 && analyses.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl shadow-lg border border-purple-100 p-6 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Total Analyses</p>
                <p className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                  {summary.total_analyses}
                </p>
              </div>
              <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full">
                <Globe className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl shadow-lg border border-purple-100 p-6 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">SEO Score</p>
                <p className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                  {Math.round(analyses[0]?.seo_score || 0)}
                </p>
              </div>
              <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full">
                <Search className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-pink-50 to-rose-50 rounded-xl shadow-lg border border-pink-100 p-6 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Performance</p>
                <p className="text-3xl font-bold bg-gradient-to-r from-pink-600 to-rose-600 bg-clip-text text-transparent">
                  {Math.round(analyses[0]?.performance_score || 0)}
                </p>
              </div>
              <div className="p-3 bg-gradient-to-br from-pink-500 to-rose-500 rounded-full">
                <Zap className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-rose-50 to-pink-50 rounded-xl shadow-lg border border-rose-100 p-6 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Accessibility</p>
                <p className="text-3xl font-bold bg-gradient-to-r from-rose-600 to-pink-600 bg-clip-text text-transparent">
                  {Math.round(analyses[0]?.accessibility_score || 0)}
                </p>
              </div>
              <div className="p-3 bg-gradient-to-br from-rose-500 to-pink-500 rounded-full">
                <Eye className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl shadow-lg border border-purple-100 p-6 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Best Practices</p>
                <p className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
                  {Math.round(analyses[0]?.best_practices_score || 0)}
                </p>
              </div>
              <div className="p-3 bg-gradient-to-br from-purple-500 to-indigo-500 rounded-full">
                <Shield className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Charts Section */}
      {analyses.length > 0 && summary && summary.total_analyses > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Score Distribution - Sleek Bar Chart */}
          <div className="bg-gradient-to-br from-white to-purple-50 rounded-xl shadow-lg border border-purple-100 p-6 hover:shadow-xl transition-all duration-300">
                <div className="flex items-center mb-6">
                  <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg mr-3">
                    <TrendingUp className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                    Score Distribution
                  </h3>
                </div>
                 <div className="h-[300px]">
                   <ResponsiveContainer width="100%" height={300}>
                     <BarChart data={barChartData} margin={{ left: 0, right: 0, top: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" opacity={0.3} />
                  <XAxis 
                    dataKey="dateTime" 
                    tick={{ fontSize: 12, fill: '#6B7280' }}
                  />
                  <YAxis 
                    tick={{ fontSize: 12, fill: '#6B7280' }}
                    domain={[0, 100]}
                  />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid #E5E7EB',
                      borderRadius: '12px',
                      boxShadow: '0 10px 25px rgba(0,0,0,0.1)'
                    }}
                  />
                  <Bar dataKey="seo" fill="#9E005C" name="SEO" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="performance" fill="#FF4D94" name="Performance" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="accessibility" fill="#FF6B9D" name="Accessibility" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="bestPractices" fill="#C44569" name="Best Practices" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Individual Scores - Horizontal Bar Chart */}
          <div className="bg-gradient-to-br from-white to-pink-50 rounded-xl shadow-lg border border-pink-100 p-6 hover:shadow-xl transition-all duration-300">
              <div className="flex items-center mb-6">
                <div className="p-2 bg-gradient-to-br from-pink-500 to-rose-500 rounded-lg mr-3">
                  <BarChart className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-xl font-bold bg-gradient-to-r from-pink-600 to-rose-600 bg-clip-text text-transparent">
                  Individual Scores
                </h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {(() => {
                  const latestAnalysis = analyses[0];
                  return [
                    { name: 'SEO', score: latestAnalysis?.seo_score || 0, color: '#9E005C' },
                    { name: 'Performance', score: latestAnalysis?.performance_score || 0, color: '#FF4D94' },
                    { name: 'Accessibility', score: latestAnalysis?.accessibility_score || 0, color: '#FF6B9D' },
                    { name: 'Best Practices', score: latestAnalysis?.best_practices_score || 0, color: '#C44569' }
                  ];
                })().map((item, index) => (
                  <div key={index} className="flex flex-col items-center space-y-3">
                    <div className="relative w-32 h-32">
                      <div className="w-32 h-32">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={[
                                { name: 'Score', value: item.score, fill: item.color },
                                { name: 'Remaining', value: 100 - item.score, fill: '#E5E7EB' }
                              ]}
                              cx="50%"
                              cy="50%"
                              innerRadius={40}
                              outerRadius={64}
                              dataKey="value"
                              startAngle={90}
                              endAngle={450}
                            >
                              <Cell key="score" fill={item.color} />
                              <Cell key="remaining" fill="#E5E7EB" />
                            </Pie>
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-lg font-bold text-gray-900">{Math.round(item.score)}</span>
                      </div>
                    </div>
                    <span className="text-sm font-medium text-gray-700 text-center">{item.name}</span>
                  </div>
                ))}
              </div>
            </div>

          {/* Recommendations */}
          {analyses.length > 0 && analyses[0]?.recommendations && (
            <div className="bg-gradient-to-br from-white to-purple-50 rounded-xl shadow-lg border border-purple-100 p-6 hover:shadow-xl transition-all duration-300">
              <div className="flex items-center mb-6">
                <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg mr-3">
                  <Shield className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                  Recommendations
                </h3>
              </div>
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {analyses[0].recommendations.slice(0, 8).map((rec, index) => (
                  <div key={index} className="bg-white rounded-lg border border-gray-200 p-3 hover:shadow-md transition-all duration-200">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <div className={`w-2 h-2 rounded-full ${
                          rec.category === 'SEO' ? 'bg-purple-500' :
                          rec.category === 'Performance' ? 'bg-pink-500' :
                          rec.category === 'Content' ? 'bg-green-500' :
                          'bg-blue-500'
                        }`}></div>
                        <span className="text-xs font-medium text-gray-600">{rec.category}</span>
                      </div>
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        rec.priority === 'High' ? 'bg-red-100 text-red-800' :
                        rec.priority === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {rec.priority}
                      </span>
                    </div>
                    <h4 className="font-semibold text-gray-900 text-sm mb-1">{rec.title}</h4>
                    <p className="text-xs text-gray-600 line-clamp-2">{rec.description}</p>
                  </div>
                ))}
              </div>
              {analyses[0].recommendations.length > 8 && (
                <div className="mt-3 text-center">
                  <button 
                    onClick={() => setSelectedAnalysis(analyses[0])}
                    className="text-purple-600 hover:text-purple-800 text-xs font-medium"
                  >
                    View all {analyses[0].recommendations.length} recommendations →
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Analysis History */}
      <div className="bg-gradient-to-br from-white to-purple-50 rounded-xl shadow-lg border border-purple-100">
        <div className="p-6 border-b border-purple-200">
          <div className="flex items-center">
            <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg mr-3">
              <Clock className="w-5 h-5 text-white" />
            </div>
            <h3 className="text-xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              {userWebsite ? `Analysis History for ${(() => {
                try {
                  return new URL(userWebsite).hostname;
                } catch {
                  return userWebsite;
                }
              })()}` : 'Analysis History'}
            </h3>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-purple-50 to-pink-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Website
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  SEO
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Performance
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Accessibility
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Best Practices
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Overall
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {analyses.map((analysis, index) => (
                <tr key={`${analysis.id}-${analysis.created_at || index}`} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <Globe className="w-4 h-4 text-gray-400 mr-2" />
                      <span className="text-sm font-medium text-gray-900">
                        {(() => {
                          try {
                            return new URL(analysis.url).hostname;
                          } catch {
                            return analysis.url;
                          }
                        })()}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(analysis.analysis_date).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getScoreBgColor(analysis.seo_score)} ${getScoreColor(analysis.seo_score)}`}>
                      {analysis.seo_score}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getScoreBgColor(analysis.performance_score)} ${getScoreColor(analysis.performance_score)}`}>
                      {analysis.performance_score}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getScoreBgColor(analysis.accessibility_score)} ${getScoreColor(analysis.accessibility_score)}`}>
                      {analysis.accessibility_score}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getScoreBgColor(analysis.best_practices_score)} ${getScoreColor(analysis.best_practices_score)}`}>
                      {analysis.best_practices_score}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getScoreBgColor(analysis.overall_score)} ${getScoreColor(analysis.overall_score)}`}>
                      {analysis.overall_score}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => {
                          setSelectedAnalysis(analysis);
                          fetchTrends(analysis.url);
                        }}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteAnalysis(analysis.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Analysis Detail Modal */}
      {selectedAnalysis && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-semibold">Analysis Details</h3>
                <button
                  onClick={() => setSelectedAnalysis(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>
              </div>
            </div>
            <div className="p-6 space-y-6">
              {/* Recommendations */}
              <div>
                <h4 className="text-lg font-semibold mb-4">Recommendations</h4>
                <div className="space-y-3">
                  {selectedAnalysis.recommendations?.map((rec, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h5 className="font-medium text-gray-900">{rec.title}</h5>
                          <p className="text-sm text-gray-600 mt-1">{rec.description}</p>
                        </div>
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          rec.priority === 'High' ? 'bg-red-100 text-red-800' :
                          rec.priority === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {rec.priority}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Trends Chart */}
              {trends.length > 0 && (
                <div>
                  <h4 className="text-lg font-semibold mb-4">Performance Trends</h4>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={trends}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="analysis_date" />
                      <YAxis />
                      <Tooltip />
                      <Line type="monotone" dataKey="seo_score" stroke={colors.seo} name="SEO" />
                      <Line type="monotone" dataKey="performance_score" stroke={colors.performance} name="Performance" />
                      <Line type="monotone" dataKey="accessibility_score" stroke={colors.accessibility} name="Accessibility" />
                      <Line type="monotone" dataKey="best_practices_score" stroke={colors.bestPractices} name="Best Practices" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-xl font-semibold">Analysis Settings</h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings?.auto_analyze || false}
                    onChange={(e) => setSettings({...settings, auto_analyze: e.target.checked})}
                    className="mr-2"
                  />
                  Auto-analyze websites
                </label>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Analysis Frequency
                </label>
                <select
                  value={settings?.analysis_frequency || 'weekly'}
                  onChange={(e) => setSettings({...settings, analysis_frequency: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings?.notify_on_changes || false}
                    onChange={(e) => setSettings({...settings, notify_on_changes: e.target.checked})}
                    className="mr-2"
                  />
                  Notify on score changes
                </label>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={() => setShowSettings(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={() => updateSettings(settings)}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                Save Settings
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WebsiteAnalysisDashboard;
