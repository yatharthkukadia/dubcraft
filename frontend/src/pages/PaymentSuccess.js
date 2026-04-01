import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle } from '@phosphor-icons/react';
import axios from 'axios';

const PaymentSuccess = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const [status, setStatus] = useState('checking');
  const [attempts, setAttempts] = useState(0);
  const sessionId = searchParams.get('session_id');

  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

  useEffect(() => {
    if (sessionId) {
      checkPaymentStatus();
    }
  }, [sessionId]);

  const checkPaymentStatus = async () => {
    if (attempts >= 5) {
      setStatus('timeout');
      return;
    }

    try {
      const response = await axios.get(`${BACKEND_URL}/api/payments/status/${sessionId}`, {
        withCredentials: true,
      });

      if (response.data.payment_status === 'paid') {
        setStatus('success');
        await refreshUser();
      } else if (response.data.status === 'expired') {
        setStatus('expired');
      } else {
        setAttempts(attempts + 1);
        setTimeout(checkPaymentStatus, 2000);
      }
    } catch (error) {
      setStatus('error');
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center">
        {status === 'checking' && (
          <div data-testid="payment-checking">
            <div className="animate-spin h-16 w-16 border-4 border-primary border-t-transparent rounded-full mx-auto mb-6" />
            <h1 className="text-2xl font-heading font-bold mb-2">Checking Payment Status...</h1>
            <p className="text-muted-foreground">Please wait while we verify your payment</p>
          </div>
        )}

        {status === 'success' && (
          <div data-testid="payment-success">
            <CheckCircle size={64} className="text-green-500 mx-auto mb-6" weight="duotone" />
            <h1 className="text-3xl font-heading font-bold mb-2">Payment Successful!</h1>
            <p className="text-muted-foreground mb-8">Your credits have been added to your account</p>
            <Button
              data-testid="go-to-dashboard-btn"
              onClick={() => navigate('/dashboard')}
              className="bg-primary hover:bg-primary/90"
            >
              Go to Dashboard
            </Button>
          </div>
        )}

        {(status === 'error' || status === 'expired' || status === 'timeout') && (
          <div data-testid="payment-error">
            <XCircle size={64} className="text-red-500 mx-auto mb-6" weight="duotone" />
            <h1 className="text-3xl font-heading font-bold mb-2">Payment Failed</h1>
            <p className="text-muted-foreground mb-8">
              {status === 'timeout'
                ? 'Payment verification timed out. Please check your account or contact support.'
                : 'There was an issue processing your payment. Please try again.'}
            </p>
            <Button
              data-testid="back-to-dashboard-btn"
              onClick={() => navigate('/dashboard')}
              className="bg-primary hover:bg-primary/90"
            >
              Back to Dashboard
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PaymentSuccess;
