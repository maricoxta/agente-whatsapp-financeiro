# Agente Financeiro — WhatsApp → Planilha SGL

Recebe mensagens de despesas via WhatsApp e preenche automaticamente a aba
**"3 - Despesas"** da planilha `SGL - 2026 Padrão Compartilhada.xlsx`:

- Coluna **Descrição** ← primeira palavra/frase da mensagem
- Coluna **Valor Previsto** ← valor informado
- Coluna **Data Vencimento** ← data em que a mensagem foi enviada

Formatos de mensagem aceitos:
```
mercado - crédito - R$48,03
mercado crédito 48,03 reais
mercado crédito 48,03
```
A palavra do meio (crédito, débito, pix, dinheiro, boleto...) é reconhecida e
descartada — hoje ela não é gravada em nenhuma coluna, pois a "Classificação"
da planilha usa outra lista (Custo de Vida / Dívida / Liberdade / Movimento
Interno).

## Como funciona (arquitetura)

```
WhatsApp (seu número) → Meta Cloud API → webhook (Node/Express, local)
                                              │
                                   parser.js (extrai descrição + valor)
                                              │
                                   python/append_expense.py
                                              │
                                   Excel via COM (grava a linha real)
```

A gravação usa automação real do Excel (COM), não uma biblioteca que reescreve
o arquivo inteiro — isso evita qualquer risco de corromper fórmulas, validações
ou elementos da planilha. Se a planilha já estiver aberta no seu Excel, o
script se conecta a essa mesma instância; caso contrário, abre uma instância
invisível, salva e fecha.

## Pré-requisitos

- Node.js (já instalado nesta máquina)
- Python com `pywin32` (já instalado nesta máquina)
- Microsoft Excel instalado (já instalado nesta máquina)
- Uma conta em [developers.facebook.com](https://developers.facebook.com)
- [ngrok](https://ngrok.com/download) (ou similar) para expor o servidor local
  na internet, já que a Meta precisa alcançar seu webhook via HTTPS

## 1. Criar o app no Meta for Developers

1. Acesse https://developers.facebook.com/apps e crie um app do tipo
   **Business**.
2. Dentro do app, adicione o produto **WhatsApp**.
3. Na página **WhatsApp > Introdução (API Setup)** você verá:
   - Um **número de teste** gratuito já configurado
   - O **Temporary access token** (válido por 24h) ou gere um token
     permanente em *Business Settings > System Users*
   - O **Phone number ID**
4. Na mesma página, em "To", adicione **seu próprio número de WhatsApp** como
   destinatário de teste (a Meta envia um código de verificação por WhatsApp).

## 2. Configurar o projeto

```powershell
cd "C:\Users\Mariana\OneDrive\Agente Financeiro\agente-whatsapp"
copy .env.example .env
```

Edite `.env` e preencha:
- `WHATSAPP_TOKEN` — o token da etapa anterior
- `WHATSAPP_PHONE_NUMBER_ID` — o Phone Number ID
- `VERIFY_TOKEN` — invente uma senha qualquer (vai repetir no painel da Meta)
- `ALLOWED_SENDER` — seu número em formato internacional, ex: `5511999999999`
  (recomendado, para que só suas mensagens sejam processadas)
- `PLANILHA_PATH` — já vem preenchido apontando para a planilha SGL

## 3. Rodar o servidor local

```powershell
cd "C:\Users\Mariana\OneDrive\Agente Financeiro\agente-whatsapp"
npm install
npm start
```
Deve aparecer: `Agente financeiro escutando na porta 3000`.

## 4. Expor o servidor com ngrok

Em outro terminal:
```powershell
ngrok http 3000
```
Copie a URL HTTPS gerada (algo como `https://xxxx-xx-xx.ngrok-free.app`).

> Atenção: no plano gratuito do ngrok essa URL muda a cada reinício — será
> preciso atualizar o webhook na Meta sempre que reiniciar o túnel.

## 5. Configurar o webhook na Meta

1. Em **WhatsApp > Configuration**, clique em **Edit** no Webhook.
2. **Callback URL**: `https://xxxx-xx-xx.ngrok-free.app/webhook`
3. **Verify Token**: o mesmo valor que você colocou em `VERIFY_TOKEN` no `.env`
4. Clique em **Verify and Save** (a Meta chama o `GET /webhook` do servidor
   para confirmar).
5. Em **Webhook fields**, clique em **Manage** e assine o campo `messages`.

## 6. Testar

Envie uma mensagem do seu WhatsApp para o número de teste da Meta, por
exemplo:
```
mercado - crédito - R$48,03
```
O agente deve responder confirmando o registro, e a linha aparecerá na aba
"3 - Despesas" da planilha (se estiver com o Excel aberto, o valor aparece
assim que a próxima ação de tela atualizar a planilha — o Excel salva
automaticamente).

## Observações importantes

- **Mantenha o PC ligado** e o `npm start` rodando — é assim que o agente
  "escuta" o WhatsApp continuamente.
- **Não feche o ngrok** enquanto estiver testando (a URL pública só existe
  enquanto o túnel estiver ativo).
- **Não versionar o `.env`** (já está no `.gitignore`) — ele contém tokens
  sensíveis.
- Se a planilha estiver aberta no Excel no momento em que uma mensagem chega,
  o script escreve diretamente nessa instância aberta; se não estiver aberta,
  ele abre, grava e fecha sozinho.
- Mensagens que não seguem nenhum dos 3 formatos reconhecidos recebem uma
  resposta de erro pelo WhatsApp e não são gravadas.

## Rodar os testes automatizados do parser

```powershell
npm test
```
