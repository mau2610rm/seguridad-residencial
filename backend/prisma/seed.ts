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

  // Pagos de prueba para el residente
  await prisma.payment.upsert({
    where: { id: "seed-payment-1" },
    update: {},
    create: {
      id: "seed-payment-1",
      unitId: unit.id,
      concept: "Mantenimiento Octubre 2026",
      amount: 1250.0,
      dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
      status: "pendiente",
    },
  });

  await prisma.payment.upsert({
    where: { id: "seed-payment-2" },
    update: {},
    create: {
      id: "seed-payment-2",
      unitId: unit.id,
      concept: "Fondo de Reserva de Seguridad",
      amount: 450.0,
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      status: "pendiente",
    },
  });

  await prisma.payment.upsert({
    where: { id: "seed-payment-3" },
    update: {},
    create: {
      id: "seed-payment-3",
      unitId: unit.id,
      concept: "Mantenimiento Septiembre 2026",
      amount: 1250.0,
      dueDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
      status: "pagado",
      paidAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
      reference: "STRIPE_REC_98124",
    },
  });

  // Incidentes de prueba con diferentes estados
  await prisma.incident.upsert({
    where: { id: "seed-incident-1" },
    update: {},
    create: {
      id: "seed-incident-1",
      type: "Falla de luminaria",
      description: "Lámpara del pasillo parpadea constantemente frente a la unidad 101.",
      location: "Pasillo Torre A",
      status: "reportado",
      reportedById: residente.id,
      residencialId: residencial.id,
    },
  });

  await prisma.incident.upsert({
    where: { id: "seed-incident-2" },
    update: {},
    create: {
      id: "seed-incident-2",
      type: "Ruido en portón",
      description: "El brazo del motor del portón rechina al abrirse por las mañanas.",
      location: "Puerta principal",
      status: "en_progreso",
      reportedById: guardia.id,
      residencialId: residencial.id,
    },
  });

  await prisma.incident.upsert({
    where: { id: "seed-incident-3" },
    update: {},
    create: {
      id: "seed-incident-3",
      type: "Fuga de agua",
      description: "Aspersor dañado tirando agua sobre la banqueta.",
      location: "Jardín Central",
      status: "resuelto",
      resolutionNotes: "Se sustituyó la boquilla del aspersor y se calibró la presión.",
      resolvedAt: new Date(),
      resolvedById: admin.id,
      reportedById: residente.id,
      residencialId: residencial.id,
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
