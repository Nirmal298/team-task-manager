import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/api';

export default function Dashboard() {
  const { token, user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/dashboard', token).then(data => {
      if (!data.error) setStats(data);
      setLoading(false);
    });
  }, [token]);

  if (loading) return <div className="page-loader"><div className="spinner" /></div>;

  const statusColors = { todo: '#a78bfa', in_progress: '#fbbf24', done: '#34d399' };
  const priorityColors = { high: '#f87171', medium: '#fbbf24', low: '#34d399' };

  const getStatusLabel = (s) => ({ todo: 'To Do', in_progress: 'In Progress', done: 'Done' }[s] || s);
  const getPriorityLabel = (p) => ({ high: 'High', medium: 'Medium', low: 'Low' }[p] || p);

  const totalForBar = Math.max(stats.tasksByStatus.todo + stats.tasksByStatus.in_progress + stats.tasksByStatus.done, 1);

  return (
    <div className="dashboard-page page-animate">
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p className="page-subtitle">Welcome back, {user?.name} 👋</p>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card stat-total">
          <div className="stat-icon">📋</div>
          <div className="stat-info">
            <span className="stat-value">{stats.totalTasks}</span>
            <span className="stat-label">Total Tasks</span>
          </div>
        </div>
        <div className="stat-card stat-projects">
          <div className="stat-icon">📁</div>
          <div className="stat-info">
            <span className="stat-value">{stats.projectCount}</span>
            <span className="stat-label">Projects</span>
          </div>
        </div>
        <div className="stat-card stat-done">
          <div className="stat-icon">✅</div>
          <div className="stat-info">
            <span className="stat-value">{stats.tasksByStatus.done}</span>
            <span className="stat-label">Completed</span>
          </div>
        </div>
        <div className="stat-card stat-overdue">
          <div className="stat-icon">⚠️</div>
          <div className="stat-info">
            <span className="stat-value">{stats.overdueTasks}</span>
            <span className="stat-label">Overdue</span>
          </div>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="card">
          <h3 className="card-title">Tasks by Status</h3>
          <div className="progress-bar-stacked">
            {Object.entries(stats.tasksByStatus).map(([status, count]) => (
              <div key={status} className="progress-segment" style={{
                width: `${(count / totalForBar) * 100}%`,
                backgroundColor: statusColors[status]
              }} title={`${getStatusLabel(status)}: ${count}`} />
            ))}
          </div>
          <div className="legend">
            {Object.entries(stats.tasksByStatus).map(([status, count]) => (
              <div key={status} className="legend-item">
                <span className="legend-dot" style={{ backgroundColor: statusColors[status] }} />
                <span>{getStatusLabel(status)}</span>
                <span className="legend-count">{count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h3 className="card-title">Tasks by Priority</h3>
          <div className="priority-bars">
            {Object.entries(stats.tasksByPriority).map(([priority, count]) => (
              <div key={priority} className="priority-row">
                <span className="priority-label">{getPriorityLabel(priority)}</span>
                <div className="priority-bar-track">
                  <div className="priority-bar-fill" style={{
                    width: `${Math.max((count / Math.max(stats.totalTasks, 1)) * 100, count > 0 ? 8 : 0)}%`,
                    backgroundColor: priorityColors[priority]
                  }} />
                </div>
                <span className="priority-count">{count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h3 className="card-title">Tasks per Member</h3>
          {stats.tasksPerUser.length === 0 ? (
            <p className="empty-text">No assigned tasks yet</p>
          ) : (
            <div className="member-list">
              {stats.tasksPerUser.map((u, i) => (
                <div key={i} className="member-row">
                  <div className="member-avatar">{u.name.charAt(0).toUpperCase()}</div>
                  <span className="member-name">{u.name}</span>
                  <span className="member-badge">{u.task_count} tasks</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h3 className="card-title">Recent Activity</h3>
          {stats.recentTasks.length === 0 ? (
            <p className="empty-text">No recent tasks</p>
          ) : (
            <div className="activity-list">
              {stats.recentTasks.map(t => (
                <div key={t.id} className="activity-item">
                  <div className={`activity-dot status-${t.status}`} />
                  <div className="activity-info">
                    <span className="activity-title">{t.title}</span>
                    <span className="activity-meta">{t.project_name} · {t.assigned_to_name || 'Unassigned'}</span>
                  </div>
                  <span className={`badge badge-${t.status}`}>{getStatusLabel(t.status)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
