import { createFileRoute } from "@tanstack/react-router";
import { esAdminLector, MENSAJE_SIN_CLAVE } from "@/lib/lector-admin.server";
import { createOpenAI } from "@ai-sdk/openai";
import { jsonSchema, NoObjectGeneratedError, Output, streamText } from "ai";

// Reads a cheque photo with AI and returns the fields for the user to review.
const CORS = {
  "Access-Control-Allow-Origin": "app://cheques",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: CORS });

export interface LecturaCheque {
  numero: string | null;
  banco: string | null;
  librador: string | null;
  monto: number | null;
  fechaEmision: string | null;
  fechaVencimiento: string | null;
  camposDudosos: string[];
}

const nullable = (type: "string" | "number") => ({ type: [type, "null"] as ["string" | "number", "null"] });
const chequeSchema = {
  type: "object" as const,
  additionalProperties: false,
  required: ["numero", "banco", "librador", "monto", "fechaEmision", "fechaVencimiento", "camposDudosos"],
  properties: {
    numero: nullable("string"),
    banco: nullable("string"),
    librador: nullable("string"),
    monto: nullable("number"),
    fechaEmision: nullable("string"),
    fechaVencimiento: nullable("string"),
    camposDudosos: { type: "array" as const, items: { type: "string" as const } },
  },
};
const schema = jsonSchema<{ cheques: LecturaCheque[] }>({
  type: "object",
  additionalProperties: false,
  required: ["cheques"],
  properties: { cheques: { type: "array", items: chequeSchema } },
});

export const Route = createFileRoute("/api/leer-cheque")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request }) => {
        if (!(await esAdminLector(request))) return json({ error: MENSAJE_SIN_CLAVE }, 403);
        const apiKey = process.env["LOVABLE_API_KEY"];
        if (!apiKey) return json({ error: "Falta configurar la clave del lector." }, 500);
        let imagen = "";
        try {
          imagen = String((await request.json())?.imagen ?? "");
        } catch {
          return json({ error: "Solicitud inválida." }, 400);
        }
        if (!/^data:image\/(png|jpe?g|webp|gif);base64,/.test(imagen)) return json({ error: "Subí una foto (JPG, PNG o WEBP)." }, 400);
        if (imagen.length > 14_000_000) return json({ error: "La foto es demasiado grande." }, 400);

        const provider = createOpenAI({
          baseURL: "https://ai.gateway.lovable.dev/v1",
          apiKey,
          headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
        });
        try {
          const result = streamText({
            model: provider.responses("openai/gpt-6-astra"),
            instructions:
              "Leés fotos de cheques argentinos (físicos o ECHEQ). La foto puede tener VARIOS cheques: devolvé un elemento en cheques por cada cheque visible y legible (ignorá los que estén cortados o ilegibles casi por completo), en orden de arriba hacia abajo y de izquierda a derecha. Para cada uno extraé: número de cheque, banco, librador (quien firma/emite), monto en pesos (número, sin símbolos; si el importe en números no coincide con el escrito en letras, usá el de letras y marcá 'monto' como dudoso), fecha de emisión y fecha de pago/vencimiento en formato YYYY-MM-DD. Si un dato no se ve, devolvé null. En camposDudosos poné los nombres de los campos ilegibles, tachados, sobrescritos, enmendados o inseguros (por ejemplo una fecha con un número escrito encima o una fecha imposible) (numero, banco, librador, monto, fechaEmision, fechaVencimiento). Si la imagen no tiene cheques, devolvé cheques vacío.",
            messages: [{ role: "user", content: [{ type: "text", text: "Leé todos los cheques de esta foto." }, { type: "image", image: new URL(imagen) }] }],
            output: Output.object({ schema }),
            abortSignal: request.signal,
            maxRetries: 0,
            providerOptions: {
              openai: { forceReasoning: true, reasoningEffort: "low", reasoningSummary: "auto", store: false, include: ["reasoning.encrypted_content"] },
            },
          });
          return json(await result.output);
        } catch (e) {
          if (NoObjectGeneratedError.isInstance(e)) return json({ error: "No se pudo leer el cheque. Probá con una foto más clara." }, 422);
          const status = (e as { statusCode?: number }).statusCode;
          console.error("leer-cheque", e);
          if (status === 402) return json({ error: "Se agotaron los créditos de IA del espacio de trabajo." }, 402);
          if (status === 429) return json({ error: "Demasiadas lecturas seguidas. Esperá un momento." }, 429);
          return json({ error: "El lector no está disponible ahora. Intentá de nuevo más tarde." }, 502);
        }
      },
    },
  },
});
