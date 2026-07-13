require('dotenv').config();
const express = require('express');
const { parseExpenseMessage } = require('./parser');
const { appendExpense } = require('./excelBridge');

const app = express();
app.use(express.json());

const {
  PORT = 3000,
  VERIFY_TOKEN,
  WHATSAPP_TOKEN,
  WHATSAPP_PHONE_NUMBER_ID,
  ALLOWED_SENDER,
} = process.env;

function brazilDateString(date) {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

function formatCurrencyBR(value) {
  return value.toFixed(2).replace('.', ',');
}

// A Meta reporta o remetente sem o "9" extra dos celulares brasileiros
// (ex: 556199909885), mas exige esse dígito para enviar mensagens
// (ex: 5561999909885). Reinsere o dígito só para o envio da resposta.
function toSendableBrazilNumber(waId) {
  if (/^55\d{10}$/.test(waId)) {
    const ddd = waId.slice(2, 4);
    const numero = waId.slice(4);
    return `55${ddd}9${numero}`;
  }
  return waId;
}

async function sendWhatsAppReply(to, body) {
  if (!WHATSAPP_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) return;
  const url = `https://graph.facebook.com/v20.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body },
      }),
    });
    if (!res.ok) {
      console.error('Erro ao enviar resposta WhatsApp:', res.status, await res.text());
    }
  } catch (err) {
    console.error('Erro ao enviar resposta WhatsApp:', err.message);
  }
}

// Verificação do webhook exigida pela Meta ao configurar a URL de callback.
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// Recebimento de mensagens.
app.post('/webhook', (req, res) => {
  res.sendStatus(200); // a Meta exige resposta rápida; processamos depois

  const message = req.body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  if (!message || message.type !== 'text') return;

  const from = message.from;
  if (ALLOWED_SENDER && from !== ALLOWED_SENDER) {
    console.log(`Mensagem ignorada de número não autorizado: ${from}`);
    return;
  }

  const text = message.text.body;
  const parsed = parseExpenseMessage(text);

  const replyTo = toSendableBrazilNumber(from);

  if (!parsed) {
    sendWhatsAppReply(
      replyTo,
      '⚠️ Não consegui entender essa mensagem. Use o formato: "descrição - valor" (ex: mercado - crédito - 48,03).',
    );
    return;
  }

  const timestampMs = Number(message.timestamp) * 1000;
  const dataVencimentoDate = Number.isFinite(timestampMs) ? new Date(timestampMs) : new Date();
  const dataVencimento = brazilDateString(dataVencimentoDate);

  appendExpense({
    descricao: parsed.descricao,
    valorPrevisto: parsed.valorPrevisto,
    dataVencimento,
  })
    .then((linha) => {
      console.log(`Linha ${linha}: ${parsed.descricao} - R$ ${formatCurrencyBR(parsed.valorPrevisto)} - ${dataVencimento}`);
      sendWhatsAppReply(
        replyTo,
        `✅ "${parsed.descricao}" - R$ ${formatCurrencyBR(parsed.valorPrevisto)} registrado (venc. ${dataVencimento}).`,
      );
    })
    .catch((err) => {
      console.error('Erro ao gravar na planilha:', err.message);
      sendWhatsAppReply(replyTo, `❌ Não consegui gravar na planilha: ${err.message}`);
    });
});

app.listen(PORT, () => {
  console.log(`Agente financeiro escutando na porta ${PORT}`);
});
