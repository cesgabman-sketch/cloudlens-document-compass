import { createFileRoute } from "@tanstack/react-router";
import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";
import { chequesComoTexto, type Cheque } from "@/lib/cheques";

// The Windows desktop program loads from app://cheques and calls this endpoint cross-origin.
const CORS = {
  "Access-Control-Allow-Origin": "app://cheques",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function conCors(res: Response) {
  const h = new Headers(res.headers);
  Object.entries(CORS).forEach(([k, v]) => h.set(k, v));
  return new Response(res.body, { status: res.status, headers: h });
}

export const Route = createFileRoute("/api/consulta-cheques")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request }) => conCors(await responder(request)),
    },
  },
});

async function responder(request: Request): Promise<Response> {
        const apiKey = process.env["LOVABLE_API_KEY"];
        if (!apiKey) return Response.json({ error: "Falta configurar la clave del asistente." }, { status: 500 });

        let body: { pregunta?: string; cheques?: Cheque[] };
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Solicitud inválida." }, { status: 400 });
        }
        const pregunta = (body.pregunta ?? "").trim().slice(0, 2000);
        const cheques = Array.isArray(body.cheques) ? body.cheques.slice(0, 500) : [];
        if (!pregunta) return Response.json({ error: "Escribí una consulta." }, { status: 400 });

        const hoy = new Date().toISOString().slice(0, 10);
        const instructions = `Sos un asistente para administradores de cheques de una empresa argentina. Respondé en español rioplatense, claro y breve.
Usá SOLO los registros de cheques provistos. Si la información no está en los registros, decilo. Mostrá montos en pesos con separador de miles. Fecha de hoy: ${hoy}.

Registros de cheques (${cheques.length}):
${chequesComoTexto(cheques) || "(no hay cheques registrados)"}`;

        const provider = createOpenAI({
          baseURL: "https://ai.gateway.lovable.dev/v1",
          apiKey,
          headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
        });

        const result = streamText({
          model: provider.responses("openai/gpt-6-astra"),
          instructions,
          messages: [{ role: "user", content: pregunta }],
          abortSignal: request.signal,
          maxRetries: 0,
          providerOptions: {
            openai: {
              forceReasoning: true,
              reasoningEffort: "low",
              reasoningSummary: "auto",
              store: false,
              include: ["reasoning.encrypted_content"],
            },
          },
        });

        return result.toTextStreamResponse({
          headers: { "Cache-Control": "no-cache, no-transform" },
        });
}
