import React, { useState, useEffect } from 'react';
import { Check, ArrowRight, Loader2, Home, HelpCircle, Settings, LogOut, Clock, Gift } from 'lucide-react';
import { subscriptionAPI } from '../services/subscription';
import { trialAPI } from '../services/trial';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

const SubscriptionSelector = () => {
  const [plans, setPlans] = useState([]);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [billingCycle, setBillingCycle] = useState('monthly');
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [loadingPlan, setLoadingPlan] = useState(null); // Track which plan is loading
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [trialInfo, setTrialInfo] = useState(null);
  const [loadingTrial, setLoadingTrial] = useState(true);
  const { logout } = useAuth();

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch subscription plans
        const plansResponse = await subscriptionAPI.getPlans();
        setPlans(plansResponse.data.plans);
        setLoadingPlans(false);

        // Fetch trial information
        try {
          const trialResponse = await trialAPI.getTrialInfo();
          setTrialInfo(trialResponse.data.trial_info);
        } catch (trialError) {
          console.log('No trial information available:', trialError);
          setTrialInfo(null);
        }
      } catch (error) {
        console.error('Error fetching subscription plans:', error);
        setLoadingPlans(false);
      } finally {
        setLoadingTrial(false);
      }
    };

    fetchData();
  }, []);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleSubscribe = async (planName) => {
    setLoadingPlan(planName);
    try {
      console.log('🚀 Creating subscription for plan:', planName, 'billing:', billingCycle);
      
      // First ensure profile exists
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          console.log('🔍 Ensuring profile exists before subscription creation...');
          
          // Check if profile exists
          const { data: existingProfile } = await supabase
            .from('profiles')
            .select('id')
            .eq('id', user.id)
            .maybeSingle();
          
          if (!existingProfile) {
            console.log('➕ Creating profile before subscription...');
            await supabase
              .from('profiles')
              .upsert({
                id: user.id,
                name: user.user_metadata?.name || user.email,
                onboarding_completed: false,
                subscription_status: 'inactive',
                migration_status: 'pending'
              });
            console.log('✅ Profile created successfully!');
          }
        }
      } catch (profileError) {
        console.log('⚠️ Profile creation failed, proceeding anyway:', profileError);
      }
      
      const response = await subscriptionAPI.createSubscription({
        plan_name: planName,
        billing_cycle: billingCycle
      });
      
      console.log('📊 Subscription creation response:', response.data);
      
      if (response.data.success) {
        if (response.data.payment_url) {
          console.log('✅ Payment URL received, redirecting to:', response.data.payment_url);
          // Redirect to Razorpay payment page for paid plans
          window.location.href = response.data.payment_url;
        } else {
          console.log('✅ Free trial activated successfully!');
          // For free trials, show success message and refresh page to show trial banner
          alert('Free trial activated successfully!');
          // Refresh the page to update subscription status and show trial banner
          window.location.reload();
        }
      } else {
        console.error('❌ Failed to create subscription');
        console.error('Response data:', response.data);
        alert(`Failed to create subscription: ${response.data.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('💥 Error creating subscription:', error);
      console.error('Error details:', error.response?.data);
      alert(`Error creating subscription: ${error.response?.data?.detail || error.message || 'Unknown error'}`);
    } finally {
      setLoadingPlan(null);
    }
  };

  if (loadingPlans || loadingTrial) {
    return (
      <div className="min-h-screen bg-[#F6F6F6] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-[#9E005C]" />
          <p className="text-gray-600">Loading subscription plans...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F6F6F6] flex flex-col">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            {/* Logo and Brand */}
            <div className="flex items-center space-x-2 sm:space-x-4">
              <div className="w-8 h-8 sm:w-12 sm:h-12 bg-gradient-to-r from-pink-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                <span className="text-white font-bold text-sm sm:text-xl">E</span>
              </div>
              <div>
                <h1 className="text-lg sm:text-2xl font-bold text-gray-900">Emily</h1>
                <p className="text-xs sm:text-sm text-gray-500 hidden sm:block">AI Marketing Assistant</p>
              </div>
            </div>

            {/* Header Buttons - Desktop */}
            <div className="hidden md:flex items-center space-x-3">
              <button
                onClick={() => window.location.href = '/dashboard'}
                className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Home className="w-4 h-4" />
                <span className="text-sm font-medium">Dashboard</span>
              </button>
              
              <button
                onClick={() => window.open('/help', '_blank')}
                className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <HelpCircle className="w-4 h-4" />
                <span className="text-sm font-medium">Help</span>
              </button>
              
              <button
                onClick={() => window.location.href = '/profile'}
                className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Settings className="w-4 h-4" />
                <span className="text-sm font-medium">Settings</span>
              </button>
              
              <div className="h-6 w-px bg-gray-300"></div>
              
              <button
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="flex items-center space-x-2 px-4 py-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoggingOut ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <LogOut className="w-4 h-4" />
                )}
                <span className="text-sm font-medium">
                  {isLoggingOut ? 'Logging out...' : 'Logout'}
                </span>
              </button>
            </div>

            {/* Mobile Header Buttons */}
            <div className="flex md:hidden items-center space-x-2">
              <button
                onClick={() => window.location.href = '/dashboard'}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                title="Dashboard"
              >
                <Home className="w-5 h-5" />
              </button>
              
              <button
                onClick={() => window.open('/help', '_blank')}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                title="Help"
              >
                <HelpCircle className="w-5 h-5" />
              </button>
              
              <button
                onClick={() => window.location.href = '/profile'}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                title="Settings"
              >
                <Settings className="w-5 h-5" />
              </button>
              
              <div className="h-6 w-px bg-gray-300"></div>
              
              <button
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Logout"
              >
                {isLoggingOut ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <LogOut className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center py-4 sm:py-8">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 w-full">
        {/* Header */}
        <div className="text-center mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 sm:mb-4">
            <span className="bg-gradient-to-r from-[#9E005C] to-[#FF4D94] bg-clip-text text-transparent">
              Choose Your Plan
            </span>
          </h1>
          <p className="text-base sm:text-lg text-gray-600 mb-4 sm:mb-6 px-4 sm:px-0">
            Select a subscription plan to continue with your Emily setup
          </p>
          
          {/* Billing Cycle Toggle */}
          <div className="flex items-center justify-center space-x-3 sm:space-x-4 mb-4 sm:mb-6">
            <span className={`text-sm font-medium ${billingCycle === 'monthly' ? 'text-[#9E005C]' : 'text-gray-500'}`}>
              Monthly
            </span>
            <button
              onClick={() => setBillingCycle(billingCycle === 'monthly' ? 'yearly' : 'monthly')}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                billingCycle === 'yearly' ? 'bg-[#9E005C]' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  billingCycle === 'yearly' ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
            <span className={`text-sm font-medium ${billingCycle === 'yearly' ? 'text-[#9E005C]' : 'text-gray-500'}`}>
              Yearly
            </span>
            {billingCycle === 'yearly' && (
              <span className="bg-green-100 text-green-800 text-xs font-medium px-2 py-1 rounded-full">
                Save 17%
              </span>
            )}
          </div>
        </div>

        {/* Trial Information Card */}
        {trialInfo && trialInfo.trial_active && (
          <div className="mb-6 sm:mb-8">
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-xl p-4 sm:p-6 max-w-2xl mx-auto">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-4 sm:space-y-0">
                <div className="flex items-center space-x-3 sm:space-x-4">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
                    <Gift className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900">🎉 Free Trial Active!</h3>
                    <p className="text-xs sm:text-sm text-gray-600">
                      <span className="font-semibold text-blue-600">Full access for 3 days</span> - You have <span className="font-semibold text-blue-600">{trialInfo.days_remaining}</span> days remaining
                    </p>
                    {trialInfo.trial_expires_at && (
                      <p className="text-xs text-gray-500 mt-1">
                        Expires on {new Date(trialInfo.trial_expires_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-2 text-blue-600">
                  <Clock className="w-4 h-4" />
                  <span className="text-xs sm:text-sm font-medium">Trial Period</span>
                </div>
              </div>
              
              <div className="mt-4 pt-4 border-t border-blue-200">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-3 sm:space-y-0">
                  <p className="text-xs sm:text-sm text-gray-600">
                    Enjoy full access to all Emily features during your trial
                  </p>
                  <button
                    onClick={() => window.location.href = '/onboarding'}
                    className="w-full sm:w-auto px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white text-xs sm:text-sm font-medium rounded-lg hover:from-blue-600 hover:to-purple-700 transition-all duration-300"
                  >
                    Continue to Onboarding
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Trial Expired Message */}
        {trialInfo && !trialInfo.trial_active && trialInfo.subscription_status === 'expired' && (
          <div className="mb-6 sm:mb-8">
            <div className="bg-gradient-to-r from-orange-50 to-red-50 border border-orange-200 rounded-xl p-4 sm:p-6 max-w-2xl mx-auto">
              <div className="flex items-center space-x-3 sm:space-x-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-r from-orange-500 to-red-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900">⏰ Trial Expired</h3>
                  <p className="text-xs sm:text-sm text-gray-600">
                    Your free trial has ended. Choose a plan to continue using Emily.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Plans Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 max-w-6xl mx-auto">
          {plans
            .sort((a, b) => {
              // Define the order: trial, basic, pro
              const order = { 'free_trial': 0, 'starter': 1, 'basic': 1, 'pro': 2 };
              const aOrder = order[a.name] ?? 999;
              const bOrder = order[b.name] ?? 999;
              return aOrder - bOrder;
            })
            .map((plan) => {
            const price = billingCycle === 'monthly' ? plan.price_monthly : plan.price_yearly;
            const priceDisplay = billingCycle === 'monthly' 
              ? `₹${(price / 100).toFixed(0)}`
              : `₹${(price / 100).toFixed(0)}`;
            const isPro = plan.name === 'pro';
            
            return (
              <div
                key={plan.id}
                className={`relative bg-white rounded-xl p-4 sm:p-6 border transition-all duration-300 ${
                  isPro 
                    ? 'border-[#FF4D94] shadow-lg hover:shadow-xl' 
                    : 'border-gray-200 hover:border-[#9E005C] hover:shadow-lg'
                }`}
              >
                {isPro && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <div className="bg-gradient-to-r from-[#FF4D94] to-[#9E005C] text-white px-3 py-1 rounded-full text-xs font-medium">
                      Most Popular
                    </div>
                  </div>
                )}
                
                <div className="text-center mb-4 sm:mb-6">
                  <h3 className="text-lg sm:text-xl font-bold mb-2 text-gray-900">{plan.display_name}</h3>
                  <div className="text-2xl sm:text-3xl font-bold mb-1">
                    <span className={`${isPro ? 'text-[#FF4D94]' : 'text-[#9E005C]'}`}>
                      {priceDisplay}
                    </span>
                    <span className="text-gray-500 text-sm sm:text-base">/{billingCycle === 'monthly' ? 'month' : 'year'}</span>
                  </div>
                </div>
                
                <div className="space-y-2 sm:space-y-3 mb-4 sm:mb-6">
                  {(() => {
                    // Handle different feature structures
                    let featuresArray = [];
                    
                    if (Array.isArray(plan.features)) {
                      featuresArray = plan.features;
                    } else if (typeof plan.features === 'object' && plan.features !== null) {
                      if (plan.features.features && Array.isArray(plan.features.features)) {
                        featuresArray = plan.features.features;
                      } else if (plan.features.trial !== undefined) {
                        // Handle nested object structure
                        featuresArray = plan.features.features || [];
                      }
                    } else if (typeof plan.features === 'string') {
                      featuresArray = [plan.features];
                    }
                    
                    // Ensure we have a valid array
                    if (!Array.isArray(featuresArray)) {
                      featuresArray = [];
                    }
                    
                    return (
                      <>
                        {featuresArray.slice(0, 4).map((feature, index) => (
                          <div key={index} className="flex items-center space-x-2">
                            <Check className={`w-3 h-3 sm:w-4 sm:h-4 ${isPro ? 'text-[#FF4D94]' : 'text-[#9E005C]'}`} />
                            <span className="text-xs sm:text-sm text-gray-700">{feature}</span>
                          </div>
                        ))}
                        {featuresArray.length > 4 && (
                          <div className="text-xs text-gray-500 text-center">
                            +{featuresArray.length - 4} more features
                          </div>
                        )}
                        {featuresArray.length === 0 && (
                          <div className="text-sm text-gray-700">
                            Features included in this plan
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
                
                <button
                  onClick={() => handleSubscribe(plan.name)}
                  disabled={loadingPlan === plan.name}
                  className={`w-full py-2 sm:py-2.5 rounded-lg font-medium transition-all duration-300 flex items-center justify-center text-xs sm:text-sm ${
                    isPro
                      ? 'bg-gradient-to-r from-[#FF4D94] to-[#9E005C] text-white hover:from-[#9E005C] hover:to-[#FF4D94]'
                      : 'bg-gradient-to-r from-[#9E005C] to-[#FF4D94] text-white hover:from-[#FF4D94] hover:to-[#9E005C]'
                  } ${loadingPlan === plan.name ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'}`}
                >
                  {loadingPlan === plan.name ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Processing...
                    </>
                  ) : (
                    <>
                      Choose {plan.display_name}
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="text-center mt-6 sm:mt-8">
          <p className="text-gray-500 text-xs sm:text-sm mb-2 px-4 sm:px-0">
            All plans include access to Emily's AI agents. Cancel anytime.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center space-y-1 sm:space-y-0 sm:space-x-4 text-xs text-gray-500">
            <span>✓ Secure payment</span>
            <span className="hidden sm:inline">•</span>
            <span>✓ 30-day money back</span>
            <span className="hidden sm:inline">•</span>
            <span>✓ Cancel anytime</span>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionSelector;
