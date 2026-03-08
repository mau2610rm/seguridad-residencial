import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export type LimitCheckResult = { allowed: true } | { allowed: false; reason: string };

export async function checkOpeningLimits(
  residencialId: string,
  doorId: string,
  unitId: string | null,
  userId: string | null
): Promise<LimitCheckResult> {
  const limits = await prisma.openingLimit.findMany({
    where: { residencialId },
    orderBy: { createdAt: "desc" },
  });

  for (const limit of limits) {
    const appliesToDoor = !limit.doorId || limit.doorId === doorId;
    const appliesToUnit = !limit.unitId || limit.unitId === unitId;
    if (!appliesToDoor || !appliesToUnit) continue;

    const periodStart = getPeriodStart(limit.period as "day" | "month");
    const count = await prisma.opening.count({
      where: {
        doorId,
        ...(unitId ? { unitId } : { userId }),
        createdAt: { gte: periodStart },
      },
    });

    if (count >= limit.maxOpenings) {
      const periodLabel = limit.period === "day" ? "día" : "mes";
      return {
        allowed: false,
        reason: `Límite de aperturas alcanzado (${limit.maxOpenings} por ${periodLabel})`,
      };
    }
  }
  return { allowed: true };
}

function getPeriodStart(period: "day" | "month"): Date {
  const now = new Date();
  if (period === "day") {
    now.setHours(0, 0, 0, 0);
    return now;
  }
  now.setDate(1);
  now.setHours(0, 0, 0, 0);
  return now;
}
