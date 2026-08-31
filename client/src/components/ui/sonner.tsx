
import { useTheme } from "next-themes";
import {
  CircleCheck,
  CircleX,
  TriangleAlert,
  Info,
} from "lucide-react";
import { Toaster as Sonner, ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      position="bottom-right"
      offset={{ bottom: 80, right: 16 }} 
      className="toaster group"
      icons={{
        success: <CircleCheck className="text-green-500" />,
        error: <CircleX className="text-red-500" />,
        warning: <TriangleAlert className="text-amber-500" />,
        info: <Info className="text-blue-500" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
