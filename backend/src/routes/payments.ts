import { Response, Request } from "express";
import { z } from "zod";
import { PrismaClient } from "@prisma/client";
import Stripe from "stripe";
import { AuthRequest, authMiddleware, requireRoles } from "../middleware/auth";
import { Router } from "express";
import { config } from "../config";

const prisma = new PrismaClient();
const router = Router();

// Inicializar Stripe si las credenciales son válidas
const stripeSecretKey = config.stripe.secretKey;
const isLiveStripe = Boolean(stripeSecretKey && !stripeSecretKey.includes("placeholder"));
const stripe = isLiveStripe ? new Stripe(stripeSecretKey) : null;

// Rutas públicas / de retorno (para checkout simulado o webhooks)
router.get("/mock-checkout", async (req: Request, res: Response) => {
  const sessionId = req.query.session_id as string;
  const paymentId = req.query.payment_id as string;

  if (!paymentId) {
    return res.status(400).send("Falta payment_id");
  }

  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { unit: true },
  });

  if (!payment) {
    return res.status(404).send("Pago no encontrado");
  }

  // Página HTML estética de pago simulado para desarrollo/testing
  const html = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Stripe Checkout - Simulación</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #fff; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; }
        .card { background: #1e293b; border-radius: 16px; padding: 32px; max-width: 440px; width: 100%; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5); border: 1px solid #334155; }
        .badge { background: #6366f1; color: #fff; font-size: 12px; font-weight: 700; padding: 4px 10px; border-radius: 20px; display: inline-block; margin-bottom: 16px; text-transform: uppercase; }
        h1 { font-size: 24px; margin: 0 0 8px 0; color: #f8fafc; }
        p { color: #94a3b8; font-size: 14px; margin: 0 0 24px 0; line-height: 1.5; }
        .details { background: #0f172a; border-radius: 12px; padding: 16px; margin-bottom: 24px; border: 1px solid #334155; }
        .row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px; }
        .row:last-child { margin-bottom: 0; border-top: 1px solid #334155; padding-top: 8px; font-weight: 700; font-size: 16px; color: #38bdf8; }
        .label { color: #94a3b8; }
        .val { color: #f8fafc; }
        .btn { background: #6366f1; color: #fff; border: none; border-radius: 10px; padding: 14px 20px; width: 100%; font-size: 16px; font-weight: 700; cursor: pointer; transition: background 0.2s; }
        .btn:hover { background: #4f46e5; }
        .footer { text-align: center; margin-top: 16px; font-size: 12px; color: #64748b; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="badge">Modo de Prueba Stripe</div>
        <h1>Pagar Cuota Residencial</h1>
        <p>Estás en la pasarela de pago para liquidar tu cuota de mantenimiento de forma segura.</p>
        
        <div class="details">
          <div class="row"><span class="label">Concepto:</span><span class="val">${payment.concept}</span></div>
          <div class="row"><span class="label">Unidad:</span><span class="val">#${payment.unit?.number}</span></div>
          <div class="row"><span class="label">Total a pagar:</span><span class="val">$${payment.amount.toFixed(2)} MXN</span></div>
        </div>

        <form method="POST" action="/payments/mock-complete">
          <input type="hidden" name="paymentId" value="${payment.id}" />
          <input type="hidden" name="sessionId" value="${sessionId}" />
          <button type="submit" class="btn">💳 Pagar $${payment.amount.toFixed(2)} MXN</button>
        </form>
        <div class="footer">🔒 Simulación de entorno seguro Stripe</div>
      </div>
    </body>
    </html>
  `;
  return res.send(html);
});

// Completar pago simulado
router.post("/mock-complete", async (req: Request, res: Response) => {
  const { paymentId, sessionId } = req.body;
  if (!paymentId) return res.status(400).send("Falta paymentId");

  await prisma.payment.update({
    where: { id: paymentId },
    data: {
      status: "pagado",
      paidAt: new Date(),
      reference: `MOCK_STRIPE_${Date.now()}`,
      stripeSessionId: sessionId || `mock_session_${Date.now()}`,
    },
  });

  return res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Pago Exitoso</title>
      <style>
        body { font-family: sans-serif; background: #0f172a; color: #fff; text-align: center; padding: 40px 20px; }
        .box { background: #1e293b; max-width: 400px; margin: auto; padding: 32px; border-radius: 16px; }
        h2 { color: #22c55e; }
        p { color: #94a3b8; }
      </style>
    </head>
    <body>
      <div class="box">
        <h2>✅ ¡Pago Exitoso!</h2>
        <p>Tu pago ha sido registrado correctamente.</p>
        <p>Puedes regresar a la aplicación de Seguridad Residencial.</p>
      </div>
    </body>
    </html>
  `);
});

// Webhook de Stripe
router.post("/webhook", async (req: Request, res: Response) => {
  const sig = req.headers["stripe-signature"];
  let event: Stripe.Event;

  if (stripe && config.stripe.webhookSecret && sig) {
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, config.stripe.webhookSecret);
    } catch (err) {
      console.error("Error validando webhook Stripe:", err);
      return res.status(400).send(`Webhook Error: ${(err as Error).message}`);
    }
  } else {
    event = req.body as Stripe.Event;
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const paymentId = session.client_reference_id || session.metadata?.paymentId;
    if (paymentId) {
      await prisma.payment.update({
        where: { id: paymentId },
        data: {
          status: "pagado",
          paidAt: new Date(),
          reference: (session.payment_intent as string) || session.id,
          stripeSessionId: session.id,
        },
      });
    }
  } else if (event.type === "payment_intent.succeeded") {
    const intent = event.data.object as Stripe.PaymentIntent;
    const paymentId = intent.metadata?.paymentId;
    if (paymentId) {
      await prisma.payment.update({
        where: { id: paymentId },
        data: {
          status: "pagado",
          paidAt: new Date(),
          reference: intent.id,
          stripePaymentIntentId: intent.id,
        },
      });
    }
  }

  return res.json({ received: true });
});

// A partir de aquí todas las rutas requieren autenticación
router.use(authMiddleware);

// Listar pagos
router.get("/", async (req: AuthRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: "No autenticado" });
  const where: Record<string, unknown> = {};

  if (req.user.role === "residente" && req.user.unitId) {
    where.unitId = req.user.unitId;
  } else if (req.user.role === "admin_residencial") {
    where.unit = { residencialId: req.user.residencialId };
  } else {
    where.unitId = req.user.unitId;
  }

  const payments = await prisma.payment.findMany({
    where,
    include: { unit: { select: { id: true, number: true } } },
    orderBy: { dueDate: "desc" },
  });
  return res.json(payments);
});

// Crear nuevo pago/cuota (solo admin)
const createPaymentSchema = z.object({
  unitId: z.string().min(1),
  concept: z.string().min(1),
  amount: z.number().positive(),
  dueDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)),
});

router.post("/", requireRoles("admin_residencial"), async (req: AuthRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: "No autenticado" });
  try {
    const body = createPaymentSchema.parse(req.body);
    const unit = await prisma.unit.findFirst({
      where: { id: body.unitId, residencialId: req.user.residencialId },
    });
    if (!unit) return res.status(404).json({ error: "Unidad no encontrada en este residencial" });

    const newPayment = await prisma.payment.create({
      data: {
        unitId: body.unitId,
        concept: body.concept,
        amount: body.amount,
        dueDate: new Date(body.dueDate),
        status: "pendiente",
      },
      include: { unit: { select: { id: true, number: true } } },
    });

    return res.status(201).json(newPayment);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return res.status(400).json({ error: "Datos inválidos", details: e.errors });
    }
    throw e;
  }
});

