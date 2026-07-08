const test = require('node:test');
const assert = require('node:assert/strict');
const { parseExpenseMessage } = require('../src/parser');

test('formato com traços', () => {
  assert.deepEqual(parseExpenseMessage('mercado - crédito - R$48,03'), {
    descricao: 'Mercado',
    valorPrevisto: 48.03,
  });
});

test('formato com espaços e "reais"', () => {
  assert.deepEqual(parseExpenseMessage('mercado crédito  48,03 reais'), {
    descricao: 'Mercado',
    valorPrevisto: 48.03,
  });
});

test('formato simples sem sufixo', () => {
  assert.deepEqual(parseExpenseMessage('mercado crédito  48,03'), {
    descricao: 'Mercado',
    valorPrevisto: 48.03,
  });
});

test('descrição com mais de uma palavra', () => {
  assert.deepEqual(parseExpenseMessage('farmácia popular - pix - 25,00'), {
    descricao: 'Farmácia popular',
    valorPrevisto: 25,
  });
});

test('valor sem casas decimais', () => {
  assert.deepEqual(parseExpenseMessage('uber débito 32'), {
    descricao: 'Uber',
    valorPrevisto: 32,
  });
});

test('mensagem sem valor retorna null', () => {
  assert.equal(parseExpenseMessage('oi tudo bem'), null);
});

test('mensagem vazia retorna null', () => {
  assert.equal(parseExpenseMessage(''), null);
  assert.equal(parseExpenseMessage(null), null);
});
