import { DeviceGroup } from "@blikka/db";
import { Card, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { CheckCircle2 } from "lucide-react";
import { motion } from "motion/react";
import { Icon } from "@iconify/react";

export function DeviceSelectionItem({
  deviceGroup,
  isSelected,
  onSelect,
}: {
  deviceGroup: DeviceGroup;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const getDeviceIcon = (icon: string) => {
    switch (icon) {
      case "smartphone":
        return (
          <Icon
            icon="solar:smartphone-broken"
            className="w-16 h-16"
            style={{ transform: "rotate(-5deg)" }}
          />
        );
      case "camera":
      default:
        return (
          <Icon
            icon="solar:camera-minimalistic-broken"
            className="w-16 h-16"
            style={{ transform: "rotate(-5deg)" }}
          />
        );
    }
  };

  return (
    <motion.div
      key={deviceGroup.id}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="w-full"
    >
      <Card
        className={cn(
          "relative cursor-pointer overflow-hidden transition-all duration-200 py-0",
          isSelected && "ring-2 ring-primary/20 shadow-lg",
        )}
        onClick={onSelect}
      >
        <motion.div
          className="flex items-center px-4 py-3"
          animate={{
            backgroundColor: isSelected
              ? "rgba(24,24,27, 0.03)"
              : "rgba(24,24,27, 0)",
          }}
          transition={{ duration: 0.2 }}
        >
          <motion.div
            className={cn(
              "flex items-center justify-center w-20 h-20 rounded-2xl transition-colors duration-200",
              isSelected ? "bg-primary/10" : "bg-muted/50",
            )}
            layout
            transition={{
              type: "spring",
              stiffness: 300,
              damping: 30,
            }}
          >
            <motion.div
              className={cn(
                "transition-colors duration-200",
                isSelected ? "text-primary" : "text-foreground/80",
              )}
              whileHover={{ scale: 1.1, rotate: 0 }}
              initial={{ rotate: -5 }}
              layout
            >
              {getDeviceIcon(deviceGroup.icon)}
            </motion.div>
          </motion.div>

          <div className="flex-1 ml-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl font-semibold font-rocgrotesk">
                  {deviceGroup.name}
                </CardTitle>
                <p className="text-xs text-muted-foreground/60 mt-0.5">
                  {deviceGroup.description}
                </p>
              </div>
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{
                  scale: isSelected ? 1 : 0,
                  opacity: isSelected ? 1 : 0,
                }}
                transition={{
                  type: "spring",
                  stiffness: 400,
                  damping: 25,
                }}
              >
                <CheckCircle2 className="h-6 w-6 text-primary" />
              </motion.div>
            </div>
          </div>
        </motion.div>
      </Card>
    </motion.div>
  );
}
