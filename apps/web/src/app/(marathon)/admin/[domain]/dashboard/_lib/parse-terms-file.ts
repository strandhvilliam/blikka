import mammoth from 'mammoth'
import TurndownService from 'turndown'

export async function parseTermsFile(file: File): Promise<string> {
  const extension = file.name.split('.').pop()?.toLowerCase()

  if (extension === 'md' || extension === 'txt') {
    return file.text()
  }

  if (extension === 'docx') {
    const arrayBuffer = await file.arrayBuffer()
    const { value } = await mammoth.convertToHtml({ arrayBuffer })
    const turndownService = new TurndownService()
    return turndownService.turndown(value || '')
  }

  throw new Error('Unsupported file type')
}
