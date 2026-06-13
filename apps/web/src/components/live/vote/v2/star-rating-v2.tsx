'use client'

import { useTranslations } from 'next-intl'
import { motion } from 'motion/react'
import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StarRatingV2Props {
  value?: number
  onChange?: (value: number) => void
  disabled?: boolean
  className?: string
}

export function StarRatingV2({ value, onChange, disabled = false, className }: StarRatingV2Props) {
  const t = useTranslations('VotingViewerPage')
  const displayValue = value ?? 0

  return (
    <div className={cn('flex items-center justify-center', className)}>
      {[1, 2, 3, 4, 5].map((rating) => {
        const isFilled = displayValue >= rating
        return (
          <motion.button
            key={rating}
            type="button"
            disabled={disabled}
            onClick={() => onChange?.(rating)}
            whileTap={disabled ? undefined : { scale: 0.8 }}
            className={cn(
              'flex h-12 w-11 items-center justify-center disabled:cursor-not-allowed',
              disabled && 'opacity-40',
            )}
            aria-label={t('starRating.rateStars', { rating })}
            aria-pressed={isFilled}
          >
            <motion.span
              animate={isFilled ? { scale: [1, 1.25, 1] } : { scale: 1 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="flex"
            >
              <Star
                className={cn(
                  'h-8 w-8 transition-colors duration-150',
                  isFilled
                    ? 'fill-amber-400 text-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.45)]'
                    : 'fill-transparent text-white/40',
                )}
              />
            </motion.span>
          </motion.button>
        )
      })}
    </div>
  )
}
