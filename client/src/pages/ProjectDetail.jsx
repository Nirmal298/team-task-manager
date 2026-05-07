import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/api';
import TaskModal from '../components/TaskModal';
import MemberModal from '../components/MemberModal';

const STATUS_COLS = [
  { key: 'todo', label: 'To Do', icon: '📋', color: '#a78bfa' },
  { key: 'in_progress', label: 'In Progress', icon: '🔄', color: '#fbbf24' },
  { key: 'done', label: 'Done', icon: '✅', color: '#34d399' },
];

export default function ProjectDetail() {
  const { id } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [taskModal, setTaskModal] = useState(null); // null=closed, {}=new, {task}=edit
  const [memberModal, setMemberModal] = useState(false);
  const [memberError, setMemberError] = useState('');

  const load = useCallback(async () => {
    const [p, t] = await Promise.all([
      api.get(`/projects/${id}`, token),
      api.get(`/tasks/project/${id}`, token)
    ]);
    if (p.error) { navigate('/projects'); return; }
    setProject(p);
    if (!t.error) setTasks(t);
    setLoading(false);
  }, [id, token, navigate]);

  useEffect(() => { load(); }, [load]);

  const isAdmin = project?.role === 'admin';

  const handleSaveTask = async (form) => {
    let res;
    if (taskModal?.id) {
      res = await api.put(`/tasks/${taskModal.id}`, form, token);
    } else {
      res = await api.post('/tasks', { ...form, project_id: Number(id) }, token);
    }
    if (!res.error) { setTaskModal(null); load(); }
  };

  const handleDeleteTask = async (taskId) => {
    if (!confirm('Delete this task?')) return;
    await api.del(`/tasks/${taskId}`, token);
    load();
  };

  const handleStatusChange = async (taskId, status) => {
    await api.put(`/tasks/${taskId}`, { status }, token);
    load();
  };

  const handleAddMember = async (email) => {
    setMemberError('');
    const res = await api.post(`/projects/${id}/members`, { email }, token);
    if (res.error) { setMemberError(res.error); return; }
    setMemberModal(false);
    load();
  };

  const handleRemoveMember = async (userId) => {
    if (!confirm('Remove this member?')) return;
    await api.del(`/projects/${id}/members/${userId}`, token);
    load();
  };

  if (loading) return <div className="page-loader"><div className="spinner" /></div>;

  const isOverdue = (t) => t.due_date && new Date(t.due_date) < new Date() && t.status !== 'done';

  return (
    <div className="project-detail-page page-animate">
      <div className="page-header">
        <div>
          <button onClick={() => navigate('/projects')} className="btn btn-ghost btn-sm" style={{ marginBottom: 8 }}>
            ← Back to Projects
          </button>
          <h1>{project.name}</h1>
          <p className="page-subtitle">{project.description || 'No description'}</p>
        </div>
        <div className="header-actions">
          {isAdmin && (
            <>
              <button onClick={() => setMemberModal(true)} className="btn btn-secondary" id="manage-members-btn">
                👥 Members ({project.members?.length})
              </button>
              <button onClick={() => setTaskModal({})} className="btn btn-primary" id="new-task-btn">
                + New Task
              </button>
            </>
          )}
        </div>
      </div>

      {/* Members bar */}
      <div className="members-bar">
        {project.members?.map(m => (
          <div key={m.id} className="member-chip" title={`${m.name} (${m.role})`}>
            <div className="member-chip-avatar">{m.name.charAt(0).toUpperCase()}</div>
            <span>{m.name}</span>
            <span className={`role-dot role-${m.role}`} />
            {isAdmin && m.role !== 'admin' && (
              <button className="member-chip-remove" onClick={() => handleRemoveMember(m.id)} title="Remove">×</button>
            )}
          </div>
        ))}
      </div>

      {/* Kanban Board */}
      <div className="kanban-board">
        {STATUS_COLS.map(col => {
          const colTasks = tasks.filter(t => t.status === col.key);
          return (
            <div key={col.key} className="kanban-col">
              <div className="kanban-col-header" style={{ borderTopColor: col.color }}>
                <span>{col.icon} {col.label}</span>
                <span className="kanban-count">{colTasks.length}</span>
              </div>
              <div className="kanban-col-body">
                {colTasks.map(t => (
                  <div key={t.id} className={`task-card ${isOverdue(t) ? 'task-overdue' : ''}`}>
                    <div className="task-card-top">
                      <span className={`priority-dot priority-${t.priority}`} title={t.priority} />
                      <span className="task-title">{t.title}</span>
                    </div>
                    {t.description && <p className="task-desc">{t.description}</p>}
                    <div className="task-card-meta">
                      {t.due_date && (
                        <span className={`task-due ${isOverdue(t) ? 'overdue' : ''}`}>
                          📅 {new Date(t.due_date).toLocaleDateString()}
                        </span>
                      )}
                      {t.assigned_to_name && (
                        <span className="task-assignee">
                          <span className="mini-avatar">{t.assigned_to_name.charAt(0)}</span>
                          {t.assigned_to_name}
                        </span>
                      )}
                    </div>
                    <div className="task-card-actions">
                      {/* Status quick-change for members */}
                      {!isAdmin && (
                        <select value={t.status} onChange={e => handleStatusChange(t.id, e.target.value)}
                          className="form-input form-input-sm" id={`status-select-${t.id}`}>
                          <option value="todo">To Do</option>
                          <option value="in_progress">In Progress</option>
                          <option value="done">Done</option>
                        </select>
                      )}
                      {isAdmin && (
                        <>
                          <button className="btn btn-ghost btn-xs" onClick={() => setTaskModal(t)} id={`edit-task-${t.id}`}>✏️</button>
                          <button className="btn btn-ghost btn-xs" onClick={() => handleDeleteTask(t.id)} id={`delete-task-${t.id}`}>🗑️</button>
                          <select value={t.status} onChange={e => handleStatusChange(t.id, e.target.value)}
                            className="form-input form-input-sm" id={`admin-status-${t.id}`}>
                            <option value="todo">To Do</option>
                            <option value="in_progress">In Progress</option>
                            <option value="done">Done</option>
                          </select>
                        </>
                      )}
                    </div>
                  </div>
                ))}
                {colTasks.length === 0 && <p className="kanban-empty">No tasks</p>}
              </div>
            </div>
          );
        })}
      </div>

      {taskModal !== null && (
        <TaskModal task={taskModal.id ? taskModal : null} members={project.members || []}
          onSave={handleSaveTask} onClose={() => setTaskModal(null)} />
      )}
      {memberModal && (
        <MemberModal onAdd={handleAddMember} onClose={() => { setMemberModal(false); setMemberError(''); }} error={memberError} />
      )}
    </div>
  );
}
