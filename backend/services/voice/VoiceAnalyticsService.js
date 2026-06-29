const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

class VoiceAnalyticsService {
  /**
   * Get analytics dashboard statistics for a specific tenant user
   */
  static async getTenantAnalytics(userId) {
    const sessions = await prisma.voiceCallSession.findMany({
      where: { userId }
    });

    const totalCalls = sessions.length;
    const completedCalls = sessions.filter(s => s.status === 'COMPLETED').length;
    const failedCalls = sessions.filter(s => s.status === 'FAILED').length;
    const humanTransfers = sessions.filter(s => s.status === 'TRANSFERRING_TO_HUMAN' || s.status === 'TRANSFERRED').length;

    const totalDuration = sessions.reduce((sum, s) => sum + (s.durationSeconds || 0), 0);
    const avgDuration = totalCalls > 0 ? Math.round(totalDuration / totalCalls) : 0;

    const conversionScoreSum = sessions.reduce((sum, s) => sum + (s.leadScore || 0), 0);
    const avgConversionScore = totalCalls > 0 ? Math.round(conversionScoreSum / totalCalls) : 0;

    // Billing and cost metrics
    const billingRecords = await prisma.voiceBilling.findMany({
      where: { userId }
    });
    const totalCost = billingRecords.reduce((sum, b) => sum + parseFloat(b.cost || 0), 0);

    // Calculate AI resolution rate
    // Resolution = completed calls that were not transferred to human and had lead score >= 70
    const resolvedCalls = sessions.filter(s => s.status === 'COMPLETED' && (s.leadScore || 0) >= 70).length;
    const aiResolutionRate = totalCalls > 0 ? Math.round((resolvedCalls / totalCalls) * 100) : 0;
    const humanTransferRate = totalCalls > 0 ? Math.round((humanTransfers / totalCalls) * 100) : 0;

    // Provider-wise stats
    const providerStats = {};
    sessions.forEach(s => {
      if (!providerStats[s.provider]) {
        providerStats[s.provider] = { total: 0, completed: 0, failed: 0 };
      }
      providerStats[s.provider].total += 1;
      if (s.status === 'COMPLETED') providerStats[s.provider].completed += 1;
      if (s.status === 'FAILED') providerStats[s.provider].failed += 1;
    });

    const providerWise = Object.entries(providerStats).map(([slug, data]) => ({
      provider: slug,
      total: data.total,
      successRate: data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0
    }));

    return {
      totalCalls,
      completedCalls,
      failedCalls,
      avgDuration,
      avgConversionScore,
      totalCost,
      aiResolutionRate,
      humanTransferRate,
      providerWise
    };
  }

  /**
   * Get global metrics for Super Admin Voice Center
   */
  static async getGlobalAnalytics() {
    const sessions = await prisma.voiceCallSession.findMany();
    const billing = await prisma.voiceBilling.findMany();

    const totalCalls = sessions.length;
    const totalDuration = sessions.reduce((sum, s) => sum + (s.durationSeconds || 0), 0);
    const activeCalls = sessions.filter(s => s.status === 'IN_PROGRESS' || s.status === 'INITIATED').length;
    const failedCalls = sessions.filter(s => s.status === 'FAILED').length;
    const totalCost = billing.reduce((sum, b) => sum + parseFloat(b.cost || 0), 0);

    return {
      totalCalls,
      totalDuration,
      activeCalls,
      failedCalls,
      totalCost
    };
  }
}

module.exports = VoiceAnalyticsService;
