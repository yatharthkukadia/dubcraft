import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Waveform, Globe, Sparkle, ArrowRight, Play, Check } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';

const LandingPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleGetStarted = () => {
    if (user) {
      navigate('/dashboard');
    } else {
      navigate('/auth');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-black/60 backdrop-blur-2xl border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Waveform size={32} weight="duotone" className="text-primary" />
            <span className="text-xl font-heading font-bold tracking-tight">DubAI</span>
          </div>
          <div className="flex gap-4">
            {user ? (
              <Button data-testid="dashboard-btn" onClick={() => navigate('/dashboard')} className="bg-primary hover:bg-primary/90">
                Dashboard
              </Button>
            ) : (
              <>
                <Button data-testid="login-btn" variant="ghost" onClick={() => navigate('/auth')}>
                  Login
                </Button>
                <Button data-testid="get-started-header-btn" onClick={handleGetStarted} className="bg-primary hover:bg-primary/90">
                  Get Started
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-6 overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-10"
          style={{
            backgroundImage: 'url(https://images.pexels.com/photos/36668719/pexels-photo-36668719.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940)',
          }}
        />
        <div className="absolute inset-0 bg-black/50" />
        <div className="relative max-w-6xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-heading font-bold tracking-tight mb-6">
              Dub Your Videos in{' '}
              <span className="text-primary">Multiple Languages</span>{' '}
              with <span className="text-primary">Natural-Sounding Voices</span>
            </h1>
            <p className="text-lg sm:text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
              Transform your videos with AI-powered dubbing. Fast transcription, translation,
              and clear synthetic voices—all in one platform.
            </p>
            <div className="flex gap-4 justify-center">
              <Button
                data-testid="get-started-hero-btn"
                size="lg"
                onClick={handleGetStarted}
                className="bg-primary hover:bg-primary/90 text-white px-8 py-6 text-lg"
              >
                Get Started Free <ArrowRight className="ml-2" size={20} />
              </Button>
              <Button
                data-testid="watch-demo-btn"
                size="lg"
                variant="outline"
                className="border-primary text-primary hover:bg-primary/10 px-8 py-6 text-lg"
              >
                <Play className="mr-2" size={20} /> Watch Demo
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-xs uppercase tracking-[0.2em] text-primary mb-4">FEATURES</p>
            <h2 className="text-3xl sm:text-4xl font-heading font-bold tracking-tight">Everything You Need</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="bg-card border border-border p-8 rounded-lg hover:shadow-lg transition-shadow"
              data-testid="feature-ai-voice"
            >
              <Waveform size={48} weight="duotone" className="text-primary mb-4" />
              <h3 className="text-xl font-heading font-bold mb-3">Basic Voice Style</h3>
              <p className="text-muted-foreground">
                Set a simple voice style like gender and speaking speed using short prompts.
                Great for quick dubbing.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="bg-card border border-border p-8 rounded-lg hover:shadow-lg transition-shadow"
              data-testid="feature-translation"
            >
              <Globe size={48} weight="duotone" className="text-primary mb-4" />
              <h3 className="text-xl font-heading font-bold mb-3">Multi-Language Translation</h3>
              <p className="text-muted-foreground">
                Translate and dub your videos into supported Indian languages with reliable AI translation.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="bg-card border border-border p-8 rounded-lg hover:shadow-lg transition-shadow"
              data-testid="feature-quality"
            >
              <Sparkle size={48} weight="duotone" className="text-primary mb-4" />
              <h3 className="text-xl font-heading font-bold mb-3">Clean Output</h3>
              <p className="text-muted-foreground">
                Get clear dubbed audio with downloadable subtitles, ready for sharing.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-6 bg-muted">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-xs uppercase tracking-[0.2em] text-primary mb-4">HOW IT WORKS</p>
            <h2 className="text-3xl sm:text-4xl font-heading font-bold tracking-tight">Simple 4-Step Process</h2>
          </div>

          <div className="space-y-8">
            {[
              { num: '01', title: 'Upload', desc: 'Upload your video file to get started' },
              { num: '02', title: 'Customize Voice', desc: 'Describe the voice style (gender + speed)' },
              { num: '03', title: 'Edit Text', desc: 'Review and edit transcription and translation' },
              { num: '04', title: 'Generate', desc: 'Download your dubbed video in minutes' },
            ].map((step, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="flex gap-6 items-start"
                data-testid={`step-${step.num}`}
              >
                <div className="text-5xl font-black text-border opacity-50">{step.num}</div>
                <div>
                  <h3 className="text-2xl font-heading font-bold mb-2">{step.title}</h3>
                  <p className="text-muted-foreground">{step.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-xs uppercase tracking-[0.2em] text-primary mb-4">PRICING</p>
            <h2 className="text-3xl sm:text-4xl font-heading font-bold tracking-tight">Choose Your Plan</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {[
              { name: 'Starter', price: '$10', credits: '100 Credits', features: ['100 dubbing credits', 'All supported languages', 'Web dashboard access'] },
              { name: 'Pro', price: '$25', credits: '300 Credits', features: ['300 dubbing credits', 'All supported languages', 'Web dashboard access'] },
              { name: 'Premium', price: '$50', credits: '700 Credits', features: ['700 dubbing credits', 'All supported languages', 'Web dashboard access'] },
            ].map((plan, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className={`bg-card border p-8 rounded-lg ${i === 1 ? 'border-primary shadow-lg' : 'border-border'}`}
                data-testid={`pricing-${plan.name.toLowerCase()}`}
              >
                {i === 1 && (
                  <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">POPULAR</div>
                )}
                <h3 className="text-2xl font-heading font-bold mb-2">{plan.name}</h3>
                <div className="text-4xl font-bold mb-1">{plan.price}</div>
                <p className="text-muted-foreground mb-6">{plan.credits}</p>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, j) => (
                    <li key={j} className="flex items-center gap-2">
                      <Check size={16} className="text-primary" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  data-testid={`buy-${plan.name.toLowerCase()}-btn`}
                  className="w-full bg-primary hover:bg-primary/90"
                  onClick={handleGetStarted}
                >
                  Get Started
                </Button>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-border">
        <div className="max-w-7xl mx-auto text-center text-muted-foreground">
          <p>&copy; 2026 DubAI. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;















