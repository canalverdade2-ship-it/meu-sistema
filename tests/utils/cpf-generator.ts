import { cpf } from 'cpf-cnpj-validator';

export function generateTestCPF() {
  return cpf.generate();
}

export function generateTestPhone() {
  return '119' + Math.floor(10000000 + Math.random() * 90000000).toString();
}
