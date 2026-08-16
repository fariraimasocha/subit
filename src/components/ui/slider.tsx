import * as React from 'react'
import { Slider as SliderPrimitive } from '@cloudflare/kumo/primitives/slider'
import { cn } from '~/lib/utils'

type SliderProps = Omit<React.ComponentProps<typeof SliderPrimitive.Root>, 'onValueChange' | 'value' | 'defaultValue'> & {
  value?: number[]
  defaultValue?: number[]
  onValueChange?: (value: number[]) => void
}

function Slider({
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  onValueChange,
  ...props
}: SliderProps) {
  const values = React.useMemo(
    () => (Array.isArray(value) ? value : Array.isArray(defaultValue) ? defaultValue : [min]),
    [value, defaultValue, min],
  )

  const handleChange = (next: number | readonly number[] | number[]) => {
    if (typeof next === 'number') {
      onValueChange?.([next])
      return
    }
    onValueChange?.([...next])
  }

  return (
    <SliderPrimitive.Root
      value={values}
      defaultValue={defaultValue}
      min={min}
      max={max}
      onValueChange={handleChange}
      className={cn('relative flex w-full touch-none items-center select-none', className)}
      {...props}
    >
      <SliderPrimitive.Control className="relative flex w-full grow items-center">
        <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-muted">
          <SliderPrimitive.Indicator className="absolute h-full bg-brand" />
        </SliderPrimitive.Track>
        {values.map((_, index) => (
          <SliderPrimitive.Thumb
            key={index}
            className="block size-4 shrink-0 rounded-full border-2 border-brand bg-background shadow-sm focus-visible:outline-2 focus-visible:outline-brand"
          />
        ))}
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  )
}

export { Slider }
