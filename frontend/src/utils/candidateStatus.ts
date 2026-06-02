import { Ban, Check, Heart, ShoppingBag } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ProductCandidateStatus } from "../types";

export type CandidateStatusAction = {
  status: ProductCandidateStatus;
  label: string;
  activeLabel: string;
  icon: LucideIcon;
  className: string;
};

export const candidateStatusLabels: Record<ProductCandidateStatus, string> = {
  new: "新規",
  watching: "いいね済み",
  confirmed: "確認済み",
  ignored: "無視",
  purchased: "購入済み",
};

export const candidateStatusActions: CandidateStatusAction[] = [
  {
    status: "watching",
    label: "いいねする",
    activeLabel: "いいねを解除する",
    icon: Heart,
    className: "like",
  },
  {
    status: "confirmed",
    label: "確認済みにする",
    activeLabel: "確認済みを解除する",
    icon: Check,
    className: "confirmed",
  },
  {
    status: "ignored",
    label: "無視する",
    activeLabel: "無視を解除する",
    icon: Ban,
    className: "ignored",
  },
  {
    status: "purchased",
    label: "購入済みにする",
    activeLabel: "購入済みを解除する",
    icon: ShoppingBag,
    className: "purchased",
  },
];

export function candidateStatusLabel(status: ProductCandidateStatus) {
  return candidateStatusLabels[status] ?? status;
}

export function candidateStatusActionTitle(
  action: CandidateStatusAction,
  isActive: boolean,
) {
  return isActive ? action.activeLabel : action.label;
}

export function candidateStatusIconFill(
  status: ProductCandidateStatus,
  isActive: boolean,
) {
  return isActive && status === "watching" ? "currentColor" : "none";
}
