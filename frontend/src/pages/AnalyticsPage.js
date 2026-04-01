import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Waveform, SignOut, TrendUp, Video, CheckCircle, XCircle, Clock } from '@phosphor-icons/react';
import { toast } from 'sonner';
import axios from 'axios';

const AnalyticsPage = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${BACKEND_URL}/api/analytics`, {
        withCredentials: true,
      });
      setAnalytics(response.data);
    } catch (error) {
      toast.error('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const overview = analytics?.overview || {};
  const byLanguage = analytics?.by_language || {};
  const recentActivity = analytics?.recent_activity || {};

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/dashboard')}>
              <Waveform size={32} weight="duotone" className="text-primary" />
              <span className="text-xl font-heading font-bold tracking-tight">DubAI</span>
            </div>
            <nav className="flex gap-4">
              <Button variant="ghost" onClick={() => navigate('/dashboard')}>
                Dashboard
              </Button>
              <Button variant="ghost" onClick={() => navigate('/projects')}>
                Projects
              </Button>
              <Button variant="default" className="bg-primary">
                Analytics
              </Button>
            </nav>
          </div>
          <Button data-testid="logout-btn" variant="ghost" onClick={handleLogout}>
            <SignOut size={20} />
          </Button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="mb-8">
          <h1 className="text-4xl font-heading font-bold tracking-tight mb-2">Usage Analytics</h1>
          <p className="text-muted-foreground">Track your dubbing activity and credit usage</p>
        </div>

        {/* Overview Cards */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <div className="bg-card border border-border rounded-lg p-6" data-testid="total-projects-card">
            <div className="flex items-center justify-between mb-3">
              <Video size={24} className="text-primary" weight="duotone" />
              <TrendUp size={20} className="text-green-500" />
            </div>
            <div className="text-3xl font-bold mb-1">{overview.total_projects || 0}</div>
            <div className="text-sm text-muted-foreground">Total Projects</div>
          </div>

          <div className="bg-card border border-border rounded-lg p-6" data-testid="completed-card">
            <div className="flex items-center justify-between mb-3">
              <CheckCircle size={24} className="text-green-500" weight="duotone" />
            </div>
            <div className="text-3xl font-bold mb-1">{overview.completed || 0}</div>
            <div className="text-sm text-muted-foreground">Completed</div>
          </div>

          <div className="bg-card border border-border rounded-lg p-6" data-testid="processing-card">
            <div className="flex items-center justify-between mb-3">
              <Clock size={24} className="text-yellow-500" weight="duotone" />
            </div>
            <div className="text-3xl font-bold mb-1">{overview.processing || 0}</div>
            <div className="text-sm text-muted-foreground">Processing</div>
          </div>

          <div className="bg-card border border-border rounded-lg p-6" data-testid="failed-card">
            <div className="flex items-center justify-between mb-3">
              <XCircle size={24} className="text-red-500" weight="duotone" />
            </div>
            <div className="text-3xl font-bold mb-1">{overview.failed || 0}</div>
            <div className="text-sm text-muted-foreground">Failed</div>
          </div>
        </div>

        {/* Credits & Usage */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div className="bg-card border border-border rounded-lg p-6">
            <h3 className="text-xl font-heading font-bold mb-4">Credit Usage</h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-muted-foreground">Credits Used</span>
                  <span className="font-bold text-primary">{overview.credits_used || 0}</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary"
                    style={{ width: `${Math.min((overview.credits_used / 1000) * 100, 100)}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-muted-foreground">Credits Remaining</span>
                  <span className="font-bold text-green-500">{overview.credits_remaining || 0}</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500"
                    style={{ width: `${Math.min((overview.credits_remaining / 1000) * 100, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg p-6">
            <h3 className="text-xl font-heading font-bold mb-4">Recent Activity</h3>
            <div className="space-y-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Projects (Last 30 Days)</span>
                <span className="font-bold">{recentActivity.projects_last_30_days || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Credits Used (Last 30 Days)</span>
                <span className="font-bold text-primary">{recentActivity.credits_last_30_days || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Success Rate</span>
                <span className="font-bold text-green-500">
                  {overview.total_projects > 0
                    ? Math.round((overview.completed / overview.total_projects) * 100)
                    : 0}
                  %
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Language Breakdown */}
        <div className="bg-card border border-border rounded-lg p-6">
          <h3 className="text-xl font-heading font-bold mb-6">Projects by Language</h3>
          <div className="grid md:grid-cols-5 gap-4">
            {Object.entries(byLanguage).map(([lang, count]) => (
              <div
                key={lang}
                className="bg-muted rounded-lg p-4 text-center"
                data-testid={`lang-${lang}`}
              >
                <div className="text-2xl font-bold text-primary mb-1">{count}</div>
                <div className="text-sm text-muted-foreground capitalize">{lang}</div>
              </div>
            ))}
          </div>
          {Object.keys(byLanguage).length === 0 && (
            <p className="text-center text-muted-foreground py-8">No projects yet</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default AnalyticsPage;
