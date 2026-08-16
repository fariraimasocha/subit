import * as React from 'react'
import { Button as KumoButton, LinkButton, type ButtonProps as KumoButtonProps } from '@cloudflare/kumo/components/button'
import { cn } from '~/lib/utils'

type Variant = 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
type Size = 'default' | 'xs' | 'sm' | 'lg' | 'icon' | 'icon-xs' | 'icon-sm' | 'icon-lg'

const variantMap: Record<Variant, KumoButtonProps['variant']> = {
  // Secondary avoids Kumo primary's blue emphasis gradient; brand color comes from subit-btn-brand.
  default: 'secondary',
  destructive: 'destructive',
  outline: 'outline',
  secondary: 'secondary',
  ghost: 'ghost',
  link: 'ghost',
}

const sizeMap: Record<Exclude<Size, 'icon' | 'icon-xs' | 'icon-sm' | 'icon-lg'>, KumoButtonProps['size']> = {
  default: 'base',
  xs: 'xs',
  sm: 'sm',
  lg: 'lg',
}

/** Subit tokens win over Kumo defaults so CTAs stay brand-orange and outlines stay readable on dark surfaces. */
const variantClass: Record<Variant, string> = {
  default: 'subit-btn-brand shadow-none ring-1 ring-brand/40',
  destructive: '',
  outline:
    'border border-white/10 !bg-transparent !text-foreground ring-white/10 hover:!bg-surface-2 hover:!text-foreground',
  secondary: '!bg-surface-2 !text-foreground ring-white/10 hover:!bg-surface-3',
  ghost: '!bg-transparent !text-foreground hover:!bg-surface-2 hover:!text-foreground shadow-none',
  link: '!bg-transparent !text-brand underline underline-offset-4 hover:!text-brand/90 shadow-none ring-0',
}

const iconSizeClass: Partial<Record<Size, string>> = {
  icon: 'size-9 justify-center p-0',
  'icon-xs': 'size-6 justify-center p-0',
  'icon-sm': 'size-8 justify-center p-0',
  'icon-lg': 'size-10 justify-center p-0',
}

function kumoSize(size: Size, iconOnly: boolean): KumoButtonProps['size'] {
  if (iconOnly) return 'base'
  if (size in sizeMap) return sizeMap[size as keyof typeof sizeMap]
  return 'base'
}

function buttonClassName(variant: Variant, size: Size, iconOnly: boolean, className?: string) {
  return cn(
    variantClass[variant],
    iconOnly ? iconSizeClass[size] : 'justify-center',
    className,
  )
}

type Props = React.ComponentProps<'button'> & {
  variant?: Variant
  size?: Size
  asChild?: boolean
  loading?: boolean
}

function Button({
  className,
  variant = 'default',
  size = 'default',
  asChild,
  children,
  loading,
  title,
  ...props
}: Omit<React.ComponentProps<'button'>, 'title'> & {
  variant?: Variant
  size?: Size
  asChild?: boolean
  loading?: boolean
  title?: string
}) {
  const kumoVariant = variantMap[variant]
  const iconOnly = size === 'icon' || size === 'icon-xs' || size === 'icon-sm' || size === 'icon-lg'
  const childCount = React.Children.count(children)
  // #region agent log
  if (variant === 'outline' || variant === 'destructive' || childCount === 0) {
    fetch('http://127.0.0.1:7798/ingest/24c2d816-da87-4d95-aeda-612f37f3fd00',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d8dc48'},body:JSON.stringify({sessionId:'d8dc48',runId:'post-fix-3',hypothesisId:'C',location:'button.tsx:Button',message:'Button render children/shape',data:{variant,size,iconOnly,childCount,childrenType:typeof children,childrenIsUndefined:children===undefined,text:typeof children==='string'?children:null,shapeFromProps:(props as {shape?:unknown}).shape,iconFromProps:typeof (props as {icon?:unknown}).icon},timestamp:Date.now()})}).catch(()=>{});
  }
  // #endregion

  if (asChild && React.isValidElement(children)) {
    const child = children as React.ReactElement<{
      className?: string
      to?: string
      href?: string
      children?: React.ReactNode
    }>
    const href = child.props.href ?? child.props.to
    if (href) {
      return (
        <LinkButton
          href={href}
          variant={kumoVariant}
          size={kumoSize(size, iconOnly)}
          shape={iconOnly ? 'square' : 'base'}
          className={buttonClassName(variant, size, iconOnly, cn(className, child.props.className))}
          {...(props as object)}
        >
          {child.props.children}
        </LinkButton>
      )
    }
    return React.cloneElement(child, {
      className: cn(className, child.props.className),
      ...props,
    })
  }

  return (
    <KumoButton
      variant={kumoVariant}
      size={kumoSize(size, iconOnly)}
      shape={iconOnly ? 'square' : 'base'}
      loading={loading}
      {...(title !== undefined ? { title } : {})}
      className={buttonClassName(variant, size, iconOnly, className)}
      {...(props as KumoButtonProps)}
    >
      {children}
    </KumoButton>
  )
}

export { Button }
