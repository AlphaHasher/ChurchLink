"use client"

import * as React from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/Dialog"
import { Button } from "@/shared/components/ui/button"

interface AlertDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children?: React.ReactNode;
}

interface AlertDialogContentProps {
  children: React.ReactNode;
}

type ButtonProps = React.ComponentProps<typeof Button>;

interface AlertDialogActionProps extends ButtonProps {}

interface AlertDialogCancelProps extends ButtonProps {}

export const AlertDialog: React.FC<AlertDialogProps> = ({ open, onOpenChange, children }) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {children}
    </Dialog>
  );
};

export const AlertDialogTrigger: React.FC<{ children: React.ReactNode; asChild?: boolean }> = ({ children }) => {
  return <>{children}</>;
};

export const AlertDialogContent: React.FC<AlertDialogContentProps> = ({ children }) => {
  return (
    <DialogContent className="sm:max-w-[425px]">
      {children}
    </DialogContent>
  );
};

export const AlertDialogHeader: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <DialogHeader>{children}</DialogHeader>;
};

export const AlertDialogFooter: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <DialogFooter>{children}</DialogFooter>;
};

export const AlertDialogTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <DialogTitle>{children}</DialogTitle>;
};

export const AlertDialogDescription: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <DialogDescription>{children}</DialogDescription>;
};

export const AlertDialogAction: React.FC<AlertDialogActionProps> = ({ children, ...props }) => {
  return (
    <Button {...props}>
      {children}
    </Button>
  );
};

export const AlertDialogCancel: React.FC<AlertDialogCancelProps> = ({ children, ...props }) => {
  return (
    <Button variant="outline" {...props}>
      {children}
    </Button>
  );
};
