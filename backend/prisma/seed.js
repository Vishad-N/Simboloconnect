const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // ─── Voice Providers ────────────────────────────────────────────────────────
  // These are the AI voice calling providers supported by the platform.
  // Without this seed, the VoiceProvider table is empty and the
  // "AI Voice → Providers" page shows nothing.
  const voiceProviders = [
    {
      name: 'Retell AI',
      slug: 'retell',
      enabled: true,
      priority: 1,
      sandboxMode: false,
    },
    {
      name: 'Bland AI',
      slug: 'bland',
      enabled: true,
      priority: 2,
      sandboxMode: false,
    },
    {
      name: 'ElevenLabs',
      slug: 'elevenlabs',
      enabled: true,
      priority: 3,
      sandboxMode: false,
    },
    {
      name: 'Twilio Voice',
      slug: 'twilio',
      enabled: true,
      priority: 4,
      sandboxMode: false,
    },
    {
      name: 'Telnyx',
      slug: 'telnyx',
      enabled: true,
      priority: 5,
      sandboxMode: false,
    },
    {
      name: 'Custom Webhook',
      slug: 'custom',
      enabled: true,
      priority: 6,
      sandboxMode: false,
    },
  ];

  for (const provider of voiceProviders) {
    await prisma.voiceProvider.upsert({
      where: { slug: provider.slug },
      update: {
        name: provider.name,
        enabled: provider.enabled,
        priority: provider.priority,
        sandboxMode: provider.sandboxMode,
      },
      create: provider,
    });
    console.log(`  ✅ Voice Provider: ${provider.name} (${provider.slug})`);
  }

  console.log('✅ Seeding complete.');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
