import { motion } from 'framer-motion';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';

export default function StatCard({ title, value, icon: Icon, trend, trendLabel, color = 'emerald', delay = 0 }) {
  const isUp = trend && trend.startsWith('+');
  const isDown = trend && trend.startsWith('-');

  return (
    <motion.div
      className="stat-card"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
    >
      <div className="stat-top">
        <span className="stat-label">{title}</span>
        <div className={`stat-icon-wrapper ${color}`}>
          {Icon && <Icon size={22} />}
        </div>
      </div>

      <div className="stat-value">{value}</div>

      {trend && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: -4 }}>
          <span className={`stat-trend ${isUp ? 'up' : isDown ? 'down' : 'neutral'}`}>
            {isUp && <ArrowUpRight size={13} />}
            {isDown && <ArrowDownRight size={13} />}
            {!isUp && !isDown && <Minus size={13} />}
            {trend}
          </span>
          {trendLabel && (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{trendLabel}</span>
          )}
        </div>
      )}
    </motion.div>
  );
}
