const pool = require('../db/connection');
const { log } = require('../config/logging');
const format = require('pg-format');

async function createMealPlanTemplate(planData) {
    const client = await pool.connect();
    try {
        log('info', 'createMealPlanTemplate - planData:', planData);
        await client.query('BEGIN');

        const insertTemplateQuery = `
            INSERT INTO meal_plan_templates (user_id, plan_name, description, start_date, end_date, is_active)
            VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`;
        const templateValues = [
            planData.user_id,
            planData.plan_name ?? '',
            planData.description ?? '',
            planData.start_date ?? new Date(),
            planData.end_date,
            planData.is_active ?? false
        ];
        
        log('info', 'createMealPlanTemplate - insertTemplateQuery:', insertTemplateQuery);
        log('info', 'createMealPlanTemplate - templateValues:', templateValues);

        const templateResult = await client.query(insertTemplateQuery, templateValues);
        const newTemplate = templateResult.rows[0];

        if (planData.assignments && planData.assignments.length > 0) {
            const assignmentValues = planData.assignments.map(a => [newTemplate.id, a.day_of_week, a.meal_type, a.meal_id]);
            const assignmentQuery = format(
                `INSERT INTO meal_plan_template_assignments (template_id, day_of_week, meal_type, meal_id) VALUES %L`,
                assignmentValues
            );
            log('info', 'createMealPlanTemplate - assignmentQuery:', assignmentQuery);
            await client.query(assignmentQuery);
            log('info', 'createMealPlanTemplate - Executed assignmentQuery');
        }

        await client.query('COMMIT');
        log('info', 'createMealPlanTemplate - Committed transaction');
        const finalQuery = `
            SELECT
                t.*,
                COALESCE(
                    (
                        SELECT json_agg(
                            json_build_object(
                                'id', a.id,
                                'day_of_week', a.day_of_week,
                                'meal_type', a.meal_type,
                                'meal_id', a.meal_id,
                                'meal_name', m.name
                            )
                        )
                        FROM meal_plan_template_assignments a
                        JOIN meals m ON a.meal_id = m.id
                        WHERE a.template_id = t.id
                    ),
                    '[]'::json
                ) as assignments
            FROM meal_plan_templates t
            WHERE t.id = $1
        `;
        const finalResult = await client.query(finalQuery, [newTemplate.id]);
        return finalResult.rows[0];
    } catch (error) {
        await client.query('ROLLBACK');
        log('error', `Error creating meal plan template: ${error.message}`, error);
        throw error;
    } finally {
        client.release();
    }
}

async function getMealPlanTemplatesByUserId(userId) {
    const client = await pool.connect();
    try {
        const query = `
            SELECT
                t.*,
                COALESCE(
                    (
                        SELECT json_agg(
                            json_build_object(
                                'id', a.id,
                                'day_of_week', a.day_of_week,
                                'meal_type', a.meal_type,
                                'meal_id', a.meal_id,
                                'meal_name', m.name
                            )
                        )
                        FROM meal_plan_template_assignments a
                        JOIN meals m ON a.meal_id = m.id
                        WHERE a.template_id = t.id
                    ),
                    '[]'::json
                ) as assignments
            FROM meal_plan_templates t
            WHERE t.user_id = $1
            ORDER BY t.start_date DESC
        `;
        const result = await client.query(query, [userId]);
        return result.rows;
    } finally {
        client.release();
    }
}

