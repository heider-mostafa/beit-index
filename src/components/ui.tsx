import * as React from 'react';
import { cn } from '@/src/lib/utils';
import { ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';

/**
 * BUTTON
 */
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'emerald';
  withArrow?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', withArrow, children, ...props }, ref) => {
    const variants = {
      primary: 'bg-emerald-500 text-cream-50 hover:bg-emerald-600',
      secondary: 'border-hairline text-ink-600 bg-transparent hover:bg-cream-200',
      ghost: 'text-ink-400 hover:text-ink-600 transition-colors bg-transparent p-0',
      emerald: 'bg-emerald-500 text-cream-50 hover:bg-emerald-600',
    };

    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center rounded-[4px] text-[13px] font-medium transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 px-5 py-2.5',
          variants[variant],
          className
        )}
        {...props}
      >
        {children}
        {withArrow && <ArrowRight className="ms-2 h-4 w-4" />}
      </button>
    );
  }
);
Button.displayName = 'Button';

/**
 * INPUT
 */
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="eyebrow mb-2 block">
            {label}
          </label>
        )}
        <input
          className={cn(
            'flex w-full bg-transparent border-b border-ink-200 rounded-none px-0 py-2.5 text-base focus:border-emerald-500 outline-none transition-colors placeholder:text-ink-100',
            className
          )}
          ref={ref}
          {...props}
        />
      </div>
    );
  }
);
Input.displayName = 'Input';

/**
 * CARD
 */
interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'bg-cream-50 border-hairline rounded-md p-6 transition-colors hover:border-ink-200 shadow-sm',
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
Card.displayName = 'Card';

/**
 * BADGE / CHIP
 */
interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  children: React.ReactNode;
}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn(
          'inline-flex items-center px-2 py-0.5 rounded-[2px] text-[10px] font-medium bg-ink-50 text-ink-300 uppercase tracking-wider',
          className
        )}
        {...props}
      >
        {children}
      </span>
    );
  }
);
Badge.displayName = 'Badge';
