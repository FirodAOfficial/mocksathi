import { requireUser } from '@/auth/cookies';
import { ComingSoonScreen } from '@/components/dashboard/ComingSoonScreen';
import { SubscriptionScreen } from '@/components/dashboard/SubscriptionScreen';
import { dashboardDataFor, fixtureMocksUsedCount } from '@/dashboard/seedDashboard';
import { currentPlanForUser, listPlans } from '@/db/plans';

export default async function SubscriptionPage() {
  const user = await requireUser();
  const [currentPlan, plans, dashboardData] = await Promise.all([
    currentPlanForUser(user.id),
    listPlans({ activeOnly: true }),
    dashboardDataFor(user),
  ]);

  if (!currentPlan) {
    return (
      <ComingSoonScreen
        icon="credit-card"
        title="Subscription"
        subtitle="Upgrade for full access."
        note="No subscription plans have been set up yet — check back soon."
      />
    );
  }

  return (
    <SubscriptionScreen
      plans={plans.map((plan) => ({
        id: plan.id,
        name: plan.name,
        priceInInr: plan.priceInInr,
        durationDays: plan.durationDays,
        mockLimit: plan.mockLimit,
        features: plan.features,
        isPopular: plan.isPopular,
      }))}
      currentPlanId={currentPlan.plan.id}
      isSubscribed={currentPlan.isSubscribed}
      daysRemaining={currentPlan.daysRemaining}
      mockLimit={currentPlan.plan.mockLimit}
      mocksUsed={fixtureMocksUsedCount(dashboardData)}
    />
  );
}
