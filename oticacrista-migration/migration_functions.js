
/**
 * FUNÇÕES DE CONVERSÃO E NORMALIZAÇÃO
 * Sistema: Migração Ótica Cristã
 * Gerado: 2025-11-21
 */

// ============================================================================
// 1. CONVERSÃO DE VALORES MONETÁRIOS
// ============================================================================

/**
 * Converte valores do formato brasileiro para decimal
 * @param {string|number} valor - Valor no formato "190,00" ou 190
 * @returns {number} Valor decimal (ex: 190.00)
 */
function convertToDecimal(valor) {
  if (typeof valor === 'number') return valor;
  if (!valor || valor === '0' || valor === 0) return 0;

  // Remove pontos de milhar e substitui vírgula por ponto
  // "1.234,56" → 1234.56
  const cleaned = valor.toString()
    .replace(/\./g, '')  // Remove pontos
    .replace(',', '.');    // Troca vírgula por ponto

  return parseFloat(cleaned) || 0;
}

/**
 * Testa a função de conversão
 */
function testConvertToDecimal() {
  const tests = [
    { input: "190,00", expected: 190.00 },
    { input: "1234,56", expected: 1234.56 },
    { input: "0", expected: 0 },
    { input: "100,00", expected: 100.00 },
    { input: 150.50, expected: 150.50 }
  ];

  console.log("\n=== TESTE: convertToDecimal ===");
  tests.forEach(test => {
    const result = convertToDecimal(test.input);
    const pass = result === test.expected ? "✓" : "✗";
    console.log(`${pass} "${test.input}" → ${result} (esperado: ${test.expected})`);
  });
}

// ============================================================================
// 2. NORMALIZAÇÃO DE ENUMS
// ============================================================================

/**
 * Mapeia forma de pagamento do sistema antigo para o novo
 */
const PAYMENT_METHOD_MAP = {
  'CARNÊ': 'INSTALLMENT',
  'CRÉDITO': 'CREDIT',
  'DINHEIRO': 'MONEY',
  'DÉBITO': 'DEBIT'
};

function mapPaymentMethod(forma) {
  return PAYMENT_METHOD_MAP[forma?.toUpperCase()] || 'MONEY';
}

/**
 * Mapeia gênero
 */
const GENDER_MAP = {
  'MASCULINO': 'MALE',
  'FEMININO': 'FEMALE',
  '----': null
};

function mapGender(sexo) {
  return GENDER_MAP[sexo?.toUpperCase()] || null;
}

/**
 * Mapeia tipo de produto para categoria
 */
const PRODUCT_CATEGORY_MAP = {
  'PRODUTO': 'FRAME',
  'SERVIÇO': 'ACCESSORY',
  '+TR': 'ACCESSORY',
  'PRO  DUTO': 'FRAME'  // erro de digitação
};

function mapProductCategory(tipo) {
  return PRODUCT_CATEGORY_MAP[tipo?.toUpperCase()] || 'ACCESSORY';
}

/**
 * Calcula status de pagamento baseado em atendimento e carnê
 */
function calculatePaymentStatus(atendimento, carneParcelas) {
  if (!carneParcelas || carneParcelas.length === 0) {
    // Sem carnê: verificar campo atePago
    return atendimento.atePago?.includes('Pago') ? 'CONFIRMED' : 'PENDING';
  }

  // Com carnê: verificar se todas as parcelas foram pagas
  const allPaid = carneParcelas.every(parcela => 
    parcela.carParcelaStatus === 'Pago com sucesso' || 
    parcela.carParcelaStatus === 'Pago com atraso'
  );

  return allPaid ? 'CONFIRMED' : 'PENDING';
}

/**
 * Verifica se uma parcela foi paga
 */
function isInstallmentPaid(status) {
  return status === 'Pago com sucesso' || status === 'Pago com atraso';
}

// ============================================================================
// 3. LIMPEZA DE DADOS
// ============================================================================

/**
 * Limpa CPF removendo formatação
 */
function cleanCPF(cpf) {
  if (!cpf) return null;
  return cpf.toString().replace(/[^0-9]/g, '');
}

/**
 * Limpa telefone removendo formatação
 */
function cleanPhone(phone) {
  if (!phone) return null;
  return phone.toString().replace(/[^0-9]/g, '');
}

/**
 * Extrai nome do pai de um campo de filiação
 * Exemplo: "MARIA SILVA E JOSE SANTOS" → "JOSE SANTOS"
 */
function extractFatherName(filiacao) {
  if (!filiacao) return null;
  const cleaned = filiacao.trim();
  if (cleaned === '-----' || cleaned === '') return null;
  
  // Normalizar: adiciona espaço se termina com ' E'
  const normalized = cleaned.endsWith(' E') ? cleaned + ' ' : cleaned;
  
  if (normalized.includes(' E ')) {
    const parts = normalized.split(' E ');
    if (parts.length >= 2) {
      const pai = parts[1].trim();
      return pai || null;
    }
  }
  return null;
}

