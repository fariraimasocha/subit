import { Table as KumoTable } from '@cloudflare/kumo/components/table'
import { cn } from '~/lib/utils'

function Table({ className, ...props }: React.ComponentProps<typeof KumoTable>) {
  return (
    <KumoTable
      className={cn(
        'text-foreground [&_th]:bg-surface-2 [&_th]:text-foreground [&_td]:text-foreground',
        className,
      )}
      {...props}
    />
  )
}

const TableHeader = KumoTable.Header
const TableBody = KumoTable.Body
const TableFooter = KumoTable.Footer
const TableRow = KumoTable.Row
const TableHead = KumoTable.Head
const TableCell = KumoTable.Cell

export { Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell }
