import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const user = await prisma.user.upsert({
    where: { email: 'demo@reachinbox.local' },
    update: {},
    create: {
      name: 'Demo User',
      email: 'demo@reachinbox.local',
      avatarUrl: null,
      googleId: null,
    },
  });

  const sender = await prisma.sender.upsert({
    where: {
      userId_email: {
        userId: user.id,
        email: 'sender@reachinbox.local',
      },
    },
    update: {},
    create: {
      userId: user.id,
      email: 'sender@reachinbox.local',
      displayName: 'ReachInbox Demo',
    },
  });

  console.log(
    JSON.stringify(
      {
        userId: user.id,
        senderId: sender.id,
        hint: 'Use these IDs with POST /api/emails/schedule',
      },
      null,
      2,
    ),
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
