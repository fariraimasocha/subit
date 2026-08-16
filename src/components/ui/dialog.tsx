import * as React from 'react'
import { X } from '@phosphor-icons/react'
import {
  Dialog as KumoDialogPanel,
  DialogClose as KumoDialogClose,
  DialogDescription as KumoDialogDescription,
  DialogRoot,
  DialogTitle as KumoDialogTitle,
  DialogTrigger as KumoDialogTrigger,
} from '@cloudflare/kumo/components/dialog'
import { Button as KumoButton } from '@cloudflare/kumo/components/button'
import { cn } from '~/lib/utils'

function DialogDomProbe() {
  React.useEffect(() => {
    const id = window.requestAnimationFrame(() => {
      const dialog = document.querySelector('[role="dialog"]')
      const buttons = dialog
        ? Array.from(dialog.querySelectorAll('button')).map((b) => ({
            text: (b.textContent ?? '').trim(),
            aria: b.getAttribute('aria-label'),
            w: Math.round(b.getBoundingClientRect().width),
            h: Math.round(b.getBoundingClientRect().height),
            kumo: b.getAttribute('data-kumo-component'),
            part: b.getAttribute('data-kumo-part'),
          }))
        : []
      const payload = {
        title: dialog?.querySelector('h2')?.textContent ?? null,
        buttonCount: buttons.length,
        buttons,
        hasKeepIt: buttons.some((b) => b.text === 'Keep it'),
        emptyLabeled: buttons.filter((b) => !b.text && b.aria !== 'Close').length,
      }
      // #region agent log
      fetch('http://127.0.0.1:7798/ingest/24c2d816-da87-4d95-aeda-612f37f3fd00',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d8dc48'},body:JSON.stringify({sessionId:'d8dc48',runId:'post-fix-4',hypothesisId:'F',location:'dialog.tsx:DialogDomProbe',message:'Dialog DOM snapshot',data:payload,timestamp:Date.now()})}).catch(()=>{});
      // #endregion
    })
    return () => window.cancelAnimationFrame(id)
  }, [])
  return null
}

function Dialog({
  ...props
}: React.ComponentProps<typeof DialogRoot>) {
  return <DialogRoot {...props} />
}

function DialogTrigger({ children, ...props }: React.ComponentProps<typeof KumoDialogTrigger>) {
  return <KumoDialogTrigger {...props}>{children}</KumoDialogTrigger>
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof KumoDialogPanel> & { showCloseButton?: boolean }) {
  return (
    <KumoDialogPanel className={cn('relative p-6', className)} size="lg" {...props}>
      <DialogDomProbe />
      {children}
      {showCloseButton && (
        <KumoDialogClose
          aria-label="Close"
          render={(closeProps) => (
            <KumoButton
              {...closeProps}
              variant="secondary"
              shape="square"
              className="absolute top-4 right-4"
              aria-label="Close"
            >
              <X className="size-4" />
            </KumoButton>
          )}
        />
      )}
    </KumoDialogPanel>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('flex flex-col gap-2 text-center sm:text-left', className)} {...props} />
}

function DialogFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div className={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)} {...props} />
  )
}

function DialogTitle({ className, ...props }: React.ComponentProps<typeof KumoDialogTitle>) {
  return <KumoDialogTitle className={cn('text-lg font-semibold leading-none', className)} {...props} />
}

function DialogDescription({ className, ...props }: React.ComponentProps<typeof KumoDialogDescription>) {
  return <KumoDialogDescription className={cn('text-sm text-muted-foreground', className)} {...props} />
}

function DialogClose({
  asChild,
  children,
  ...props
}: React.ComponentProps<'button'> & { asChild?: boolean }) {
  return (
    <KumoDialogClose
      render={(closeProps) => {
        const childEl = asChild && React.isValidElement(children) ? children : null
        const originalChildText = childEl
          ? typeof (childEl.props as { children?: unknown }).children === 'string'
            ? (childEl.props as { children: string }).children
            : typeof (childEl.props as { children?: unknown }).children
          : typeof children === 'string'
            ? children
            : typeof children
        const closePropKeys = Object.keys(closeProps as object)
        const closeChildren = (closeProps as { children?: unknown }).children
        // #region agent log
        fetch('http://127.0.0.1:7798/ingest/24c2d816-da87-4d95-aeda-612f37f3fd00',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d8dc48'},body:JSON.stringify({sessionId:'d8dc48',runId:'post-fix',hypothesisId:'A',location:'dialog.tsx:DialogClose',message:'DialogClose render props',data:{asChild:!!asChild,hasValidChild:!!childEl,originalChildText,closePropKeys,hasCloseChildren:Object.prototype.hasOwnProperty.call(closeProps,'children'),closeChildrenType:typeof closeChildren,closeChildrenIsUndefined:closeChildren===undefined,closeChildrenIsNull:closeChildren===null,shape:(closeProps as {shape?:unknown}).shape,size:(closeProps as {size?:unknown}).size,icon:typeof (closeProps as {icon?:unknown}).icon,nativeButton:(closeProps as {nativeButton?:unknown}).nativeButton},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        if (childEl) {
          const { children: _closeChildren, ...safeCloseProps } = closeProps as typeof closeProps & {
            children?: unknown
          }
          const child = childEl as React.ReactElement<{ children?: React.ReactNode }>
          const cloned = React.cloneElement(child, {
            ...safeCloseProps,
            ...props,
            children: child.props.children,
          })
          const clonedChildren = (cloned.props as { children?: unknown }).children
          // #region agent log
          fetch('http://127.0.0.1:7798/ingest/24c2d816-da87-4d95-aeda-612f37f3fd00',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d8dc48'},body:JSON.stringify({sessionId:'d8dc48',runId:'post-fix',hypothesisId:'A',location:'dialog.tsx:DialogClose:clone',message:'cloneElement result children',data:{clonedChildrenType:typeof clonedChildren,clonedChildrenIsUndefined:clonedChildren===undefined,clonedChildrenIsNull:clonedChildren===null,clonedText:typeof clonedChildren==='string'?clonedChildren:null,childrenWiped:originalChildText==='Keep it'&&clonedChildren!=='Keep it'},timestamp:Date.now()})}).catch(()=>{});
          // #endregion
          return cloned
        }
        return (
          <KumoButton {...closeProps} {...props}>
            {children}
          </KumoButton>
        )
      }}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
}
