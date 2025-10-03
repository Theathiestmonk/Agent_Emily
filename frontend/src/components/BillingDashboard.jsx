import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { subscriptionAPI } from '../services/subscription';
import { generateInvoicePDF, generateBillingHistoryPDF } from '../services/pdfGenerator';
import SideNavbar from './SideNavbar';
import { 
  CreditCard, 
  Calendar, 
  Download, 
  RefreshCw, 
  CheckCircle, 
  AlertCircle,
  Clock,
  DollarSign,
  FileText,
  ArrowRight,
  Loader2
} from 'lucide-react';

const BillingDashboard = () => {
  const { user } = useAuth();
  const [subscriptionStatus, setSubscriptionStatus] = useState(null);
  const [billingHistory, setBillingHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchBillingData();
  }, []);

  const fetchBillingData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch subscription status
      const statusResponse = await subscriptionAPI.getSubscriptionStatus();
      setSubscriptionStatus(statusResponse.data);
      
      // Fetch billing history
      const historyResponse = await subscriptionAPI.getBillingHistory();
      setBillingHistory(historyResponse.data.billing_history || []);
      
    } catch (err) {
      console.error('Error fetching billing data:', err);
      setError('Failed to load billing information');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchBillingData();
    setRefreshing(false);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatCurrency = (amount) => {
    return `₹${(amount / 100).toFixed(2)}`;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
        return 'text-green-600 bg-green-100';
      case 'cancelled':
        return 'text-red-600 bg-red-100';
      case 'expired':
        return 'text-orange-600 bg-orange-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="w-4 h-4" />;
      case 'cancelled':
        return <AlertCircle className="w-4 h-4" />;
      case 'expired':
        return <Clock className="w-4 h-4" />;
      default:
        return <AlertCircle className="w-4 h-4" />;
    }
  };

  const calculateNextPayment = (startDate, billingCycle) => {
    const start = new Date(startDate);
    const next = new Date(start);
    
    if (billingCycle === 'monthly') {
      next.setMonth(next.getMonth() + 1);
    } else {
      next.setFullYear(next.getFullYear() + 1);
    }
    
    return next;
  };

  const handleUpgradePlan = () => {
    window.location.href = '/subscription';
  };

  const handleCancelSubscription = async () => {
    if (!subscriptionStatus?.subscription_id) {
      alert('No active subscription to cancel');
      return;
    }

    const confirmed = window.confirm(
      'Are you sure you want to cancel your subscription? You will lose access to premium features at the end of your current billing period.'
    );

    if (!confirmed) return;

    try {
      setActionLoading(true);
      await subscriptionAPI.cancelSubscription(subscriptionStatus.subscription_id);
      alert('Subscription cancelled successfully. You will retain access until the end of your current billing period.');
      await fetchBillingData(); // Refresh data
    } catch (error) {
      console.error('Error cancelling subscription:', error);
      alert('Failed to cancel subscription. Please try again or contact support.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleExportBilling = () => {
    try {
      // Generate PDF
      const pdf = generateBillingHistoryPDF(billingHistory, {
        name: user?.user_metadata?.name || 'Customer',
        email: user?.email || 'N/A'
      });
      
      // Download PDF
      pdf.save(`billing-history-${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Please try again.');
    }
  };

  const handleDownloadInvoice = (invoice) => {
    try {
      // Generate individual invoice PDF
      const pdf = generateInvoicePDF(invoice, billingHistory);
      
      // Download PDF
      pdf.save(`invoice-${invoice.id}-${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
      console.error('Error generating invoice PDF:', error);
      alert('Failed to generate invoice PDF. Please try again.');
    }
  };

  const handleUpdatePaymentMethod = () => {
    // For now, redirect to subscription page where they can update payment
    window.location.href = '/subscription';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <SideNavbar />
        <div className="ml-64 flex items-center justify-center min-h-screen">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-purple-600" />
            <p className="text-gray-600">Loading billing information...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Side Navbar */}
      <SideNavbar />
      
      {/* Main Content */}
      <div className="ml-64 flex flex-col min-h-screen">
        {/* Fixed Header */}
        <div className="fixed top-0 right-0 left-64 bg-white shadow-sm border-b z-30" style={{position: 'fixed', zIndex: 30}}>
          <div className="px-6 py-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-4">
                <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-full flex items-center justify-center">
                  <CreditCard className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Billing & Subscription</h1>
                  <p className="text-sm text-gray-500">Manage your subscription and view billing history</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-4">
                <button
                  onClick={handleRefresh}
                  disabled={refreshing}
                  className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-lg hover:from-indigo-600 hover:to-purple-500 transition-all duration-300 disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 pt-24 p-6">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center">
                <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
                <p className="text-red-700">{error}</p>
              </div>
            </div>
          )}

          <div className="space-y-6">
            {/* Current Subscription Card */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900">Current Subscription</h2>
                <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(subscriptionStatus?.status || 'inactive')}`}>
                  {getStatusIcon(subscriptionStatus?.status || 'inactive')}
                  <span className="capitalize">{subscriptionStatus?.status || 'Inactive'}</span>
                </div>
              </div>

              {subscriptionStatus?.has_active_subscription ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <p className="text-sm text-gray-500">Plan</p>
                    <p className="text-lg font-semibold text-gray-900 capitalize">{subscriptionStatus?.plan || 'N/A'}</p>
                  </div>
                  
                  <div className="space-y-2">
                    <p className="text-sm text-gray-500">Started</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {subscriptionStatus?.subscription_start_date ? 
                        formatDate(subscriptionStatus.subscription_start_date) : 'N/A'}
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <p className="text-sm text-gray-500">Next Payment</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {subscriptionStatus?.subscription_start_date ? 
                        formatDate(calculateNextPayment(subscriptionStatus.subscription_start_date, 'monthly')) : 'N/A'}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <CreditCard className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No Active Subscription</h3>
                  <p className="text-gray-500 mb-4">You don't have an active subscription. Choose a plan to get started.</p>
                  <button
                    onClick={() => window.location.href = '/subscription'}
                    className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-lg hover:from-indigo-600 hover:to-purple-500 transition-all duration-300"
                  >
                    View Plans
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </button>
                </div>
              )}
            </div>

            {/* Billing History */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Billing History</h2>
                <button 
                  onClick={handleExportBilling}
                  className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:text-gray-900 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  <span>Export PDF</span>
                </button>
              </div>

              {billingHistory.length > 0 ? (
                <div className="space-y-4">
                  {billingHistory.map((invoice) => (
                    <div key={invoice.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                      <div className="flex items-center space-x-4">
                        <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-lg flex items-center justify-center">
                          <FileText className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{invoice.description}</p>
                          <p className="text-sm text-gray-500">Invoice #{invoice.id}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-6">
                        <div className="text-right">
                          <p className="font-semibold text-gray-900">{formatCurrency(invoice.amount)}</p>
                          <p className="text-sm text-gray-500">{formatDate(invoice.date)}</p>
                        </div>
                        
                        <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(invoice.status)}`}>
                          {getStatusIcon(invoice.status)}
                          <span className="capitalize">{invoice.status}</span>
                        </div>
                        
                        <button 
                          onClick={() => handleDownloadInvoice(invoice)}
                          className="flex items-center space-x-2 px-3 py-2 text-gray-600 hover:text-gray-900 transition-colors text-sm"
                        >
                          <Download className="w-4 h-4" />
                          <span>Download Invoice</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No Billing History</h3>
                  <p className="text-gray-500">Your billing history will appear here once you make your first payment.</p>
                </div>
              )}
            </div>

            {/* Payment Method */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Payment Method</h2>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-8 bg-gradient-to-r from-blue-500 to-blue-600 rounded flex items-center justify-center">
                    <CreditCard className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Razorpay Payment Gateway</p>
                    <p className="text-sm text-gray-500">Secure payment processing</p>
                  </div>
                </div>
                <button 
                  onClick={handleUpdatePaymentMethod}
                  className="px-4 py-2 text-purple-600 hover:text-purple-700 font-medium transition-colors"
                >
                  Update
                </button>
              </div>
            </div>

            {/* Subscription Management */}
            {subscriptionStatus?.has_active_subscription && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Subscription Management</h2>
                <div className="flex items-center space-x-4">
                  <button 
                    onClick={handleUpgradePlan}
                    className="px-6 py-3 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-lg hover:from-indigo-600 hover:to-purple-500 transition-all duration-300"
                  >
                    Upgrade Plan
                  </button>
                  <button 
                    onClick={handleCancelSubscription}
                    disabled={actionLoading}
                    className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {actionLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-2 inline" />
                        Cancelling...
                      </>
                    ) : (
                      'Cancel Subscription'
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BillingDashboard;
