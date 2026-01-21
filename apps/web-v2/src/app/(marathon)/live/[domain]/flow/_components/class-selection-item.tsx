
import { useTranslations } from "next-intl";
import { CompetitionClass } from "@blikka/db";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { CheckCircle2 } from "lucide-react";
import { motion } from "motion/react";

export function ClassSelectionItem({
  competitionClass,
  isSelected,
  onSelect
}: {
  competitionClass: CompetitionClass;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const t = useTranslations("FlowPage");

  return (
    <motion.div
      key={competitionClass.id}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.97 }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="w-full md:w-[340px]"
    >
      <Card
        className={cn(
          "relative cursor-pointer h-full overflow-hidden transition-all duration-200 py-0",
          isSelected &&
            "ring-2 ring-primary/20 shadow-lg",
        )}
        onClick={onSelect}
      >
        <motion.div
          className="flex items-center gap-4 px-4 py-3"
          animate={{
            backgroundColor: isSelected
              ? "rgba(24,24,27, 0.04)"
              : "rgba(24,24,27, 0)",
          }}
          transition={{ duration: 0.2 }}
        >
          <motion.div
            className={cn(
              "flex items-center justify-center w-20 h-20 text-center rounded-lg shrink-0",
              isSelected ? "bg-foreground/5" : "bg-muted/50",
            )}
            layout
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          >
            <motion.span
              className={cn(
                "text-4xl font-bold",
                isSelected ? "text-primary" : "text-foreground/80",
              )}
              layout
              transition={{ duration: 0.2 }}
            >
              {competitionClass.numberOfPhotos}
            </motion.span>
          </motion.div>

          <div className="flex-1 min-w-0">
            <CardHeader className="py-0 px-0">
              <CardTitle className="flex items-center justify-between">
                <span className="text-lg leading-tight">{competitionClass.name}</span>
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{
                    scale: isSelected ? 1 : 0,
                    opacity: isSelected ? 1 : 0,
                  }}
                  transition={{ type: "spring", stiffness: 400, damping: 25 }}
                >
                  <CheckCircle2 className="h-6 w-6 text-primary" />
                </motion.div>
              </CardTitle>
            </CardHeader>

            <CardContent className="pb-1 px-0">
              <p className="text-xs sm:text-sm text-muted-foreground leading-snug">
                {competitionClass.numberOfPhotos === 1
                  ? "1 photo"
                  : `${t("classSelection.numberOfPhotos")}: ${competitionClass.numberOfPhotos}`}
              </p>
              {competitionClass.description && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-snug">
                  {competitionClass.description}
                </p>
              )}
            </CardContent>
          </div>
        </motion.div>
      </Card>
    </motion.div>
  );
}
