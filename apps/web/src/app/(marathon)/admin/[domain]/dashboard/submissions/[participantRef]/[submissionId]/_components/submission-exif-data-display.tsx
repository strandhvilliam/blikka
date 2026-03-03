import { format } from "date-fns"
import { Camera, FileSpreadsheet, ImageIcon, InfoIcon, ListFilter, MapPin } from "lucide-react"

export function SubmissionExifDataDisplay({ exifData }: { exifData: any }) {
  if (!exifData || Object.keys(exifData).length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <div className="mb-2">
          <InfoIcon className="h-10 w-10 mx-auto text-muted-foreground/30" />
        </div>
        <h3 className="text-base font-semibold font-gothic mb-1">No EXIF data available</h3>
        <p className="text-xs">
          This image does not contain EXIF metadata or it couldn't be extracted.
        </p>
      </div>
    )
  }

  const groups = {
    basic: {
      title: "Basic Information",
      icon: <FileSpreadsheet className="h-4 w-4" />,
      keys: ["Make", "Model", "Software", "CreateDate", "ModifyDate", "Artist", "Copyright"],
    },
    camera: {
      title: "Camera Settings",
      icon: <Camera className="h-4 w-4" />,
      keys: [
        "ExposureTime",
        "FNumber",
        "ISO",
        "ExposureProgram",
        "FocalLength",
        "LensModel",
        "Flash",
        "WhiteBalance",
      ],
    },
    location: {
      title: "Location Data",
      icon: <MapPin className="h-4 w-4" />,
      keys: [
        "GPSLatitude",
        "GPSLongitude",
        "GPSAltitude",
        "GPSDateStamp",
        "GPSTimeStamp",
        "GPSProcessingMethod",
      ],
    },
    image: {
      title: "Image Properties",
      icon: <ImageIcon className="h-4 w-4" />,
      keys: [
        "ImageWidth",
        "ImageHeight",
        "BitsPerSample",
        "ColorSpace",
        "Compression",
        "Orientation",
      ],
    },
  }

  const formatExifValue = (key: string, value: any) => {
    if (value === undefined || value === null) return "Not available"

    if (typeof value === "object" && !Array.isArray(value)) {
      return (
        <div className="pl-2 border-l-2 border-border mt-1 space-y-1">
          {Object.entries(value).map(([nestedKey, nestedValue]) => (
            <div key={nestedKey} className="text-xs">
              <span className="text-muted-foreground">
                {nestedKey.replace(/([A-Z])/g, " $1").trim()}:{" "}
              </span>
              <span>{formatNestedValue(nestedValue)}</span>
            </div>
          ))}
        </div>
      )
    }

    if (Array.isArray(value)) {
      return (
        <div className="pl-2 border-l-2 border-border mt-1 space-y-1">
          {value.map((item, index) => (
            <div key={index} className="text-xs">
              <span className="text-muted-foreground">{index}: </span>
              <span>{formatNestedValue(item)}</span>
            </div>
          ))}
        </div>
      )
    }

    if (key === "ExposureTime" && typeof value === "number") {
      if (value >= 1) return `${value} sec`
      return `1/${Math.round(1 / value)} sec`
    }

    if (key === "FNumber" && typeof value === "number") {
      return `f/${value.toFixed(1)}`
    }

    if (key === "FocalLength" && typeof value === "number") {
      return `${value} mm`
    }

    if ((key.includes("Date") || key.includes("Time")) && typeof value === "string") {
      try {
        const date = new Date(value)
        if (!isNaN(date.getTime())) {
          return format(date, "MMM d, yyyy HH:mm:ss")
        }
      } catch (e) {
        return value
      }
    }

    return value.toString()
  }

  const formatNestedValue = (value: any): string | React.ReactNode => {
    if (value === undefined || value === null) return "Not available"

    if (typeof value === "object" && !Array.isArray(value)) {
      return (
        <div className="pl-2 border-l-2 border-border mt-1 space-y-1">
          {Object.entries(value).map(([nestedKey, nestedValue]) => (
            <div key={nestedKey} className="text-xs">
              <span className="text-muted-foreground">
                {nestedKey.replace(/([A-Z])/g, " $1").trim()}:{" "}
              </span>
              <span>{formatNestedValue(nestedValue)}</span>
            </div>
          ))}
        </div>
      )
    }

    if (Array.isArray(value)) {
      if (value.length === 0) return "[]"

      return (
        <div className="pl-2 border-l-2 border-border mt-1 space-y-1">
          {value.map((item, index) => (
            <div key={index} className="text-xs">
              <span className="text-muted-foreground">{index}: </span>
              <span>{formatNestedValue(item)}</span>
            </div>
          ))}
        </div>
      )
    }

    return value.toString()
  }

  const groupedKeys = Object.values(groups).flatMap((group) => group.keys)
  const otherKeys = Object.keys(exifData).filter((key) => !groupedKeys.includes(key))

  return (
    <div className="space-y-4">
      {Object.entries(groups).map(([groupKey, group]) => {
        const groupData = group.keys.filter((key) => key in exifData)
        if (groupData.length === 0) return null

        return (
          <div key={groupKey} className="border rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2.5">
              {group.icon}
              <h4 className="text-sm font-semibold font-gothic">{group.title}</h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2.5">
              {groupData.map((key) => (
                <div key={key} className="flex flex-col space-y-0.5">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide leading-tight">
                    {key.replace(/([A-Z])/g, " $1").trim()}
                  </span>
                  <span className="font-mono text-xs">{formatExifValue(key, exifData[key])}</span>
                </div>
              ))}
            </div>
          </div>
        )
      })}

      {otherKeys.length > 0 && (
        <div className="border rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2.5">
            <ListFilter className="h-4 w-4" />
            <h4 className="text-sm font-semibold font-gothic">Other Metadata</h4>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2.5">
            {otherKeys.map((key) => (
              <div key={key} className="flex flex-col space-y-0.5">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide leading-tight">
                  {key.replace(/([A-Z])/g, " $1").trim()}
                </span>
                <span className="font-mono text-xs overflow-hidden text-ellipsis">
                  {formatExifValue(key, exifData[key])}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
