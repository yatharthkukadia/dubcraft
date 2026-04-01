import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Waveform, SignOut, Upload, Coins, Play, Download, Check } from '@phosphor-icons/react';
import { toast } from 'sonner';
import axios from 'axios';
import { useDropzone } from 'react-dropzone';
import useWebSocket, { ReadyState } from 'react-use-websocket';

const INDIAN_LANGUAGES = [
  { value: 'hindi', label: 'Hindi (हिंदी)' },
  { value: 'tamil', label: 'Tamil (தமிழ்)' },
  { value: 'telugu', label: 'Telugu (తెలుగు)' },
  { value: 'malayalam', label: 'Malayalam (മലയാളം)' },
  { value: 'kannada', label: 'Kannada (ಕನ್ನಡ)' },
  { value: 'bengali', label: 'Bengali (বাংলা)' },
  { value: 'marathi', label: 'Marathi (मराठी)' },
  { value: 'gujarati', label: 'Gujarati (ગુજરાતી)' },
  { value: 'punjabi', label: 'Punjabi (ਪੰਜਾਬੀ)' },
  { value: 'urdu', label: 'Urdu (اردو)' },
];

const Dashboard = () => {
  const { user, logout, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [videoFile, setVideoFile] = useState(null);
  const [voiceInstructions, setVoiceInstructions] = useState('');
  const [targetLanguage, setTargetLanguage] = useState('hindi');
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [showBuyCredits, setShowBuyCredits] = useState(false);
  const [currentProject, setCurrentProject] = useState(null);
  const [processingStatus, setProcessingStatus] = useState(null);
  const [progressPercent, setProgressPercent] = useState(0);
  const [transcription, setTranscription] = useState('');
  const [translation, setTranslation] = useState('');
  const [showEditor, setShowEditor] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [completedVideo, setCompletedVideo] = useState(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [showAdvancedControls, setShowAdvancedControls] = useState(false);
  const [voiceControls, setVoiceControls] = useState({
    pitch: 0,
    speed: 1.0,
    gender: 'female',
    tone: 'neutral'
  });

  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
  
  // WebSocket URL
  const wsUrl = currentProject
    ? `${BACKEND_URL.replace('https://', 'wss://').replace('http://', 'ws://')}/ws/projects/${currentProject}`
    : null;

  const { lastMessage, readyState } = useWebSocket(wsUrl, {
    shouldReconnect: () => true,
    reconnectInterval: 3000,
  });

  useEffect(() => {
    if (lastMessage !== null) {
      try {
        const data = JSON.parse(lastMessage.data);
        setProcessingStatus(data.message);
        
        // Update progress based on status
        const statusProgress = {
          extracting_audio: 10,
          audio_extracted: 20,
          transcribing: 30,
          transcribed: 50,
          correcting: 60,
          corrected: 65,
          translating: 70,
          translated: 85,
          review_ready: 90,
          analyzing_voice: 92,
          generating_voice: 94,
          voice_generated: 96,
          merging: 98,
          completed: 100,
        };
        
        setProgressPercent(statusProgress[data.status] || progressPercent);
        
        // Handle review ready
        if (data.status === 'review_ready' && data.data) {
          setTranscription(data.data.transcription || '');
          setTranslation(data.data.translation || '');
          setShowEditor(true);
          setProcessing(false);
        }
        
        // Handle completion
        if (data.status === 'completed') {
          toast.success('Video dubbing complete!');
          setProcessing(false);
          setGenerating(false);
          setShowEditor(false);
          setShowCompleted(true);
          
          // Get the output URL if provided
          if (data.data && data.data.output_url) {
            setCompletedVideo({
              url: data.data.output_url,
              projectId: currentProject
            });
          } else {
            // Fetch project to get output URL
            fetchCompletedProject();
          }
          refreshUser();
        }
        
        // Handle errors
        if (data.status === 'error') {
          toast.error(data.message);
          setProcessing(false);
          setGenerating(false);
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    }
  }, [lastMessage]);

  const onDrop = (acceptedFiles) => {
    if (acceptedFiles.length > 0) {
      setVideoFile(acceptedFiles[0]);
      toast.success(`${acceptedFiles[0].name} selected`);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'video/*': ['.mp4', '.mov', '.avi', '.mkv'] },
    maxFiles: 1,
  });

  const handleSubmit = async () => {
    if (!videoFile) {
      toast.error('Please upload a video file');
      return;
    }
    if (!voiceInstructions.trim()) {
      toast.error('Please describe your desired voice style');
      return;
    }

    const totalCredits = (user?.credits || 0) + (user?.trial_credits || 0);
    if (totalCredits < 10) {
      toast.error('Insufficient credits. Please purchase more credits.');
      setShowBuyCredits(true);
      return;
    }

    setUploading(true);
    setProgressPercent(0);

    try {
      // Upload video
      const formData = new FormData();
      formData.append('file', videoFile);

      const uploadResponse = await axios.post(`${BACKEND_URL}/api/upload-video`, formData, {
        withCredentials: true,
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const videoUrl = uploadResponse.data.url;

      // Create project
      const projectResponse = await axios.post(
        `${BACKEND_URL}/api/projects`,
        {
          video_url: videoUrl,
          voice_instructions: voiceInstructions,
          target_language: targetLanguage,
        },
        { withCredentials: true }
      );

      const projectId = projectResponse.data.id;
      setCurrentProject(projectId);
      setUploading(false);
      setProcessing(true);
      setProcessingStatus('Starting processing...');

      // Start processing
      await axios.post(
        `${BACKEND_URL}/api/projects/${projectId}/start`,
        {},
        { withCredentials: true }
      );

      toast.success('Processing started!');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to start processing');
      setUploading(false);
      setProcessing(false);
    }
  };

  const handleConfirmEdits = async () => {
    if (!currentProject) return;
    
    setGenerating(true);
    setShowEditor(false);
    setProcessingStatus('Generating final video...');
    
    try {
      await axios.post(
        `${BACKEND_URL}/api/projects/${currentProject}/generate`,
        {
          transcription,
          translation,
        },
        { withCredentials: true }
      );
      
      toast.success('Generating final video...');
    } catch (error) {
      toast.error('Failed to generate video');
      setGenerating(false);
    }
  };

  const handleReset = () => {
    setVideoFile(null);
    setVoiceInstructions('');
    setCurrentProject(null);
    setProcessing(false);
    setProcessingStatus(null);
    setProgressPercent(0);
    setShowEditor(false);
    setTranscription('');
    setTranslation('');
    setGenerating(false);
    setShowCompleted(false);
    setCompletedVideo(null);
  };

  const fetchCompletedProject = async () => {
    if (!currentProject) return;
    
    try {
      const response = await axios.get(`${BACKEND_URL}/api/projects/${currentProject}`, {
        withCredentials: true,
      });
      
      if (response.data.output_url) {
        setCompletedVideo({
          url: response.data.output_url,
          projectId: currentProject,
          details: response.data
        });
      }
    } catch (error) {
      console.error('Error fetching project:', error);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const handleBuyCredits = async (packageId) => {
    try {
      const originUrl = window.location.origin;
      const response = await axios.post(
        `${BACKEND_URL}/api/payments/checkout`,
        { origin_url: originUrl },
        {
          withCredentials: true,
          params: { package_id: packageId },
        }
      );

      window.location.href = response.data.url;
    } catch (error) {
      toast.error('Failed to initiate payment');
    }
  };

  const totalCredits = (user?.credits || 0) + (user?.trial_credits || 0);

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
              <Button variant="default" className="bg-primary">
                Dashboard
              </Button>
              <Button variant="ghost" onClick={() => navigate('/projects')}>
                Projects
              </Button>
              <Button variant="ghost" onClick={() => navigate('/analytics')}>
                Analytics
              </Button>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <div
              className="flex items-center gap-2 px-4 py-2 bg-muted rounded-lg"
              data-testid="credits-display"
            >
              <Coins size={20} className="text-primary" />
              <span className="font-semibold">{totalCredits} credits</span>
              {user?.trial_credits > 0 && (
                <span className="text-xs text-muted-foreground">({user.trial_credits} trial)</span>
              )}
            </div>
            <Button
              data-testid="buy-credits-btn"
              variant="outline"
              onClick={() => setShowBuyCredits(!showBuyCredits)}
              className="border-primary text-primary hover:bg-primary/10"
            >
              <Coins className="mr-2" size={16} /> Buy Credits
            </Button>
            <Button data-testid="logout-btn" variant="ghost" onClick={handleLogout}>
              <SignOut size={20} />
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Buy Credits Section */}
        {showBuyCredits && (
          <div className="mb-8 bg-card border border-border rounded-lg p-8">
            <h2 className="text-2xl font-heading font-bold mb-6">Buy Credits</h2>
            <div className="grid md:grid-cols-3 gap-6">
              {[
                { id: 'starter', name: 'Starter', price: '$10', credits: '100' },
                { id: 'pro', name: 'Pro', price: '$25', credits: '300' },
                { id: 'premium', name: 'Premium', price: '$50', credits: '700' },
              ].map((pkg) => (
                <div
                  key={pkg.id}
                  className="bg-muted border border-border rounded-lg p-6"
                  data-testid={`package-${pkg.id}`}
                >
                  <h3 className="text-xl font-heading font-bold mb-2">{pkg.name}</h3>
                  <div className="text-3xl font-bold text-primary mb-1">{pkg.price}</div>
                  <p className="text-muted-foreground mb-4">{pkg.credits} Credits</p>
                  <Button
                    data-testid={`buy-${pkg.id}-btn`}
                    onClick={() => handleBuyCredits(pkg.id)}
                    className="w-full bg-primary hover:bg-primary/90"
                  >
                    Purchase
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Main Interface */}
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          {!processing && !showEditor && !generating && !showCompleted ? (
            /* Upload & Settings */
            <div className="p-8">
              <h1 className="text-3xl font-heading font-bold tracking-tight mb-2">Create New Dub</h1>
              <p className="text-muted-foreground mb-8">
                Upload your video and describe the voice style (gender + speed)
              </p>

              {/* Upload Area */}
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-lg p-12 mb-6 text-center cursor-pointer transition-colors ${
                  isDragActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                }`}
                data-testid="video-upload-zone"
              >
                <input {...getInputProps()} data-testid="video-file-input" />
                <Upload size={48} className="mx-auto mb-4 text-muted-foreground" />
                <p className="text-lg mb-2">
                  {videoFile ? (
                    <span className="text-primary font-semibold">{videoFile.name}</span>
                  ) : isDragActive ? (
                    'Drop video here...'
                  ) : (
                    'Drag and drop a video, or click to browse'
                  )}
                </p>
                <p className="text-sm text-muted-foreground">Supports MP4, MOV, AVI, MKV</p>
              </div>

              {/* Language Selection */}
              <div className="mb-6">
                <label className="block text-sm font-semibold mb-2">Target Language</label>
                <Select value={targetLanguage} onValueChange={setTargetLanguage}>
                  <SelectTrigger data-testid="language-select">
                    <SelectValue placeholder="Select language" />
                  </SelectTrigger>
                  <SelectContent>
                    {INDIAN_LANGUAGES.map((lang) => (
                      <SelectItem key={lang.value} value={lang.value}>
                        {lang.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Voice Instructions */}
              <div className="mb-6">
                <label className="block text-sm font-semibold mb-2">Voice Instructions</label>
                <Textarea
                  data-testid="voice-instructions-input"
                  placeholder="Example: Female voice, slow speaking rate."
                  value={voiceInstructions}
                  onChange={(e) => setVoiceInstructions(e.target.value)}
                  rows={4}
                  className="w-full font-body"
                />
              </div>

              <Button
                data-testid="generate-dub-btn"
                onClick={handleSubmit}
                disabled={uploading}
                className="w-full bg-primary hover:bg-primary/90 text-white py-6 text-lg"
              >
                {uploading ? 'Uploading...' : 'Start Dubbing'}
              </Button>

              {totalCredits < 50 && (
                <p className="text-center text-sm text-muted-foreground mt-4">
                  {totalCredits < 10
                    ? 'Low on credits! Purchase more to continue.'
                    : `You have ${totalCredits} credits remaining`}
                </p>
              )}
            </div>
          ) : showEditor ? (
            /* Dual Editor */
            <div className="p-8">
              <h2 className="text-2xl font-heading font-bold mb-2">Review & Edit</h2>
              <p className="text-muted-foreground mb-6">Edit the transcription and translation before generating the final video</p>
              
              <div className="grid md:grid-cols-2 gap-6 mb-6">
                <div>
                  <label className="block text-sm font-semibold mb-2">Original Transcription</label>
                  <Textarea
                    data-testid="transcription-editor"
                    value={transcription}
                    onChange={(e) => setTranscription(e.target.value)}
                    rows={12}
                    className="w-full font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2">Translated Text ({targetLanguage})</label>
                  <Textarea
                    data-testid="translation-editor"
                    value={translation}
                    onChange={(e) => setTranslation(e.target.value)}
                    rows={12}
                    className="w-full font-mono text-sm"
                  />
                </div>
              </div>
              
              <div className="flex gap-4">
                <Button
                  data-testid="confirm-edits-btn"
                  onClick={handleConfirmEdits}
                  className="flex-1 bg-primary hover:bg-primary/90 text-white py-6 text-lg"
                >
                  <Check className="mr-2" size={20} /> Confirm & Generate
                </Button>
                <Button
                  variant="outline"
                  onClick={handleReset}
                  className="px-8 py-6"
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : showCompleted && completedVideo ? (
            /* Completed Video Preview */
            <div className="p-8">
              <div className="max-w-4xl mx-auto">
                <div className="text-center mb-6">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-green-500/10 rounded-full mb-4">
                    <Check size={32} className="text-green-500" />
                  </div>
                  <h2 className="text-3xl font-heading font-bold tracking-tight mb-2">
                    Your Dubbed Video is Ready!
                  </h2>
                  <p className="text-muted-foreground">
                    Preview your video below and download when ready
                  </p>
                </div>

                {/* Video Player */}
                <div className="mb-6 bg-black rounded-lg overflow-hidden">
                  <video
                    data-testid="completed-video-player"
                    controls
                    className="w-full"
                    src={`${BACKEND_URL}${completedVideo.url}`}
                  >
                    Your browser does not support the video tag.
                  </video>
                </div>

                {/* Video Details */}
                {completedVideo.details && (
                  <div className="grid md:grid-cols-3 gap-4 mb-6 p-4 bg-muted rounded-lg">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Target Language</p>
                      <p className="font-semibold capitalize">{completedVideo.details.target_language}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Status</p>
                      <p className="font-semibold text-green-500">Completed</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Created</p>
                      <p className="font-semibold">
                        {new Date(completedVideo.details.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-4">
                  <a
                    href={`${BACKEND_URL}${completedVideo.url}`}
                    download
                    data-testid="download-video-btn"
                    className="flex-1"
                  >
                    <Button className="w-full bg-primary hover:bg-primary/90 text-white py-6 text-lg">
                      <Download className="mr-2" size={20} />
                      Download Dubbed Video
                    </Button>
                  </a>
                  <Button
                    data-testid="create-new-btn"
                    variant="outline"
                    onClick={handleReset}
                    className="px-8 py-6"
                  >
                    Create New
                  </Button>
                </div>

                {/* Share Options */}
                <div className="mt-6 text-center">
                  <p className="text-sm text-muted-foreground mb-3">Share your dubbed video</p>
                  <div className="flex gap-3 justify-center">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(`${BACKEND_URL}${completedVideo.url}`);
                        toast.success('Link copied to clipboard!');
                      }}
                      data-testid="copy-link-btn"
                    >
                      Copy Link
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Processing Status */
            <div className="p-12 text-center">
              <div className="max-w-md mx-auto">
                <div className="mb-6">
                  <div className="animate-spin h-16 w-16 border-4 border-primary border-t-transparent rounded-full mx-auto mb-6" />
                  <h2 className="text-2xl font-heading font-bold mb-2">
                    {generating ? 'Generating Video' : 'Processing Video'}
                  </h2>
                  <p className="text-muted-foreground mb-6">{processingStatus || 'Starting...'}</p>
                </div>
                
                <div className="mb-6">
                  <Progress value={progressPercent} className="h-2" />
                  <p className="text-sm text-muted-foreground mt-2">{progressPercent}% complete</p>
                </div>
                
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>✓ Extracting audio</p>
                  <p className={progressPercent >= 50 ? '' : 'opacity-50'}>✓ Transcribing speech</p>
                  <p className={progressPercent >= 85 ? '' : 'opacity-50'}>✓ Translating text</p>
                  <p className={progressPercent >= 100 ? '' : 'opacity-50'}>✓ Generating dubbed audio</p>
                </div>
                
                <Button
                  variant="outline"
                  onClick={handleReset}
                  className="mt-8"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;





