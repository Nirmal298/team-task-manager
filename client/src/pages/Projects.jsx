import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/api';

export default function Projects() {
  const { token } = useAuth();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);

  const loadProjects = async () => {
    const data = await api.get('/projects', token);
    if (!data.error) setProjects(data);
    setLoading(false);
  };

  useEffect(() => { loadProjects(); }, [token]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    const data = await api.post('/projects', { name, description }, token);
    if (!data.error) {
      setName(''); setDescription(''); setShowForm(false);
      loadProjects();
    }
    setCreating(false);
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this project and all its tasks?')) return;
    await api.del(`/projects/${id}`, token);
    loadProjects();
  };

  if (loading) return <div className="page-loader"><div className="spinner" /></div>;

  return (
    <div className="projects-page page-animate">
      <div className="page-header">
        <div>
          <h1>Projects</h1>
          <p className="page-subtitle">{projects.length} project{projects.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn btn-primary" id="new-project-btn">
          {showForm ? 'Cancel' : '+ New Project'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="card create-project-form" style={{ marginBottom: '2rem' }}>
          <div className="form-group">
            <label>Project Name *</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              required placeholder="e.g. Marketing Website" className="form-input" id="project-name-input" />
          </div>
          <div className="form-group">
            <label>Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)}
              placeholder="Brief description..." className="form-input form-textarea" rows={2} id="project-desc-input" />
          </div>
          <button type="submit" className="btn btn-primary" disabled={creating} id="create-project-btn">
            {creating ? 'Creating...' : 'Create Project'}
          </button>
        </form>
      )}

      {projects.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">📁</span>
          <h2>No projects yet</h2>
          <p>Create your first project to get started</p>
        </div>
      ) : (
        <div className="project-grid">
          {projects.map(p => (
            <Link to={`/projects/${p.id}`} key={p.id} className="project-card">
              <div className="project-card-header">
                <h3>{p.name}</h3>
                <span className={`role-badge role-${p.role}`}>{p.role}</span>
              </div>
              <p className="project-desc">{p.description || 'No description'}</p>
              <div className="project-meta">
                <span>👥 {p.member_count} members</span>
                <span>📋 {p.task_count} tasks</span>
              </div>
              {p.role === 'admin' && (
                <button className="btn btn-ghost btn-sm project-delete"
                  onClick={(e) => { e.preventDefault(); handleDelete(p.id); }} id={`delete-project-${p.id}`}>
                  🗑️
                </button>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
