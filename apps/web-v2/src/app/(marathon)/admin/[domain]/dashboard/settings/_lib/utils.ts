export function getAvailableLanguages() {
  return [
  { code: "en", name: "English" },
  { code: "sv", name: "Swedish" },
  { code: "es", name: "Spanish" },
  { code: "de", name: "German" },
  { code: "fr", name: "French" },
  { code: "it", name: "Italian" },
  { code: "pt", name: "Portuguese" },
  { code: "nl", name: "Dutch" },
  { code: "no", name: "Norwegian" },
  { code: "da", name: "Danish" },
  { code: "fi", name: "Finnish" },
  { code: "pl", name: "Polish" },
  ]
}

export function isDateDifferent(
  date1: Date | null | undefined,
  date2: string | null | undefined,
): boolean {
  if (!date1 && !date2) return false
  if (!date1 || !date2) return true

  return new Date(date1).getTime() !== new Date(date2).getTime()
}

export function arrayEquals(a: string[], b: string[]): boolean {
  return (
    Array.isArray(a) &&
    Array.isArray(b) &&
    a.length === b.length &&
    a.every((val, index) => val === b[index])
  )
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

export function createStartTimeSetDate(
  currentStartDate: Date | null,
  endDate: Date | null,
  onStartChange: (date: Date) => void,
  onEndChange: (date: Date) => void,
) {
  return (date: Date | undefined) => {
    if (!date || !currentStartDate) return
    const newDate = new Date(currentStartDate)
    newDate.setHours(date.getHours())
    newDate.setMinutes(date.getMinutes())

    if (endDate && isSameDay(newDate, endDate) && newDate >= endDate) {
      const updatedEnd = new Date(newDate)
      updatedEnd.setHours(updatedEnd.getHours() + 1)
      onEndChange(updatedEnd)
    }
    onStartChange(newDate)
  }
}

export function createEndTimeSetDate(
  currentEndDate: Date | null,
  startDate: Date | null,
  onEndChange: (date: Date) => void,
) {
  return (date: Date | undefined) => {
    if (!date || !currentEndDate) return
    const newDate = new Date(currentEndDate)
    newDate.setHours(date.getHours())
    newDate.setMinutes(date.getMinutes())

    if (startDate && isSameDay(newDate, startDate) && newDate <= startDate) {
      return
    }
    onEndChange(newDate)
  }
}

export function createStartDateCalendarOnSelect(
  currentStartDate: Date | null,
  endDate: Date | null,
  onStartChange: (date: Date) => void,
  setEndDate: (date: Date) => void,
) {
  return (date: Date | undefined) => {
    if (!date) return
    const newDate = new Date(date)
    if (currentStartDate) {
      newDate.setHours(currentStartDate.getHours())
      newDate.setMinutes(currentStartDate.getMinutes())
    } else {
      newDate.setHours(12)
      newDate.setMinutes(0)
    }
    onStartChange(newDate)

    if (endDate && endDate < newDate) {
      const suggestedEndDate = new Date(newDate)
      suggestedEndDate.setHours(suggestedEndDate.getHours() + 1)
      setEndDate(suggestedEndDate)
    }
  }
}

export function createEndDateCalendarOnSelect(
  currentEndDate: Date | null,
  startDate: Date | null,
  onEndChange: (date: Date) => void,
) {
  return (date: Date | undefined) => {
    if (!date) return
    const newDate = new Date(date)
    if (currentEndDate) {
      newDate.setHours(currentEndDate.getHours())
      newDate.setMinutes(currentEndDate.getMinutes())
    } else {
      newDate.setHours(13)
      newDate.setMinutes(0)
    }

    if (
      startDate &&
      date.getFullYear() === startDate.getFullYear() &&
      date.getMonth() === startDate.getMonth() &&
      date.getDate() === startDate.getDate()
    ) {
      if (newDate <= startDate) {
        newDate.setHours(startDate.getHours() + 1)
        newDate.setMinutes(startDate.getMinutes())
      }
    }

    onEndChange(newDate)
  }
} 