/**
 * Extrai nome da mãe de um campo de filiação
 * Exemplo: "MARIA SILVA E JOSE SANTOS" → "MARIA SILVA"
 */
function extractMotherName(filiacao) {
  if (!filiacao) return null;
  const cleaned = filiacao.trim();
  if (cleaned === '-----' || cleaned === '') return null;
  
  // Normalizar: adiciona espaço se termina com ' E'
  const normalized = cleaned.endsWith(' E') ? cleaned + ' ' : cleaned;
  
  if (normalized.includes(' E ')) {
    const parts = normalized.split(' E ');
    const mae = parts[0].trim();
    return mae || null;
  }
  return cleaned;
}

// ============================================================================
// 4. CÁLCULOS E AGREGAÇÕES
// ============================================================================

/**
 * Calcula valor total pago de um carnê
 */
function calculatePaidAmount(carneParcelas) {
  if (!carneParcelas) return 0;

  return carneParcelas.reduce((total, parcela) => {
    if (isInstallmentPaid(parcela.carParcelaStatus)) {
      return total + parcela.carValorParcela;
    }
    return total;
  }, 0);
}

/**
 * Conta quantas parcelas foram pagas
 */
function countPaidInstallments(carneParcelas) {
  if (!carneParcelas) return 0;

  return carneParcelas.filter(p => isInstallmentPaid(p.carParcelaStatus)).length;
}

/**
 * Obtém data do último pagamento
 */
function getLastPaymentDate(carneParcelas) {
  if (!carneParcelas) return null;

  const paidParcelas = carneParcelas
    .filter(p => isInstallmentPaid(p.carParcelaStatus) && p.carDataPagamento)
    .sort((a, b) => new Date(b.carDataPagamento) - new Date(a.carDataPagamento));

  return paidParcelas.length > 0 ? paidParcelas[0].carDataPagamento : null;
}

/**
 * Calcula subtotal de itens de um atendimento
 */
function calculateSubtotal(itensAtendimento) {
  if (!itensAtendimento) return 0;

  return itensAtendimento.reduce((total, item) => {
    return total + (item.itemTotalGeral || 0);
  }, 0);
}

// ============================================================================
// 5. PARSER DE RECEITAS (SIMPLIFICADO)
// ============================================================================

/**
 * Verifica se um texto contém uma receita oftalmológica
 */
function hasPrescription(text) {
  if (!text) return false;
  const rxPattern = /(RX|rx|Rx).*?(OD|od|Od).*?(OE|oe|Oe)/;
  return rxPattern.test(text);
}

/**
 * Parser SIMPLIFICADO de receita oftalmológica
 * IMPORTANTE: Este parser é básico e captura apenas ~60-70% das receitas
 * Para produção, recomenda-se manter texto original em 'notes' e revisar manualmente
 */
function parsePrescription(text) {
  const result = {
    success: false,
    od: {},
    oe: {},
    raw: text
  };

  try {
    // Buscar OD (Olho Direito)
    const odMatch = text.match(/OD\s*([\+\-]?\d+[,.]?\d*)\s*([\+\-]?\d+[,.]?\d*)\s*(\d+)[ºo°]?\s*([\d,\.]+)/i);
    if (odMatch) {
      result.od = {
        spherical: odMatch[1].replace(',', '.'),
        cylindrical: odMatch[2].replace(',', '.'),
        axis: odMatch[3],
        dnp: odMatch[4].replace(',', '.')
      };
    }

    // Buscar OE (Olho Esquerdo)
    const oeMatch = text.match(/OE\s*([\+\-]?\d+[,.]?\d*|PL)\s*([\+\-]?\d+[,.]?\d*)\s*(\d+)[ºo°]?\s*([\d,\.]+)/i);
    if (oeMatch) {
      result.oe = {
        spherical: oeMatch[1] === 'PL' ? '0.00' : oeMatch[1].replace(',', '.'),
        cylindrical: oeMatch[2].replace(',', '.'),
        axis: oeMatch[3],
        dnp: oeMatch[4].replace(',', '.')
      };
    }

    // Buscar adição
    const adMatch = text.match(/AD\s*([\d,\.]+)/i);
    if (adMatch) {
      result.addition = adMatch[1].replace(',', '.');
    }

    result.success = !!(result.od.spherical || result.oe.spherical);

  } catch (error) {
    result.error = error.message;
  }

  return result;
}

// ============================================================================
// EXPORTAR FUNÇÕES
// ============================================================================

module.exports = {
  // Conversões
  convertToDecimal,

  // Enums
  mapPaymentMethod,
  mapGender,
  mapProductCategory,

  // Status
  calculatePaymentStatus,
  isInstallmentPaid,

  // Limpeza
  cleanCPF,
  cleanPhone,
  extractFatherName,
  extractMotherName,

  // Cálculos
  calculatePaidAmount,
  countPaidInstallments,
  getLastPaymentDate,
  calculateSubtotal,

  // Receitas
  hasPrescription,
  parsePrescription,

  // Testes
  testConvertToDecimal
};
