import { cn } from "@/lib/utils";
import React from "react";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  variant?: "ghost" | "white" | "orange";
}

const cardVariants = {
  ghost: "bg-white/5 border-t-[1px] border-l-[1px] border-white/10",
  white: "bg-white border-t-[1px] border-l-[1px] border-fireside-orange/50",
  orange: "bg-fireside-orange border-t-[1px] border-l-[1px] border-white/50",
};

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ children, className, variant = "ghost", ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "rounded-lg shadow-lg shadow-black/50 ",
          cardVariants[variant],
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = "Card";
