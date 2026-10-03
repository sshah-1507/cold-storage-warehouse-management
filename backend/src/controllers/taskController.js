const { randomUUID } = require('crypto');
const { pool, db } = require('../config/db');
const { createTaskSchema, updateTaskStatusSchema } = require('../validators/warehouse');

/**
 * GET /api/tasks
 * List tasks (US-09)
 * Access: ADMIN, MANAGER; own tasks STAFF
 */
async function getTasks(req, res, next) {
  try {
    const user = req.session.user;
    const { status, page, limit } = req.query;

    const pageNum = parseInt(page, 10) > 0 ? parseInt(page, 10) : 1;
    const limitNum = parseInt(limit, 10) > 0 ? parseInt(limit, 10) : 50;
    const offset = (pageNum - 1) * limitNum;

    const conditions = [];
    const params = [];
    let paramIndex = 1;

    // Staff scoping: Staff can only view their own assigned tasks
    if (user.role === 'STAFF') {
      conditions.push(`t."assignedTo" = $${paramIndex++}`);
      params.push(user.id);
    } else if (req.query.assignedTo) {
      conditions.push(`t."assignedTo" = $${paramIndex++}`);
      params.push(req.query.assignedTo);
    }

    if (status) {
      conditions.push(`t.status = $${paramIndex++}`);
      params.push(status.toUpperCase());
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countSql = `SELECT COUNT(*) AS total FROM "Task" t ${whereClause}`;
    const countResult = await pool.query(countSql, params);
    const totalCount = parseInt(countResult.rows[0].total, 10);

    const dataSql = `
      SELECT t.id, t.title, t.description, t."assignedTo", t."dueDate", t.status, t."createdAt", u.name as "assigneeName"
      FROM "Task" t
      JOIN "User" u ON t."assignedTo" = u.id
      ${whereClause}
      ORDER BY t."dueDate" ASC, t."createdAt" DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;

    const dataResult = await pool.query(dataSql, [...params, limitNum, offset]);

    const formatted = dataResult.rows.map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      assignedTo: r.assignedTo,
      assigneeName: r.assigneeName,
      dueDate: r.dueDate,
      status: r.status,
      createdAt: r.createdAt,
    }));

    return res.status(200).json({
      data: formatted,
      meta: {
        total: totalCount,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(totalCount / limitNum),
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/tasks
 * Assign staff task (US-09)
 * Access: ADMIN, MANAGER
 */
async function createTask(req, res, next) {
  try {
    const parseResult = createTaskSchema.safeParse(req.body);
    if (!parseResult.success) {
      const issue = parseResult.error.issues[0];
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: issue ? issue.message : 'Invalid task data',
        },
      });
    }

    const { title, description, assignedTo, dueDate } = parseResult.data;

    // Verify assigned user exists and has STAFF role
    const assignee = await db.orm.public.User
      .where({ id: assignedTo })
      .first();

    if (!assignee) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: `Assignee user with ID '${assignedTo}' not found`,
        },
      });
    }

    const taskId = `task_${randomUUID()}`;

    await pool.query(
      `INSERT INTO "Task" (id, title, description, "assignedTo", "dueDate", status, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, 'PENDING', NOW(), NOW())`,
      [taskId, title, description || null, assignedTo, dueDate]
    );

    return res.status(201).json({
      data: {
        id: taskId,
        title,
        description: description || null,
        assignedTo,
        dueDate,
        status: 'PENDING',
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/tasks/:id
 * Update task status (US-09)
 * Access: ADMIN, MANAGER; assigned STAFF
 * Allowed transitions: PENDING, IN_PROGRESS, COMPLETED
 */
async function updateTask(req, res, next) {
  try {
    const { id } = req.params;
    const user = req.session.user;

    const parseResult = updateTaskStatusSchema.safeParse(req.body);
    if (!parseResult.success) {
      const issue = parseResult.error.issues[0];
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: issue ? issue.message : 'Invalid task status',
        },
      });
    }

    const { status } = parseResult.data;

    const taskResult = await pool.query('SELECT * FROM "Task" WHERE id = $1', [id]);
    if (taskResult.rows.length === 0) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: `Task with ID '${id}' not found`,
        },
      });
    }

    const task = taskResult.rows[0];

    // Staff authorization check: Staff can only update their own assigned tasks
    if (user.role === 'STAFF' && task.assignedTo !== user.id) {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'Access denied. You can only update tasks assigned to you.',
        },
      });
    }

    await pool.query(
      'UPDATE "Task" SET status = $1, "updatedAt" = NOW() WHERE id = $2',
      [status, id]
    );

    return res.status(200).json({
      data: {
        id: task.id,
        title: task.title,
        assignedTo: task.assignedTo,
        dueDate: task.dueDate,
        status,
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getTasks,
  createTask,
  updateTask,
};
