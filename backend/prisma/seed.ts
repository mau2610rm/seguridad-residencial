import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const residencial = await prisma.residencial.upsert({
    where: { id: "seed-residencial-1" },
    update: {},
    create: {
      id: "seed-residencial-1",
      nombre: "Residencial Demo",
      direccion: "Av. Ejemplo 123",
    },
  });

  const door1 = await prisma.door.upsert({
    where: { id: "seed-door-1" },
    update: {},
    create: {
      id: "seed-door-1",
      name: "Puerta principal",
      doorType: "principal",
      residencialId: residencial.id,
    },
  });

  const door2 = await prisma.door.upsert({
    where: { id: "seed-door-2" },
    update: {},
    create: {
      id: "seed-door-2",
      name: "Peatonal",
      doorType: "peatonal",
      residencialId: residencial.id,
    },
  });

  const unit = await prisma.unit.upsert({
    where: { id: "seed-unit-1" },
    update: {},
    create: {
      id: "seed-unit-1",
      number: "101",
      residencialId: residencial.id,
    },
  });

  const passwordHash = await bcrypt.hash("password123", 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin@demo.com" },
    update: {},
    create: {
      email: "admin@demo.com",
      passwordHash,
      name: "Admin Demo",
      role: "admin_residencial",
      residencialId: residencial.id,
    },
  });

  const residente = await prisma.user.upsert({
    where: { email: "residente@demo.com" },
    update: {},
    create: {
      email: "residente@demo.com",
      passwordHash,
      name: "Residente Demo",
      role: "residente",
      residencialId: residencial.id,
      unitId: unit.id,
    },
  });

  await prisma.unit.update({
    where: { id: unit.id },
    data: { userId: residente.id },
  });

  const guardia = await prisma.user.upsert({
    where: { email: "guardia@demo.com" },
    update: {},
    create: {
      email: "guardia@demo.com",
      passwordHash,
      name: "Guardia Demo",
      role: "guardia",
      residencialId: residencial.id,
    },
  });

  await prisma.openingLimit.upsert({
    where: { id: "seed-limit-1" },
    update: {},
    create: {
      id: "seed-limit-1",
      residencialId: residencial.id,
      maxOpenings: 20,
      period: "day",
    },
  });

  console.log("Seed OK:", { residencial: residencial.nombre, door1: door1.name, door2: door2.name });
  console.log("Usuarios: admin@demo.com, residente@demo.com, guardia@demo.com / password: password123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
