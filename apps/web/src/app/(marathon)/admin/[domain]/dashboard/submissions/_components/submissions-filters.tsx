import { Search, ArrowUpDown, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface SubmissionsFiltersProps {
  search: string | null;
  onSearchChange: (value: string | null) => void;
  sortOrder: "asc" | "desc";
  onSortOrderChange: (value: "asc" | "desc") => void;
  competitionClassId: number[] | null;
  onCompetitionClassChange: (value: string) => void;
  competitionClasses: { id: number; name: string }[];
  deviceGroupId: number[] | null;
  onDeviceGroupChange: (value: string) => void;
  deviceGroups: { id: number; name: string }[];
}

export function SubmissionsFilters({
  search,
  onSearchChange,
  sortOrder,
  onSortOrderChange,
  competitionClassId,
  onCompetitionClassChange,
  competitionClasses,
  deviceGroupId,
  onDeviceGroupChange,
  deviceGroups,
}: SubmissionsFiltersProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
      <div className="relative flex-1 w-full sm:w-auto">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
        <Input
          type="text"
          placeholder="Search by reference, name, or email..."
          value={search || ""}
          onChange={(e) => onSearchChange(e.target.value || null)}
          className="w-full pl-9 h-9 bg-background text-sm"
        />
      </div>

      <div className="flex flex-wrap gap-3 w-full sm:w-auto">
        <Select value={sortOrder} onValueChange={onSortOrderChange}>
          <SelectTrigger className="w-full sm:w-[160px] h-9 bg-background">
            <div className="flex items-center gap-2">
              <ArrowUpDown className="size-4 text-muted-foreground shrink-0" />
              <SelectValue />
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="desc">Newest First</SelectItem>
            <SelectItem value="asc">Oldest First</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={
            !competitionClassId || competitionClassId.length === 0
              ? "all"
              : competitionClassId.join(",")
          }
          onValueChange={onCompetitionClassChange}
        >
          <SelectTrigger className="w-full sm:w-[220px] h-9 bg-background">
            <div className="flex items-center gap-2">
              <Filter className="size-4 text-muted-foreground shrink-0" />
              <SelectValue placeholder="All Classes" />
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Competition Classes</SelectItem>
            {competitionClasses.map((cc) => (
              <SelectItem key={cc.id} value={cc.id.toString()}>
                {cc.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={
            !deviceGroupId || deviceGroupId.length === 0
              ? "all"
              : deviceGroupId.join(",")
          }
          onValueChange={onDeviceGroupChange}
        >
          <SelectTrigger className="w-full sm:w-[200px] h-9 bg-background">
            <div className="flex items-center gap-2">
              <Filter className="size-4 text-muted-foreground shrink-0" />
              <SelectValue placeholder="All Groups" />
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Device Groups</SelectItem>
            {deviceGroups.map((dg) => (
              <SelectItem key={dg.id} value={dg.id.toString()}>
                {dg.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
