import { Router } from 'express';
import db from '../db/database.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();
router.use(authenticateToken);

// Get tasks for a project
router.get('/project/:projectId', (req, res) => {
  try {
    const membership = db.prepare('SELECT role FROM project_members WHERE project_id = ? AND user_id = ?').get(req.params.projectId, req.user.id);
    if (!membership) return res.status(403).json({ error: 'Access denied' });

    let tasks;
    if (membership.role === 'admin') {
      tasks = db.prepare(`
        SELECT t.*, u.name as assigned_to_name, c.name as created_by_name
        FROM tasks t
        LEFT JOIN users u ON t.assigned_to = u.id
        LEFT JOIN users c ON t.created_by = c.id
        WHERE t.project_id = ?
        ORDER BY CASE t.priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, t.created_at DESC
      `).all(req.params.projectId);
    } else {
      tasks = db.prepare(`
        SELECT t.*, u.name as assigned_to_name, c.name as created_by_name
        FROM tasks t
        LEFT JOIN users u ON t.assigned_to = u.id
        LEFT JOIN users c ON t.created_by = c.id
        WHERE t.project_id = ? AND t.assigned_to = ?
        ORDER BY CASE t.priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, t.created_at DESC
      `).all(req.params.projectId, req.user.id);
    }
    res.json(tasks);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create task (Admin only)
router.post('/', (req, res) => {
  try {
    const { project_id, title, description, priority, due_date, assigned_to } = req.body;
    if (!project_id || !title) return res.status(400).json({ error: 'Project ID and title are required' });

    const membership = db.prepare('SELECT role FROM project_members WHERE project_id = ? AND user_id = ?').get(project_id, req.user.id);
    if (!membership || membership.role !== 'admin') return res.status(403).json({ error: 'Only admins can create tasks' });

    if (assigned_to) {
      const am = db.prepare('SELECT id FROM project_members WHERE project_id = ? AND user_id = ?').get(project_id, assigned_to);
      if (!am) return res.status(400).json({ error: 'Assigned user is not a project member' });
    }

    const result = db.prepare(
      'INSERT INTO tasks (project_id, title, description, priority, due_date, assigned_to, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(project_id, title, description || '', priority || 'medium', due_date || null, assigned_to || null, req.user.id);

    const task = db.prepare(`
      SELECT t.*, u.name as assigned_to_name, c.name as created_by_name
      FROM tasks t LEFT JOIN users u ON t.assigned_to = u.id LEFT JOIN users c ON t.created_by = c.id
      WHERE t.id = ?
    `).get(result.lastInsertRowid);
    res.status(201).json(task);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update task
router.put('/:id', (req, res) => {
  try {
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });

    const membership = db.prepare('SELECT role FROM project_members WHERE project_id = ? AND user_id = ?').get(task.project_id, req.user.id);
    if (!membership) return res.status(403).json({ error: 'Access denied' });

    if (membership.role === 'member') {
      if (task.assigned_to !== req.user.id) return res.status(403).json({ error: 'You can only update your own tasks' });
      const { status } = req.body;
      if (!status || !['todo', 'in_progress', 'done'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
      db.prepare('UPDATE tasks SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(status, req.params.id);
    } else {
      const { title, description, status, priority, due_date, assigned_to } = req.body;
      if (assigned_to) {
        const am = db.prepare('SELECT id FROM project_members WHERE project_id = ? AND user_id = ?').get(task.project_id, assigned_to);
        if (!am) return res.status(400).json({ error: 'Assigned user is not a project member' });
      }
      db.prepare(`
        UPDATE tasks SET title = COALESCE(?, title), description = COALESCE(?, description),
        status = COALESCE(?, status), priority = COALESCE(?, priority),
        due_date = ?, assigned_to = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `).run(
        title || null, description !== undefined ? description : null,
        status || null, priority || null,
        due_date !== undefined ? due_date : task.due_date,
        assigned_to !== undefined ? assigned_to : task.assigned_to,
        req.params.id
      );
    }

    const updated = db.prepare(`
      SELECT t.*, u.name as assigned_to_name, c.name as created_by_name
      FROM tasks t LEFT JOIN users u ON t.assigned_to = u.id LEFT JOIN users c ON t.created_by = c.id
      WHERE t.id = ?
    `).get(req.params.id);
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete task (Admin only)
router.delete('/:id', (req, res) => {
  try {
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });

    const membership = db.prepare('SELECT role FROM project_members WHERE project_id = ? AND user_id = ?').get(task.project_id, req.user.id);
    if (!membership || membership.role !== 'admin') return res.status(403).json({ error: 'Only admins can delete tasks' });

    db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
    res.json({ message: 'Task deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
