import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Waveform, SignOut, MagnifyingGlass, Download, Trash, Play, Clock } from '@phosphor-icons/react';
import { toast } from 'sonner';
import axios from 'axios';

const ProjectsPage = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewProject, setPreviewProject] = useState(null);

  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${BACKEND_URL}/api/projects`, {
        withCredentials: true,
      });
      setProjects(response.data);
    } catch (error) {
      toast.error('Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (projectId) => {
    if (!window.confirm('Are you sure you want to delete this project?')) return;

    try {
      await axios.delete(`${BACKEND_URL}/api/projects/${projectId}`, {
        withCredentials: true,
      });
      toast.success('Project deleted');
      fetchProjects();
    } catch (error) {
      toast.error('Failed to delete project');
    }
  };

  const filteredProjects = projects.filter((project) => {
    const matchesSearch =
      project.voice_instructions?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.target_language?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesFilter =
      filterStatus === 'all' ||
      project.status === filterStatus ||
      (filterStatus === 'processing' && ['pending', 'transcribing', 'translating', 'generating'].includes(project.status));

    return matchesSearch && matchesFilter;
  });

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'text-green-500';
      case 'error':
      case 'failed':
        return 'text-red-500';
      case 'review_ready':
        return 'text-yellow-500';
      default:
        return 'text-blue-500';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'review_ready':
        return 'Ready for Review';
      case 'transcribing':
        return 'Transcribing...';
      case 'translating':
        return 'Translating...';
      case 'generating':
        return 'Generating Video...';
      default:
        return status.charAt(0).toUpperCase() + status.slice(1);
    }
  };

  const handlePreview = (project) => {
    if (!project?.output_url) return;
    setPreviewProject(project);
    setPreviewOpen(true);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

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
              <Button variant="default" className="bg-primary">
                Projects
              </Button>
              <Button variant="ghost" onClick={() => navigate('/analytics')}>
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
          <h1 className="text-4xl font-heading font-bold tracking-tight mb-2">My Projects</h1>
          <p className="text-muted-foreground">View and manage all your dubbing projects</p>
        </div>

        {/* Filters */}
        <div className="flex gap-4 mb-6">
          <div className="flex-1 relative">
            <MagnifyingGlass size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="search-projects"
            />
          </div>
          <div className="flex gap-2">
            {['all', 'completed', 'processing', 'review_ready', 'error'].map((status) => (
              <Button
                key={status}
                variant={filterStatus === status ? 'default' : 'outline'}
                onClick={() => setFilterStatus(status)}
                className={filterStatus === status ? 'bg-primary' : ''}
                data-testid={`filter-${status}`}
              >
                {status === 'all' ? 'All' : status.replace('_', ' ')}
              </Button>
            ))}
          </div>
        </div>

        {/* Projects List */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-muted-foreground">Loading projects...</p>
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">No projects found</p>
            <Button onClick={() => navigate('/dashboard')} className="bg-primary">
              Create Your First Project
            </Button>
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredProjects.map((project) => (
              <div
                key={project.id}
                className="bg-card border border-border rounded-lg p-6 hover:shadow-lg transition-shadow"
                data-testid={`project-${project.id}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`text-sm font-semibold ${getStatusColor(project.status)}`}>
                        {getStatusLabel(project.status)}
                      </span>
                      <span className="text-xs text-muted-foreground capitalize">
                        {project.target_language}
                      </span>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock size={14} />
                        {new Date(project.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">
                      {project.voice_instructions || 'No description'}
                    </p>
                    {project.transcription && (
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {project.transcription.substring(0, 150)}...
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2 ml-4">
                    {project.status === 'completed' && project.output_url && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          data-testid={`preview-${project.id}`}
                          onClick={() => handlePreview(project)}
                        >
                          <Play size={16} className="mr-1" />
                          Preview
                        </Button>
                        <a href={`${BACKEND_URL}${project.output_url}`} download>
                          <Button size="sm" className="bg-primary" data-testid={`download-${project.id}`}>
                            <Download size={16} className="mr-1" />
                            Download
                          </Button>
                        </a>
                      </>
                    )}
                    {project.status === 'review_ready' && (
                      <Button
                        size="sm"
                        className="bg-yellow-500 hover:bg-yellow-600"
                        onClick={() => navigate('/dashboard')}
                      >
                        Review
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(project.id)}
                      data-testid={`delete-${project.id}`}
                    >
                      <Trash size={16} className="text-red-500" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={previewOpen} onOpenChange={(open) => {
        setPreviewOpen(open);
        if (!open) setPreviewProject(null);
      }}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Project Preview</DialogTitle>
          </DialogHeader>
          {previewProject && (
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground">
                {previewProject.voice_instructions || "No description"}
              </div>
              <video
                controls
                className="w-full rounded-lg border border-border"
                src={`${BACKEND_URL}${previewProject.output_url}?inline=1`}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProjectsPage;




























