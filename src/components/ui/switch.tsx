import * as React from 'react'
import { Switch as KumoSwitch } from '@cloudflare/kumo/components/switch'

function Switch({
  id,
  checked,
  onCheckedChange,
  disabled,
  className,
}: {
  id?: string
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
  disabled?: boolean
  className?: string
}) {
  return (
    <KumoSwitch
      id={id}
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      className={className}
      controlFirst
    />
  )
}

export { Switch }
