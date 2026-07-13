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

## 4. Expor o servidor com ngrok (domínio fixo)

O plano grátis do ngrok muda a URL a cada reinício, a menos que você reserve
um **domínio estático** (grátis, 1 por conta):

1. Crie uma conta em https://dashboard.ngrok.com/signup
2. Pegue seu authtoken em https://dashboard.ngrok.com/get-started/your-authtoken
   e rode uma vez: `ngrok config add-authtoken SEU_TOKEN`
3. Reserve um domínio fixo em https://dashboard.ngrok.com/domains (algo como
   `seu-nome.ngrok-free.dev`)
4. Suba o túnel sempre com esse domínio:
   ```powershell
   ngrok http --url=seu-nome.ngrok-free.dev 3000
   ```

Neste projeto o domínio reservado é `anew-sugar-detest.ngrok-free.dev` (já
configurado em `start-agent.ps1`).

## 5. Configurar o webhook na Meta

1. Em **Casos de uso > Conectar no WhatsApp > Etapa 2. Configuração da
   produção**, clique em **Editar** no Webhook.
2. **Callback URL**: `https://anew-sugar-detest.ngrok-free.dev/webhook`
3. **Verify Token**: o mesmo valor que você colocou em `VERIFY_TOKEN` no `.env`
4. Clique em **Verificar e salvar** (a Meta chama o `GET /webhook` do servidor
   para confirmar).
5. Na lista de **Campos do webhook**, ative o toggle do campo **`messages`**.

Como o domínio é fixo, essa configuração só precisa ser feita **uma vez** —
reiniciar o servidor, o túnel ou o PC não muda a URL.

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

## Inicialização automática (start-agent.ps1)

O arquivo `start-agent.ps1` sobe o servidor Node e o túnel ngrok juntos, e
**reinicia sozinho** qualquer um dos dois se ele cair (verifica a cada 15s).
Ele roda automaticamente porque há um atalho para ele na pasta de
inicialização do Windows:
`%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\AgenteFinanceiroWhatsApp.lnk`

Ou seja: **basta manter o PC ligado e logado** — o agente sobe sozinho no
login e se recupera de travamentos automaticamente. Os logs ficam em
`agente-whatsapp/logs/` (`server.log`, `ngrok.log` e as versões `-err.log`).

Para rodar manualmente (sem esperar o login):
```powershell
powershell -ExecutionPolicy Bypass -File "C:\Users\Mariana\OneDrive\Agente Financeiro\agente-whatsapp\start-agent.ps1"
```

Para remover a inicialização automática, apague o atalho `.lnk` mencionado
acima.

## Observações importantes

- **Mantenha o PC ligado e logado** — é assim que o agente "escuta" o
  WhatsApp continuamente (a gravação depende do Excel local).
- **Token permanente**: o `WHATSAPP_TOKEN` atual é de um System User
  (`expires_at: 0`), não expira sozinho — mas se for revogado no Business
  Settings, precisa gerar outro.
- **Não versionar o `.env`** (já está no `.gitignore`) — ele contém tokens
  sensíveis.
- Se a planilha estiver aberta no Excel no momento em que uma mensagem chega,
  o script escreve diretamente nessa instância aberta; se não estiver aberta,
  ele abre, grava e fecha sozinho.
- Mensagens que não seguem nenhum dos 3 formatos reconhecidos recebem uma
  resposta de erro pelo WhatsApp e não são gravadas.
- A confirmação de recebimento por WhatsApp só funciona depois que a conta
  completar a **verificação de empresa** na Meta (sem ela, a Meta bloqueia
  envios para números no Brasil com o erro 130497). A gravação na planilha
  não depende disso.

## Rodar os testes automatizados do parser

```powershell
npm test
```
