import { Request, Response, NextFunction } from "express";
import { checkCredits, getUserSubscription } from "../services/creditService";
import { CREDIT_COSTS, PLAN_FEATURES, type CreditAction, type PlanType } from "../constants/credits";

// Extend Express Request to carry credit info
declare global {
  namespace Express {
    interface Request {
      creditCost?: number;
      creditAction?: CreditAction;
    }
  }
}

/**
 * Middleware factory that checks if the user has enough credits for an action.
 * IMPORTANT: This only CHECKS credits — deduction happens AFTER successful completion
 * in the route handler via deductCredits().
 */
export function requireCredits(actionType: CreditAction) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const cost = CREDIT_COSTS[actionType];
    const result = await checkCredits(userId, cost);

    if (!result.allowed) {
      const statusCode = result.reason === "trial_expired" ? 403 : 402;
      return res.status(statusCode).json({
        error: result.reason,
        message: getErrorMessage(result.reason),
        creditsNeeded: cost,
        creditsRemaining: result.subscription?.credits_remaining ?? 0,
        planType: result.subscription?.plan_type ?? "free",
        upgradeUrl: "/billing",
      });
    }

    // Attach credit info to request for the route handler to use after success
    req.creditCost = cost;
    req.creditAction = actionType;
    next();
  };
}

/**
 * Middleware factory that checks if the user's plan includes a specific feature.
 * For boolean features: requirePlan("followUpDrafts")
 * For array features: requirePlan("outreachProfileSections", "bio")
 */
export function requirePlan(featureKey: keyof typeof PLAN_FEATURES["free"], arrayValue?: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const sub = await getUserSubscription(userId);
    const planType = (sub?.plan_type || "free") as PlanType;
    const features = PLAN_FEATURES[planType] || PLAN_FEATURES.free;
    const featureValue = features[featureKey];

    let allowed = false;
    if (Array.isArray(featureValue)) {
      // Array feature — check if specific value is included
      allowed = arrayValue ? (featureValue as readonly string[]).includes(arrayValue) : featureValue.length > 0;
    } else if (typeof featureValue === "boolean") {
      allowed = featureValue;
    } else if (typeof featureValue === "number") {
      allowed = featureValue > 0;
    }

    if (!allowed) {
      // Determine the minimum plan that unlocks this feature
      const planOrder: PlanType[] = ["free", "starter", "pro", "max"];
      let requiredPlan: PlanType = "pro";
      for (const p of planOrder) {
        const pFeatures = PLAN_FEATURES[p];
        const pValue = pFeatures[featureKey];
        let pAllowed = false;
        if (Array.isArray(pValue)) {
          pAllowed = arrayValue ? (pValue as readonly string[]).includes(arrayValue) : pValue.length > 0;
        } else if (typeof pValue === "boolean") {
          pAllowed = pValue;
        }
        if (pAllowed) {
          requiredPlan = p;
          break;
        }
      }

      return res.status(403).json({
        error: "plan_upgrade_required",
        feature: featureKey,
        requiredPlan,
        currentPlan: planType,
        upgradeUrl: "/billing",
        message: `This feature requires the ${requiredPlan} plan or higher.`,
      });
    }

    next();
  };
}

function getErrorMessage(reason?: string): string {
  switch (reason) {
    case "trial_expired":
      return "Your free trial has expired. Upgrade to continue searching.";
    case "insufficient_credits":
      return "You don't have enough credits for this action.";
    case "subscription_canceled":
      return "Your subscription has been canceled. Resubscribe to continue.";
    case "payment_past_due":
      return "Your payment is past due. Please update your payment method.";
    case "no_subscription":
      return "No active subscription found. Please contact support.";
    default:
      return "Unable to process this action.";
  }
}