// Crear Checkout Session para pago con Stripe
router.post("/:id/checkout-session", async (req: AuthRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: "No autenticado" });

  const payment = await prisma.payment.findFirst({
    where: {
      id: req.params.id,
      ...(req.user.role === "residente" ? { unitId: req.user.unitId ?? undefined } : {}),
      unit: { residencialId: req.user.residencialId },
    },
    include: { unit: true },
  });

  if (!payment) return res.status(404).json({ error: "Pago no encontrado o sin permisos" });
  if (payment.status === "pagado") {
    return res.status(400).json({ error: "Esta cuota ya ha sido pagada previamente" });
  }

  const host = req.get("host") || "localhost:3000";
  const protocol = req.protocol;
  const baseUrl = `${protocol}://${host}`;

  if (stripe) {
    try {
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        mode: "payment",
        line_items: [
          {
            price_data: {
              currency: "mxn",
              product_data: {
                name: payment.concept,
                description: `Cuota de Seguridad y Mantenimiento - Unidad ${payment.unit?.number || "N/A"}`,
              },
              unit_amount: Math.round(payment.amount * 100),
            },
            quantity: 1,
          },
        ],
        client_reference_id: payment.id,
        metadata: {
          paymentId: payment.id,
          unitId: payment.unitId,
          concept: payment.concept,
        },
        success_url: `${baseUrl}/payments/mock-complete?paymentId=${payment.id}&sessionId={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/payments?canceled=true`,
      });

      await prisma.payment.update({
        where: { id: payment.id },
        data: { stripeSessionId: session.id },
      });

      return res.json({
        url: session.url,
        sessionId: session.id,
        publishableKey: config.stripe.publishableKey,
        isLive: true,
      });
    } catch (err) {
      console.error("Error creando sesión en Stripe:", err);
      // Fallback a simulación si falla Stripe
    }
  }

  // Modo Simulación/Test si no hay Stripe en vivo configurado
  const mockSessionId = `mock_session_${payment.id}_${Date.now()}`;
  await prisma.payment.update({
    where: { id: payment.id },
    data: { stripeSessionId: mockSessionId },
  });

  return res.json({
    url: `${baseUrl}/payments/mock-checkout?session_id=${mockSessionId}&payment_id=${payment.id}`,
    sessionId: mockSessionId,
    publishableKey: config.stripe.publishableKey || "pk_test_mock",
    isLive: false,
  });
});