async function updateMealPlanTemplate(planId, planData) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const templateResult = await client.query(
            `UPDATE meal_plan_templates SET
                plan_name = $1, description = $2, start_date = $3, end_date = $4, is_active = $5, updated_at = now()
             WHERE id = $6 AND user_id = $7 RETURNING *`,
            [
                planData.plan_name ?? '',
                planData.description ?? '',
                planData.start_date ?? new Date(),
                planData.end_date,
                planData.is_active ?? false,
                planId,
                planData.user_id
            ]
        );
        const updatedTemplate = templateResult.rows[0];

        await client.query('DELETE FROM meal_plan_template_assignments WHERE template_id = $1', [planId]);

        if (planData.assignments && planData.assignments.length > 0) {
            const assignmentValues = planData.assignments.map(a => [planId, a.day_of_week, a.meal_type, a.meal_id]);
            const assignmentQuery = format(
                `INSERT INTO meal_plan_template_assignments (template_id, day_of_week, meal_type, meal_id) VALUES %L`,
                assignmentValues
            );
            await client.query(assignmentQuery);
        }

        await client.query('COMMIT');
        const finalQuery = `
            SELECT
                t.*,
                COALESCE(
                    (
                        SELECT json_agg(
                            json_build_object(
                                'id', a.id,
                                'day_of_week', a.day_of_week,
                                'meal_type', a.meal_type,
                                'meal_id', a.meal_id,
                                'meal_name', m.name
                            )
                        )
                        FROM meal_plan_template_assignments a
                        JOIN meals m ON a.meal_id = m.id
                        WHERE a.template_id = t.id
                    ),
                    '[]'::json
                ) as assignments
            FROM meal_plan_templates t
            WHERE t.id = $1
        `;
        const finalResult = await client.query(finalQuery, [planId]);
        return finalResult.rows[0];
    } catch (error) {
        await client.query('ROLLBACK');
        log('error', `Error updating meal plan template ${planId}: ${error.message}`, error);
        throw error;
    } finally {
        client.release();
    }
}

async function deleteMealPlanTemplate(planId, userId) {
    const client = await pool.connect();
    try {
        // The assignments table will be cascade deleted due to the foreign key constraint
        const result = await client.query(
            `DELETE FROM meal_plan_templates WHERE id = $1 AND user_id = $2 RETURNING *`,
            [planId, userId]
        );
        return result.rows[0];
    } catch (error) {
        log('error', `Error deleting meal plan template ${planId}: ${error.message}`, error);
        throw error;
    } finally {
        client.release();
    }
}

async function deactivateAllMealPlanTemplates(userId) {
    const client = await pool.connect();
    try {
        await client.query(
            `UPDATE meal_plan_templates SET is_active = FALSE WHERE user_id = $1`,
            [userId]
        );
        return true;
    } finally {
        client.release();
    }
}

async function getMealPlanTemplateOwnerId(templateId) {
    const client = await pool.connect();
    try {
        const result = await client.query(
            `SELECT user_id FROM meal_plan_templates WHERE id = $1`,
            [templateId]
        );
        return result.rows[0]?.user_id;
    } finally {
        client.release();
    }
}

async function getActiveMealPlanForDate(userId, date) {
    const client = await pool.connect();
    try {
        const query = `
            SELECT
                t.*,
                COALESCE(
                    (
                        SELECT json_agg(
                            json_build_object(
                                'id', a.id,
                                'day_of_week', a.day_of_week,
                                'meal_type', a.meal_type,
                                'meal_id', a.meal_id,
                                'meal_name', m.name
                            )
                        )
                        FROM meal_plan_template_assignments a
                        JOIN meals m ON a.meal_id = m.id
                        WHERE a.template_id = t.id
                    ),
                    '[]'::json
                ) as assignments
            FROM meal_plan_templates t
            WHERE t.user_id = $1
              AND t.is_active = TRUE
              AND t.start_date <= $2
              AND (t.end_date IS NULL OR t.end_date >= $2)
            ORDER BY t.start_date DESC
            LIMIT 1
        `;
        const result = await client.query(query, [userId, date]);
        return result.rows[0];
    } finally {
        client.release();
    }
}

module.exports = {
    createMealPlanTemplate,
    getMealPlanTemplatesByUserId,
    updateMealPlanTemplate,
    deleteMealPlanTemplate,
    deactivateAllMealPlanTemplates,
    getMealPlanTemplateOwnerId,
    getActiveMealPlanForDate,
};