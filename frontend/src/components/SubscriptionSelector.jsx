import React, { useState, useEffect } from 'react';
import { Check, ArrowRight, Loader2 } from 'lucide-react';
import { subscriptionAPI } from '../services/subscription';

const SubscriptionSelector = () => {
  const [plans, setPlans] = useState([]);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [billingCycle, setBillingCycle] = useState('monthly');
  const [loading, setLoading] = useState(false);
  const [loadingPlans, setLoadingPlans] = useState(true);

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const response = await subscriptionAPI.getPlans();
        setPlans(response.data.plans);
        setLoadingPlans(false);
      } catch (error) {
        console.error('Error fetching subscription plans:', error);
        setLoadingPlans(false);
      }
    };

    fetchPlans();
  }, []);

  const handleSubscribe = async (planName) => {
    setLoading(true);
    try {
      const response = await subscriptionAPI.createSubscription({
        plan_name: planName,
        billing_cycle: billingCycle
      });
      
      if (response.data.success && response.data.payment_url) {
        // Redirect to Razorpay payment page
        window.location.href = response.data.payment_url;
      } else {
        console.error('Failed to create subscription');
        alert('Failed to create subscription. Please try again.');
      }
    } catch (error) {
      console.error('Error creating subscription:', error);
      alert('Error creating subscription. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (loadingPlans) {
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
    <div className="min-h-screen bg-[#F6F6F6] py-12">
      <div className="max-w-6xl mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-6">
            <span className="bg-gradient-to-r from-[#9E005C] to-[#FF4D94] bg-clip-text text-transparent">
              Choose Your Plan
            </span>
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Select a subscription plan to continue with your Emily setup
          </p>
          
          {/* Billing Cycle Toggle */}
          <div className="flex items-center justify-center space-x-4 mb-8">
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

        {/* Plans Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {plans.map((plan) => {
            const price = billingCycle === 'monthly' ? plan.price_monthly : plan.price_yearly;
            const priceDisplay = billingCycle === 'monthly' ? plan.monthly_price_display : plan.yearly_price_display;
            const isPro = plan.name === 'pro';
            
            return (
              <div
                key={plan.id}
                className={`relative bg-white rounded-2xl p-8 border transition-all duration-300 ${
                  isPro 
                    ? 'border-[#FF4D94] shadow-lg hover:shadow-xl' 
                    : 'border-gray-200 hover:border-[#9E005C] hover:shadow-lg'
                }`}
              >
                {isPro && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <div className="bg-gradient-to-r from-[#FF4D94] to-[#9E005C] text-white px-4 py-1 rounded-full text-sm font-medium">
                      Most Popular
                    </div>
                  </div>
                )}
                
                <div className="text-center mb-8">
                  <h3 className="text-2xl font-bold mb-2 text-gray-900">{plan.display_name}</h3>
                  <div className="text-4xl font-bold mb-2">
                    <span className={`${isPro ? 'text-[#FF4D94]' : 'text-[#9E005C]'}`}>
                      {priceDisplay}
                    </span>
                    <span className="text-gray-500 text-lg">/{billingCycle === 'monthly' ? 'month' : 'year'}</span>
                  </div>
                  <p className="text-gray-600">
                    {plan.name === 'starter' 
                      ? 'Perfect for individuals and small teams' 
                      : 'For growing businesses and teams'
                    }
                  </p>
                </div>
                
                <div className="space-y-4 mb-8">
                  {plan.features.map((feature, index) => (
                    <div key={index} className="flex items-center space-x-3">
                      <Check className={`w-5 h-5 ${isPro ? 'text-[#FF4D94]' : 'text-[#9E005C]'}`} />
                      <span className="text-gray-700">{feature}</span>
                    </div>
                  ))}
                </div>
                
                <button
                  onClick={() => handleSubscribe(plan.name)}
                  disabled={loading}
                  className={`w-full py-3 rounded-xl font-medium transition-all duration-300 flex items-center justify-center ${
                    isPro
                      ? 'bg-gradient-to-r from-[#FF4D94] to-[#9E005C] text-white hover:from-[#9E005C] hover:to-[#FF4D94]'
                      : 'bg-gradient-to-r from-[#9E005C] to-[#FF4D94] text-white hover:from-[#FF4D94] hover:to-[#9E005C]'
                  } ${loading ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'}`}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin mr-2" />
                      Processing...
                    </>
                  ) : (
                    <>
                      Choose {plan.display_name}
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="text-center mt-12">
          <p className="text-gray-500 text-sm">
            All plans include access to Emily's AI agents. Cancel anytime.
          </p>
          <div className="flex items-center justify-center space-x-6 mt-4 text-sm text-gray-500">
            <span>✓ Secure payment</span>
            <span>✓ 30-day money back</span>
            <span>✓ Cancel anytime</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionSelector;
