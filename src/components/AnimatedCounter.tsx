import * as React from 'react';
import { motion, useInView, useSpring, useTransform } from 'motion/react';

interface AnimatedCounterProps {
  value: number;
  suffix?: string;
  prefix?: string;
  duration?: number;
  decimals?: number;
  className?: string;
}

export const AnimatedCounter: React.FC<AnimatedCounterProps> = ({
  value,
  suffix = '',
  prefix = '',
  duration = 2,
  decimals = 0,
  className = '',
}) => {
  const ref = React.useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-50px' });

  const spring = useSpring(0, {
    duration: duration * 1000,
    bounce: 0,
  });

  const display = useTransform(spring, (current) => {
    return `${prefix}${current.toFixed(decimals)}${suffix}`;
  });

  React.useEffect(() => {
    if (isInView) {
      spring.set(value);
    }
  }, [isInView, spring, value]);

  return (
    <motion.span ref={ref} className={className}>
      {display}
    </motion.span>
  );
};

interface StatCardProps {
  value: number;
  suffix?: string;
  prefix?: string;
  label: string;
  sublabel?: string;
  delay?: number;
}

export const StatCard: React.FC<StatCardProps> = ({
  value,
  suffix = '',
  prefix = '',
  label,
  sublabel,
  delay = 0,
}) => {
  const ref = React.useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-50px' });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
      transition={{ duration: 0.5, delay }}
      className="text-center"
    >
      <div className="text-4xl md:text-5xl font-serif font-medium text-ink-600 mb-2">
        <AnimatedCounter
          value={value}
          suffix={suffix}
          prefix={prefix}
          duration={2}
        />
      </div>
      <div className="text-sm font-medium text-ink-500 uppercase tracking-wider">
        {label}
      </div>
      {sublabel && (
        <div className="text-xs text-ink-300 mt-1">{sublabel}</div>
      )}
    </motion.div>
  );
};

export default AnimatedCounter;