// Crear Payment Intent directo para pagos con tarjeta
router.post("/:id/payment-intent", async (req: AuthRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: "No autenticado" });

  const payment = await prisma.payment.findFirst({
    where: {
      id: req.params.id,
      ...(req.user.role === "residente" ? { unitId: req.user.unitId ?? undefined } : {}),
      unit: { residencialId: req.user.residencialId },
    },
    include: { unit: true },
  });

  if (!payment) return res.status(404).json({ error: "Pago no encontrado o sin permisos" });
  if (payment.status === "pagado") {
    return res.status(400).json({ error: "Esta cuota ya ha sido pagada previamente" });
  }

  if (stripe) {
    try {
      const intent = await stripe.paymentIntents.create({
        amount: Math.round(payment.amount * 100),
        currency: "mxn",
        metadata: {
          paymentId: payment.id,
          unitId: payment.unitId,
        },
      });

      await prisma.payment.update({
        where: { id: payment.id },
        data: { stripePaymentIntentId: intent.id },
      });

      return res.json({
        clientSecret: intent.client_secret,
        paymentIntentId: intent.id,
        publishableKey: config.stripe.publishableKey,
      });
    } catch (err) {
      console.error("Error creando PaymentIntent:", err);
    }
  }

  const mockPiId = `pi_mock_${payment.id}_${Date.now()}`;
  return res.json({
    clientSecret: `${mockPiId}_secret`,
    paymentIntentId: mockPiId,
    publishableKey: "pk_test_mock",
    isMock: true,
  });
});

// Verificar sesión de Stripe después de completar checkout en la app
const verifySessionSchema = z.object({
  sessionId: z.string().optional(),
});

router.post("/:id/verify-session", async (req: AuthRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: "No autenticado" });

  const payment = await prisma.payment.findFirst({
    where: {
      id: req.params.id,
      unit: { residencialId: req.user.residencialId },
    },
    include: { unit: { select: { id: true, number: true } } },
  });

  if (!payment) return res.status(404).json({ error: "Pago no encontrado" });
  if (payment.status === "pagado") {
    return res.json({ success: true, payment, alreadyPaid: true });
  }

  const body = verifySessionSchema.parse(req.body || {});
  const sessionId = body.sessionId || payment.stripeSessionId;

  if (sessionId && sessionId.startsWith("mock_session_")) {
    const updated = await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: "pagado",
        paidAt: new Date(),
        reference: `MOCK_STRIPE_${Date.now()}`,
      },
      include: { unit: { select: { id: true, number: true } } },
    });
    return res.json({ success: true, payment: updated });
  }

  if (stripe && sessionId) {
    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      if (session.payment_status === "paid") {
        const updated = await prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: "pagado",
            paidAt: new Date(),
            reference: (session.payment_intent as string) || session.id,
          },
          include: { unit: { select: { id: true, number: true } } },
        });
        return res.json({ success: true, payment: updated });
      }
    } catch (err) {
      console.error("Error verificando sesión Stripe:", err);
    }
  }

  return res.json({
    success: false,
    status: payment.status,
    message: "El pago todavía está pendiente de confirmación",
  });
});

// Confirmar pago manualmente (admin)
const confirmSchema = z.object({
  reference: z.string().optional(),
});

router.post("/:id/confirm", requireRoles("admin_residencial"), async (req: AuthRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: "No autenticado" });
  const payment = await prisma.payment.findFirst({
    where: {
      id: req.params.id,
      unit: { residencialId: req.user.residencialId },
    },
  });
  if (!payment) return res.status(404).json({ error: "Pago no encontrado" });
  const body = confirmSchema.parse(req.body || {});
  const updated = await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: "pagado",
      paidAt: new Date(),
      reference: body.reference ?? payment.reference ?? "CONFIRMACION_MANUAL_ADMIN",
    },
    include: { unit: { select: { id: true, number: true } } },
  });
  return res.json(updated);
});

export default router;
