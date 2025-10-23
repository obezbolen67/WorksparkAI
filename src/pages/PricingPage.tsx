// src/pages/PricingPage.tsx
import { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { useSettings } from '../contexts/SettingsContext';
import { useNotification } from '../contexts/NotificationContext';
import '../css/PricingPage.css';
import { FiCheckCircle } from 'react-icons/fi';
import api from '../utils/api';
const stripePromise = loadStripe("pk_test_51S97ATJHhdy0TngLOIvBqbtccieQ0FlzHHkxvyH58mot9dvhDj2LzuQ77L0wFBxGrsg7HLqm1JubQaisylnVXF8200H5kii7k3");

const PricingPage = () => {
  const { user } = useSettings();
  const { showNotification } = useNotification();
  const [isLoading, setIsLoading] = useState(false);

  const plans = [
    {
      name: 'Free',
      price: '$0',
      features: [
        'Standard default model',
        'Code Interpreter & File Analysis',
        'Web Search capabilities',
        'Bring your own API keys',
        'Community support',
      ],
      isCurrent: !user?.subscriptionStatus || user.subscriptionStatus !== 'active',
    },
    {
      name: 'Pro',
      price: '$20',
      priceId: 'price_1S98QdJHhdy0TngLXWUWBrzD',
      features: [
        'Premium default model (GPT-5)',
        'Code Interpreter & File Analysis',
        'Web Search capabilities',
        'Bring your own API keys',
        'Priority support',
      ],
      isCurrent: user?.subscriptionStatus === 'active',
    },
  ];

  const handleSubscribe = async (priceId: string) => {
    if (!priceId) return;
    setIsLoading(true);
    try {
      const response = await api('/stripe/create-checkout-session', {
        method: 'POST',
        body: JSON.stringify({ priceId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.msg || 'Could not start subscription.');

      const stripe = await stripePromise;
      if (stripe) {
        await stripe.redirectToCheckout({ sessionId: data.sessionId });
      }
    } catch (error) {
      showNotification(error instanceof Error ? error.message : 'An unknown error occurred.', 'error');
      setIsLoading(false);
    }
  };

  return (
    <div className="pricing-page-container">
      <div className="pricing-header">
        <h1>Choose Your Plan</h1>
        <p>Unlock powerful features and accelerate your workflow with Workspark AI Pro.</p>
      </div>
      <div className="pricing-grid">
        {plans.map((plan) => (
          <div key={plan.name} className={`pricing-card ${plan.name === 'Pro' ? 'pro' : ''} ${plan.isCurrent ? 'current' : ''}`}>
            <h3>{plan.name}</h3>
            <div className="price">
              {plan.price}<span>{plan.name === 'Pro' ? '/ month' : ''}</span>
            </div>
            <ul className="features-list">
              {plan.features.map((feature, i) => (
                <li key={i}><FiCheckCircle /> {feature}</li>
              ))}
            </ul>
            <button
              className="subscribe-button"
              disabled={isLoading || plan.isCurrent || !plan.priceId}
              onClick={() => plan.priceId && handleSubscribe(plan.priceId)}
            >
              {plan.isCurrent ? 'Current Plan' : (plan.priceId ? 'Upgrade to Pro' : 'Your Plan')}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PricingPage;