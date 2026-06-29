const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const defaultProviders = [
  { name: 'Retell AI', slug: 'retell', enabled: true, priority: 1, sandboxMode: false },
  { name: 'Bland AI', slug: 'bland', enabled: true, priority: 2, sandboxMode: false },
  { name: 'Vapi', slug: 'vapi', enabled: true, priority: 3, sandboxMode: false },
  { name: 'Twilio Voice', slug: 'twilio', enabled: true, priority: 4, sandboxMode: false },
  { name: 'Telnyx Voice', slug: 'telnyx', enabled: true, priority: 5, sandboxMode: false },
  { name: 'ElevenLabs', slug: 'elevenlabs', enabled: true, priority: 6, sandboxMode: false },
  { name: 'Custom Webhook', slug: 'custom', enabled: true, priority: 7, sandboxMode: false }
];

async function seed() {
  console.log('Seeding default voice providers...');
  for (const provider of defaultProviders) {
    await prisma.voiceProvider.upsert({
      where: { slug: provider.slug },
      update: { name: provider.name, enabled: provider.enabled, priority: provider.priority },
      create: provider
    });
  }
  console.log('Seeding complete!');
}

seed()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
