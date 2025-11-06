import pool from "../config/db.js";

/* 🧩 Common Date Range Utility */
const getDateRange = (req) => {
  const start = req.query.start || "2025-10-01";
  const end = req.query.end || "2025-10-07";
  return { start, end };
};

/* 1️⃣ Production vs Plan */
export const getProduction = async (req, res) => {
  const { start, end } = getDateRange(req);
  try {
    const summary = await pool.query(
      `SELECT 
          ROUND(SUM(batch_size_actual_kg)/1000.0, 2) AS actual_tons,
          ROUND(SUM(batch_size_set_kg)/1000.0, 2) AS planned_tons,
          ROUND(100.0 * SUM(batch_size_actual_kg)::numeric / NULLIF(SUM(batch_size_set_kg),0), 2) AS plan_attainment_pct
       FROM batches
       WHERE start_time >= $1 AND start_time < ($2::date + INTERVAL '1 day');`,
      [start, end]
    );

    const byLine = await pool.query(
      `SELECT 
          line,
          ROUND(SUM(batch_size_actual_kg)/1000.0, 2) AS actual_tons,
          ROUND(SUM(batch_size_set_kg)/1000.0, 2) AS planned_tons,
          ROUND(100.0 * SUM(batch_size_actual_kg)::numeric / NULLIF(SUM(batch_size_set_kg),0), 2) AS plan_attainment_pct
       FROM batches
       WHERE start_time >= $1 AND start_time < ($2::date + INTERVAL '1 day')
       GROUP BY line
       ORDER BY line;`,
      [start, end]
    );

    res.json({ summary: summary.rows[0] || {}, byLine: byLine.rows });
  } catch (err) {
    console.error("Production Error:", err);
    res.status(500).json({ error: err.message });
  }
};

/* 2️⃣ Energy (SEC + Demand Trend) */
export const getEnergy = async (req, res) => {
  const { start, end } = getDateRange(req);
  try {
    const sec = await pool.query(
      `WITH prod AS (
         SELECT SUM(batch_size_actual_kg)/1000.0 AS tons FROM batches
         WHERE start_time >= $1 AND start_time < ($2::date + INTERVAL '1 day')
       ), em AS (
         SELECT SUM(kwh) AS kwh_sum FROM energy_meters_15min
         WHERE meter_id='EM-MAIN' AND timestamp >= $1 AND timestamp < ($2::date + INTERVAL '1 day')
       )
       SELECT ROUND(em.kwh_sum / NULLIF(prod.tons,0),2) AS sec_kwh_per_t FROM prod, em;`,
      [start, end]
    );

    const trend = await pool.query(
      `SELECT timestamp, kw AS demand_kw
       FROM energy_meters_15min
       WHERE meter_id='EM-MAIN' AND timestamp >= $1 AND timestamp < ($2::date + INTERVAL '1 day')
       ORDER BY timestamp;`,
      [start, end]
    );

    res.json({ sec: sec.rows[0] || { sec_kwh_per_t: null }, trend: trend.rows });
  } catch (err) {
    console.error("Energy Error:", err);
    res.status(500).json({ error: err.message });
  }
};

/* 3️⃣ Steam & Conditioning */
export const getSteamConditioning = async (req, res) => {
  const { start, end } = getDateRange(req);
  try {
    const steam = await pool.query(
      `WITH steam_sum AS (
         SELECT SUM(steam_flow_kgph) * (5.0/60.0) AS steam_kg
         FROM process_signals_5min
         WHERE timestamp >= $1 AND timestamp < ($2::date + INTERVAL '1 day')
       ),
       prod AS (
         SELECT SUM(batch_size_actual_kg)/1000.0 AS tons
         FROM batches
         WHERE start_time >= $1 AND start_time < ($2::date + INTERVAL '1 day')
       )
       SELECT ROUND(steam_sum.steam_kg / NULLIF(prod.tons,0),2) AS steam_kg_per_t
       FROM steam_sum, prod;`,
      [start, end]
    );

    const sp_pv = await pool.query(
      `SELECT 
         ROUND(AVG(cond_temp_sp_C)::numeric, 2) AS avg_sp,
         ROUND(AVG(cond_temp_pv_C)::numeric, 2) AS avg_pv,
         ROUND((AVG(cond_temp_pv_C) - AVG(cond_temp_sp_C)) / NULLIF(AVG(cond_temp_sp_C), 0) * 100, 2) AS sp_vs_pv_pct
       FROM process_signals_5min
       WHERE timestamp >= $1 AND timestamp < ($2::date + INTERVAL '1 day');`,
      [start, end]
    );

    const stability = await pool.query(
      `SELECT line,
              ROUND(STDDEV_POP(cond_temp_pv_C - cond_temp_sp_C)::numeric,3) AS sigma,
              ROUND(100.0 * SUM(CASE WHEN ABS(cond_temp_pv_C - cond_temp_sp_C) <= 2 THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(*),0),2) AS pct_within_2C
       FROM process_signals_5min
       WHERE timestamp >= $1 AND timestamp < ($2::date + INTERVAL '1 day')
       GROUP BY line;`,
      [start, end]
    );

    res.json({
      steam: {
        steam_kg_per_t: steam.rows[0]?.steam_kg_per_t || 0,
        sp: sp_pv.rows[0]?.avg_sp || 0,
        pv: sp_pv.rows[0]?.avg_pv || 0,
        sp_vs_pv: sp_pv.rows[0]?.sp_vs_pv_pct || 0
      },
      stability: stability.rows
    });
  } catch (err) {
    console.error("Steam Error:", err);
    res.status(500).json({ error: err.message });
  }
};

