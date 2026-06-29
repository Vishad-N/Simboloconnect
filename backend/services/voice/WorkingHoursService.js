const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

class WorkingHoursService {
  /**
   * Get working hours configuration for a user
   */
  static async getConfig(userId) {
    let config = await prisma.workingHours.findUnique({
      where: { userId }
    });

    if (!config) {
      // Create a default one if not exists
      config = await prisma.workingHours.create({
        data: {
          userId,
          timezone: 'Asia/Kolkata',
          schedule: {
            monday: { open: '09:00', close: '18:00', enabled: true },
            tuesday: { open: '09:00', close: '18:00', enabled: true },
            wednesday: { open: '09:00', close: '18:00', enabled: true },
            thursday: { open: '09:00', close: '18:00', enabled: true },
            friday: { open: '09:00', close: '18:00', enabled: true },
            saturday: { open: '10:00', close: '14:00', enabled: false },
            sunday: { open: '00:00', close: '00:00', enabled: false }
          }
        }
      });
    }

    return config;
  }

  /**
   * Save working hours config
   */
  static async saveConfig(userId, data) {
    return await prisma.workingHours.upsert({
      where: { userId },
      update: {
        timezone: data.timezone,
        schedule: data.schedule || {},
        holidayMode: data.holidayMode ?? false,
        emergencyOverride: data.emergencyOverride ?? false
      },
      create: {
        userId,
        timezone: data.timezone || 'Asia/Kolkata',
        schedule: data.schedule || {},
        holidayMode: data.holidayMode ?? false,
        emergencyOverride: data.emergencyOverride ?? false
      }
    });
  }

  /**
   * Checks if current time is within working hours.
   * If emergencyOverride is true, returns false (takeover active).
   * If holidayMode is true, returns false (takeover active).
   */
  static async isWithinWorkingHours(userId) {
    try {
      const config = await this.getConfig(userId);
      if (config.emergencyOverride || config.holidayMode) {
        return false; // Takeover: outside office hours / not available
      }

      const tz = config.timezone || 'Asia/Kolkata';
      // Format current time in user timezone
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        weekday: 'long',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });

      const parts = formatter.formatToParts(new Date());
      const partMap = Object.fromEntries(parts.map(p => [p.type, p.value]));
      
      const weekday = partMap.weekday.toLowerCase();
      const currentHourMin = `${partMap.hour}:${partMap.minute}`;

      const schedule = config.schedule || {};
      const dayConfig = schedule[weekday];

      if (!dayConfig || !dayConfig.enabled) {
        return false; // Closed today
      }

      const { open, close } = dayConfig;
      return currentHourMin >= open && currentHourMin <= close;
    } catch (err) {
      console.error('[WorkingHoursService] Error checking working hours:', err.message);
      return true; // Default to true so we don't block calls on logic failure
    }
  }
}

module.exports = WorkingHoursService;
