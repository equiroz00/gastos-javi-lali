// ── lib/receiptSchema.ts ──────────────────────────────────────────────────────
// Schema compartido entre el cliente (AddEditExpense) y la función serverless
// (api/parse-receipt.ts). Todo nullable a propósito: si el modelo de visión no
// pudo leer un campo, se deja vacío para que el usuario lo complete a mano —
// nunca se inventa un valor (human-in-the-loop, Sprint 14).
import { z } from 'zod';

export const ReciboSchema = z.object({
  comercio: z.string().trim().min(1).nullable(),
  total:    z.number().positive().nullable(),
  // YYYY-MM-DD, mismo formato que Expense.date en toda la app.
  fecha:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  cuit:     z.string().trim().min(1).nullable(),
  items:    z.array(z.object({
    descripcion: z.string(),
    monto:       z.number(),
  })).max(50).optional(),
});

export type ReciboExtraido = z.infer<typeof ReciboSchema>;
