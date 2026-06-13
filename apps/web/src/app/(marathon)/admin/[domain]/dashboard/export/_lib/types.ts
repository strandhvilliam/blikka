import { LucideIcon } from 'lucide-react'

interface SelectOption {
  value: string
  label: string
}

export interface ExportTypeConfig {
  id: string
  title: string
  description: string
  icon: LucideIcon
  exportType: string
  downloadName?: string
  accentColor: string
  formatOptions?: SelectOption[]
  validationOptions?: SelectOption[]
  fileFormatOptions?: SelectOption[]
}
