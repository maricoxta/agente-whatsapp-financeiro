const { spawn } = require('child_process');
const path = require('path');

const SCRIPT_PATH = path.join(__dirname, '..', 'python', 'append_expense.py');
const PYTHON_CMD = process.env.PYTHON_CMD || 'py';

function appendExpenseInternal({ descricao, valorPrevisto, dataVencimento }) {
  return new Promise((resolve, reject) => {
    const planilha = process.env.PLANILHA_PATH;
    if (!planilha) return reject(new Error('PLANILHA_PATH não configurado no .env'));

    const child = spawn(PYTHON_CMD, [SCRIPT_PATH], { windowsHide: true });
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });

    child.on('error', (err) => reject(new Error(`Falha ao iniciar Python: ${err.message}`)));

    child.on('close', (code) => {
      const lastLine = stdout.trim().split('\n').pop() || '';
      let result;
      try {
        result = JSON.parse(lastLine);
      } catch {
        return reject(new Error(`Resposta inválida do script Python (código ${code}): ${stderr || stdout}`));
      }
      if (result.error) return reject(new Error(result.error));
      if (code !== 0) return reject(new Error(stderr || `Script Python saiu com código ${code}`));
      resolve(result.row);
    });

    child.stdin.write(JSON.stringify({ planilha, descricao, valorPrevisto, dataVencimento }));
    child.stdin.end();
  });
}

// Serializa as chamadas para evitar que duas mensagens simultâneas abram o
// Excel via COM ao mesmo tempo.
let tail = Promise.resolve();
function appendExpense(data) {
  const result = tail.then(() => appendExpenseInternal(data));
  tail = result.catch(() => {});
  return result;
}

module.exports = { appendExpense };
