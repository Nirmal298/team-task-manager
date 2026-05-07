import { Router } from 'express';
import db from '../db/database.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();
router.use(authenticateToken);

// List user's projects
router.get('/', (req, res) => {
  try {
    const projects = db.prepare(`
      SELECT p.*, pm.role, u.name as creator_name,
        (SELECT COUNT(*) FROM tasks WHERE project_id = p.id) as task_count,
        (SELECT COUNT(*) FROM project_members WHERE project_id = p.id) as member_count
      FROM projects p
      JOIN project_members pm ON p.id = pm.project_id AND pm.user_id = ?
      JOIN users u ON p.created_by = u.id
      ORDER BY p.created_at DESC
    `).all(req.user.id);
    res.json(projects);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create project
router.post('/', (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ error: 'Project name is required' });

    const result = db.prepare('INSERT INTO projects (name, description, created_by) VALUES (?, ?, ?)').run(name, description || '', req.user.id);
    db.prepare('INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)').run(result.lastInsertRowid, req.user.id, 'admin');

    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(project);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get single project with members
router.get('/:id', (req, res) => {
  try {
    const membership = db.prepare('SELECT role FROM project_members WHERE project_id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!membership) return res.status(403).json({ error: 'Access denied' });

    const project = db.prepare(`
      SELECT p.*, u.name as creator_name FROM projects p
      JOIN users u ON p.created_by = u.id WHERE p.id = ?
    `).get(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    project.role = membership.role;
    project.members = db.prepare(`
      SELECT u.id, u.name, u.email, pm.role
      FROM project_members pm JOIN users u ON pm.user_id = u.id
      WHERE pm.project_id = ?
    `).all(req.params.id);

    res.json(project);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Add member (Admin only)
router.post('/:id/members', (req, res) => {
  try {
    const membership = db.prepare('SELECT role FROM project_members WHERE project_id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!membership || membership.role !== 'admin') return res.status(403).json({ error: 'Only admins can add members' });

    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const user = db.prepare('SELECT id, name, email FROM users WHERE email = ?').get(email);
    if (!user) return res.status(404).json({ error: 'User not found with that email' });

    const existing = db.prepare('SELECT id FROM project_members WHERE project_id = ? AND user_id = ?').get(req.params.id, user.id);
    if (existing) return res.status(409).json({ error: 'User is already a member' });

    db.prepare('INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)').run(req.params.id, user.id, 'member');
    res.status(201).json({ id: user.id, name: user.name, email: user.email, role: 'member' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Remove member (Admin only)
router.delete('/:id/members/:userId', (req, res) => {
  try {
    const membership = db.prepare('SELECT role FROM project_members WHERE project_id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!membership || membership.role !== 'admin') return res.status(403).json({ error: 'Only admins can remove members' });

    const project = db.prepare('SELECT created_by FROM projects WHERE id = ?').get(req.params.id);
    if (project && project.created_by === parseInt(req.params.userId)) {
      return res.status(400).json({ error: 'Cannot remove the project creator' });
    }

    db.prepare('DELETE FROM project_members WHERE project_id = ? AND user_id = ?').run(req.params.id, req.params.userId);
    db.prepare('UPDATE tasks SET assigned_to = NULL WHERE project_id = ? AND assigned_to = ?').run(req.params.id, req.params.userId);
    res.json({ message: 'Member removed' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete project (Admin only)
router.delete('/:id', (req, res) => {
  try {
    const membership = db.prepare('SELECT role FROM project_members WHERE project_id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!membership || membership.role !== 'admin') return res.status(403).json({ error: 'Only admins can delete projects' });

    db.prepare('DELETE FROM tasks WHERE project_id = ?').run(req.params.id);
    db.prepare('DELETE FROM project_members WHERE project_id = ?').run(req.params.id);
    db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id);
    res.json({ message: 'Project deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
