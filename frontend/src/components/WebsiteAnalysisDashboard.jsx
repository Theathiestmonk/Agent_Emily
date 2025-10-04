import React, { useState, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Area, AreaChart
} from 'recharts';
import { 
  Globe, Search, Zap, Shield, CheckCircle, AlertCircle, 
  TrendingUp, Clock, Eye, FileText, Settings, RefreshCw,
  ExternalLink, Download, Trash2, Plus
} from 'lucide-react';

const WebsiteAnalysisDashboard = () => {
  const [analyses, setAnalyses] = useState([]);
  const [summary, setSummary] = useState(null);
  const [trends, setTrends] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [newUrl, setNewUrl] = useState('');
  const [selectedAnalysis, setSelectedAnalysis] = useState(null);
  const [showSettings, setShowSettings] = useState(false);

  // Color scheme
  const colors = {
    seo: '#3B82F6',
    performance: '#10B981',
    accessibility: '#F59E0B',
    bestPractices: '#EF4444',
    overall: '#8B5CF6'
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [analysesRes, summaryRes, settingsRes] = await Promise.all([
        fetch('/api/website-analysis/analyses?limit=20'),
        fetch('/api/website-analysis/summary'),
        fetch('/api/website-analysis/settings')
      ]);

      if (analysesRes.ok) {
        const analysesData = await analysesRes.json();
        setAnalyses(analysesData);
      }

      if (summaryRes.ok) {
        const summaryData = await summaryRes.json();
        setSummary(summaryData);
      }

      if (settingsRes.ok) {
        const settingsData = await settingsRes.json();
        setSettings(settingsData);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const analyzeWebsite = async () => {
    if (!newUrl.trim()) return;

    try {
      setAnalyzing(true);
      const response = await fetch('/api/website-analysis/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        },
        body: JSON.stringify({ url: newUrl })
      });

      if (response.ok) {
        const result = await response.json();
        setAnalyses(prev => [result, ...prev]);
        setNewUrl('');
        await fetchData(); // Refresh summary
      } else {
        const error = await response.json();
        alert(`Error: ${error.detail}`);
      }
    } catch (error) {
      console.error('Error analyzing website:', error);
      alert('Failed to analyze website');
    } finally {
      setAnalyzing(false);
    }
  };

  const fetchTrends = async (url) => {
    try {
      const response = await fetch(`/api/website-analysis/trends/${encodeURIComponent(url)}?days=30`);
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
      const response = await fetch(`/api/website-analysis/analyses/${analysisId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
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
      const response = await fetch('/api/website-analysis/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
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
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Website Analysis</h1>
          <p className="text-gray-600 mt-1">Analyze and optimize your website performance</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => setShowSettings(true)}
            className="flex items-center px-4 py-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <Settings className="w-5 h-5 mr-2" />
            Settings
          </button>
          <button
            onClick={fetchData}
            className="flex items-center px-4 py-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <RefreshCw className="w-5 h-5 mr-2" />
            Refresh
          </button>
        </div>
      </div>

      {/* New Analysis Form */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Analyze New Website</h2>
        <div className="flex space-x-4">
          <input
            type="url"
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            placeholder="Enter website URL (e.g., https://example.com)"
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
          <button
            onClick={analyzeWebsite}
            disabled={analyzing || !newUrl.trim()}
            className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            {analyzing ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4 mr-2" />
                Analyze
              </>
            )}
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Analyses</p>
                <p className="text-2xl font-bold text-gray-900">{summary.total_analyses}</p>
              </div>
              <Globe className="w-8 h-8 text-blue-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">SEO Score</p>
                <p className={`text-2xl font-bold ${getScoreColor(summary.avg_seo_score)}`}>
                  {Math.round(summary.avg_seo_score)}
                </p>
              </div>
              <Search className="w-8 h-8 text-blue-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Performance</p>
                <p className={`text-2xl font-bold ${getScoreColor(summary.avg_performance_score)}`}>
                  {Math.round(summary.avg_performance_score)}
                </p>
              </div>
              <Zap className="w-8 h-8 text-green-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Accessibility</p>
                <p className={`text-2xl font-bold ${getScoreColor(summary.avg_accessibility_score)}`}>
                  {Math.round(summary.avg_accessibility_score)}
                </p>
              </div>
              <Eye className="w-8 h-8 text-yellow-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Best Practices</p>
                <p className={`text-2xl font-bold ${getScoreColor(summary.avg_best_practices_score)}`}>
                  {Math.round(summary.avg_best_practices_score)}
                </p>
              </div>
              <Shield className="w-8 h-8 text-red-600" />
            </div>
          </div>
        </div>
      )}

      {/* Charts Section */}
      {analyses.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Score Distribution */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">Score Distribution</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analyses.slice(0, 10).map(analysis => ({
                url: new URL(analysis.url).hostname,
                seo: analysis.seo_score,
                performance: analysis.performance_score,
                accessibility: analysis.accessibility_score,
                bestPractices: analysis.best_practices_score
              }))}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="url" angle={-45} textAnchor="end" height={100} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="seo" fill={colors.seo} name="SEO" />
                <Bar dataKey="performance" fill={colors.performance} name="Performance" />
                <Bar dataKey="accessibility" fill={colors.accessibility} name="Accessibility" />
                <Bar dataKey="bestPractices" fill={colors.bestPractices} name="Best Practices" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Score Breakdown */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">Overall Score Breakdown</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={[
                    { name: 'SEO', value: summary?.avg_seo_score || 0, color: colors.seo },
                    { name: 'Performance', value: summary?.avg_performance_score || 0, color: colors.performance },
                    { name: 'Accessibility', value: summary?.avg_accessibility_score || 0, color: colors.accessibility },
                    { name: 'Best Practices', value: summary?.avg_best_practices_score || 0, color: colors.bestPractices }
                  ]}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${Math.round(value)}`}
                >
                  {[colors.seo, colors.performance, colors.accessibility, colors.bestPractices].map((color, index) => (
                    <Cell key={`cell-${index}`} fill={color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Analysis History */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold">Analysis History</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
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
              {analyses.map((analysis) => (
                <tr key={analysis.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <Globe className="w-4 h-4 text-gray-400 mr-2" />
                      <span className="text-sm font-medium text-gray-900">
                        {new URL(analysis.url).hostname}
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
