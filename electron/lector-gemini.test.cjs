const { test } = require('node:test');
const assert = require('node:assert/strict');
const { leerGemini, probarGemini } = require('./lector-gemini.cjs');
const contratos = require('./lector-contrato.json');
const imagen = 'data:image/jpeg;base64,AA==';
test('uses Gemini 2.5 Flash and preserves expense fields', async () => {
  const datos = { gastos: [{ fecha: null, concepto: 'Compra', monto: 1200, categoria: 'Otros', camposDudosos: ['fecha'] }] };
  let calls = 0;
  const result = await leerGemini(async (url, request) => {
    calls++;
    assert.equal(url, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent');
    const body = JSON.parse(request.body);
    assert.equal(body.contents[0].parts[1].inline_data.mime_type, 'image/jpeg');
    assert.deepEqual(body.generationConfig.responseJsonSchema, contratos.gastos.schema);
    return Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(datos) }] } }] });
  }, 'test-only-not-a-credential', { imagen, modo: 'gastos' });
  assert.deepEqual(result, { ok: true, datos }); assert.equal(calls, 1);
});
test('quota errors stop with no automatic retries', async () => {
  let calls = 0;
  const result = await probarGemini(async () => { calls++; return new Response('', { status: 429 }); }, 'test-only-not-a-credential');
  assert.equal(result.ok, false); assert.equal(result.retryable, true); assert.equal(calls, 1);
});
test('provider denials are terminal', async () => {
  const result = await probarGemini(async () => new Response('', { status: 403 }), 'test-only-not-a-credential');
  assert.equal(result.status, 403); assert.equal(result.retryable, false);
});
test('content refusal ends reading without fallback', async () => {
  const result = await leerGemini(async () => Response.json({ promptFeedback: { blockReason: 'SAFETY' } }), 'test-only-not-a-credential', { imagen, modo: 'cheque' });
  assert.equal(result.ok, false); assert.equal(result.retryable, false);
});
test('rejects incomplete output instead of saving invented fields', async () => {
  const result = await leerGemini(async () => Response.json({ candidates: [{ content: { parts: [{ text: '{"gastos":[{"monto":10}]}' }] } }] }), 'test-only-not-a-credential', { imagen, modo: 'gastos' });
  assert.equal(result.ok, false);
});