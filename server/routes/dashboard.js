import { Router } from 'express';
import db from '../db/database.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();
router.use(authenticateToken);

router.get('/', (req, res) => {
  try {
    const projectIds = db.prepare('SELECT project_id FROM project_members WHERE user_id = ?')
      .all(req.user.id).map(p => p.project_id);

    if (projectIds.length === 0) {
      return res.json({
        totalTasks: 0,
        tasksByStatus: { todo: 0, in_progress: 0, done: 0 },
        tasksByPriority: { low: 0, medium: 0, high: 0 },
        overdueTasks: 0,
        tasksPerUser: [],
        recentTasks: [],
        projectCount: 0
      });
    }

    const placeholders = projectIds.map(() => '?').join(',');

    const totalTasks = db.prepare(`SELECT COUNT(*) as count FROM tasks WHERE project_id IN (${placeholders})`).get(...projectIds).count;

    const statusRows = db.prepare(`SELECT status, COUNT(*) as count FROM tasks WHERE project_id IN (${placeholders}) GROUP BY status`).all(...projectIds);
    const tasksByStatus = { todo: 0, in_progress: 0, done: 0 };
    statusRows.forEach(r => { tasksByStatus[r.status] = r.count; });

    const priorityRows = db.prepare(`SELECT priority, COUNT(*) as count FROM tasks WHERE project_id IN (${placeholders}) GROUP BY priority`).all(...projectIds);
    const tasksByPriority = { low: 0, medium: 0, high: 0 };
    priorityRows.forEach(r => { tasksByPriority[r.priority] = r.count; });

    const overdueTasks = db.prepare(`SELECT COUNT(*) as count FROM tasks WHERE project_id IN (${placeholders}) AND due_date < date('now') AND status != 'done'`).get(...projectIds).count;

    const tasksPerUser = db.prepare(`
      SELECT u.name, COUNT(t.id) as task_count
      FROM tasks t JOIN users u ON t.assigned_to = u.id
      WHERE t.project_id IN (${placeholders})
      GROUP BY t.assigned_to ORDER BY task_count DESC LIMIT 10
    `).all(...projectIds);

    const recentTasks = db.prepare(`
      SELECT t.*, u.name as assigned_to_name, p.name as project_name
      FROM tasks t LEFT JOIN users u ON t.assigned_to = u.id
      JOIN projects p ON t.project_id = p.id
      WHERE t.project_id IN (${placeholders})
      ORDER BY t.updated_at DESC LIMIT 5
    `).all(...projectIds);

    res.json({
      totalTasks, tasksByStatus, tasksByPriority, overdueTasks,
      tasksPerUser, recentTasks, projectCount: projectIds.length
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