/* 4️⃣ Availability */
export const getAvailability = async (req, res) => {
  const { start, end } = getDateRange(req);
  try {
    const rows = await pool.query(
      `WITH sched_state AS (
         SELECT s.line, s.timestamp, s.state
         FROM line_states_5min s
         JOIN orders o ON s.line = o.line
           AND s.timestamp >= o.start_time
           AND s.timestamp < o.end_time
         WHERE o.start_time >= $1 AND o.start_time < ($2::date + INTERVAL '1 day')
       )
       SELECT line AS line_id,
         ROUND(100.0 * SUM(CASE WHEN state='RUN' THEN 5 ELSE 0 END)::numeric / NULLIF(SUM(5),0),2) AS run_availability_pct
       FROM sched_state
       GROUP BY line
       ORDER BY line;`,
      [start, end]
    );
    res.json(rows.rows);
  } catch (err) {
    console.error("Availability Error:", err);
    res.status(500).json({ error: err.message });
  }
};

/* 5️⃣ Quality (Fixed ROUND issue) */
export const getQuality = async (req, res) => {
  const { start, end } = getDateRange(req);
  try {
    const result = await pool.query(
      `SELECT
        COUNT(*) AS total_samples,
        ROUND(SUM(CASE WHEN disposition = 'ACCEPT' THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(*), 0) * 100, 2) AS fpy_percent,
        COUNT(CASE WHEN disposition = 'HOLD' THEN 1 END) AS holds
      FROM quality_results
      WHERE timestamp >= $1 AND timestamp < ($2::date + INTERVAL '1 day');`,
      [start, end]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Quality Error:", err);
    res.status(500).json({ error: err.message });
  }
};

/* 6️⃣ Recipe Adherence */
export const getRecipeAdherence = async (req, res) => {
  try {
    const result = await pool.query(`
      WITH dev AS (
        SELECT
          b.product_code,
          bw.ingredient_code,
          ((bw.actual_kg - bw.target_kg) / NULLIF(bw.target_kg, 0)) * 100 AS deviation_pct
        FROM batch_weighments bw
        JOIN batches b ON bw.batch_id = b.batch_id
        WHERE bw.target_kg > 0
      ),
      tolerance AS (
        SELECT
          d.*,
          CASE
            WHEN ingredient_code LIKE 'RM-%' THEN 0.5
            WHEN ingredient_code LIKE 'LIQ-%' THEN 0.6
            ELSE 1.0
          END AS tol
        FROM dev d
      ),
      stats AS (
        SELECT
          product_code,
          COUNT(DISTINCT ingredient_code) AS ingredients,
          ROUND(AVG(ABS(deviation_pct))::numeric, 2) AS avg_deviation,
          ROUND(MAX(ABS(deviation_pct))::numeric, 2) AS worst_deviation,
          ROUND(100.0 * SUM(CASE WHEN ABS(deviation_pct) <= tol THEN 1 ELSE 0 END)::numeric / COUNT(*), 1)
            AS compliance_pct
        FROM tolerance
        GROUP BY product_code
      ),
      worst_ing AS (
        SELECT DISTINCT ON (product_code)
          product_code,
          ingredient_code AS worst_ingredient,
          ROUND(AVG(ABS(deviation_pct))::numeric, 2) AS worst_dev
        FROM tolerance
        GROUP BY product_code, ingredient_code
        ORDER BY product_code, worst_dev DESC
      )
      SELECT
        s.product_code,
        s.ingredients,
        s.avg_deviation,
        s.worst_deviation,
        s.compliance_pct,
        wi.worst_ingredient
      FROM stats s
      LEFT JOIN worst_ing wi USING (product_code)
      ORDER BY s.product_code;
    `);

    res.json(result.rows);
  } catch (err) {
    console.error("Recipe Adherence Error:", err);
    res.status(500).json({ error: err.message });
  }
};

/* 7️⃣ Silos & Materials */
export const getSilos = async (req, res) => {
  try {
    const avgCons = await pool.query(`
      WITH daily AS (
        SELECT
          TRIM(ingredient_code) AS material_code,
          DATE_TRUNC('day', weigh_time)::date AS day,
          SUM(actual_kg) / 1000.0 AS tons_day
        FROM batch_weighments
        WHERE weigh_time >= (CURRENT_DATE - INTERVAL '7 day')
        GROUP BY ingredient_code, day
      )
      SELECT
        material_code,
        GREATEST(AVG(tons_day), 0.001) AS avg_daily_t
      FROM daily
      GROUP BY material_code;
    `);

    const latestInv = await pool.query(`
      SELECT
        TRIM(s.material_code) AS material_code,
        SUM(GREATEST(sl.inventory_t, 0)) AS inventory_t,
        ROUND(AVG(sl.level_pct)::numeric, 1) AS level_pct
      FROM silos s
      JOIN silo_levels_15min sl ON s.silo_id = sl.silo_id
      WHERE sl.timestamp = (
        SELECT MAX(sl2.timestamp)
        FROM silo_levels_15min sl2
        WHERE sl2.silo_id = sl.silo_id
      )
      GROUP BY s.material_code;
    `);

    const avgMap = new Map(avgCons.rows.map(r => [r.material_code.trim(), r.avg_daily_t]));
    const docData = latestInv.rows.map(row => {
      const avgDaily = avgMap.get(row.material_code.trim()) || 0.001;
      const inventoryT = parseFloat(row.inventory_t) || 0;
      const levelPct = parseFloat(row.level_pct) || 0;
      return {
        material_code: row.material_code,
        inventory_t: inventoryT.toFixed(2),
        level_pct: levelPct.toFixed(1),
        days_of_cover: (inventoryT / avgDaily).toFixed(1)
      };
    });

    const events = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE event_type = 'LOW_LEVEL') AS low_level_count,
        COUNT(*) FILTER (WHERE event_type = 'CHANGEOVER') AS changeover_count
      FROM silo_events
      WHERE timestamp >= NOW() - INTERVAL '7 days';
    `);

    res.json({
      doc: docData,
      events: events.rows[0] || { low_level_count: 0, changeover_count: 0 }
    });
  } catch (err) {
    console.error("Silos Error:", err);
    res.status(500).json({ error: err.message });
  }
};

/* 8️⃣ Reliability */
export const getReliability = async (req, res) => {
  const { start, end } = getDateRange(req);
  try {
    const pareto = await pool.query(
      `SELECT reason_code AS reason, SUM(EXTRACT(EPOCH FROM (end_time - start_time))/60.0) AS total_min
       FROM downtime_events
       WHERE start_time >= $1 AND start_time < ($2::date + INTERVAL '1 day')
       GROUP BY reason_code
       ORDER BY total_min DESC LIMIT 10;`,
      [start, end]
    );

    const downtimePct = await pool.query(
      `WITH sched AS (
         SELECT SUM(EXTRACT(EPOCH FROM (end_time - start_time))/60.0) AS sched_min
         FROM orders
         WHERE start_time >= $1 AND start_time < ($2::date + INTERVAL '1 day')
       ), down AS (
         SELECT SUM(EXTRACT(EPOCH FROM (end_time - start_time))/60.0) AS down_min
         FROM downtime_events
         WHERE start_time >= $1 AND start_time < ($2::date + INTERVAL '1 day')
       )
       SELECT ROUND(100.0 * down.down_min / NULLIF(sched.sched_min,0),3) AS downtime_pct FROM down, sched;`,
      [start, end]
    );

    res.json({ pareto: pareto.rows, downtime_pct: downtimePct.rows[0]?.downtime_pct ?? null });
  } catch (err) {
    console.error("Reliability Error:", err);
    res.status(500).json({ error: err.message });
  }
};

/* 9️⃣ Packaging (Fixed ROUND issue) */
export const getPackaging = async (req, res) => {
  const { start, end } = getDateRange(req);
  try {
    const result = await pool.query(
      `SELECT
        SUM(bag_count) AS total_bags,
        ROUND(SUM(rework_bags)::numeric / NULLIF(SUM(bag_count), 0) * 100, 2) AS rework_percent,
        ROUND(AVG(avg_bag_weight_kg)::numeric, 2) AS avg_bag_weight
      FROM bagging
      WHERE start_time >= $1 AND end_time < ($2::date + INTERVAL '1 day');`,
      [start, end]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Packaging Error:", err);
    res.status(500).json({ error: err.message });
  }
};
