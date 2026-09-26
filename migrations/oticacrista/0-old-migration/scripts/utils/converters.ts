/**
 * FUNÇÕES DE CONVERSÃO E NORMALIZAÇÃO
 * Sistema: Migração Ótica Cristã
 * Gerado: 2025-11-21
 */

// ============================================================================
// TIPOS E INTERFACES
// ============================================================================

interface CarneParcelaLegacy {
  carParcelaStatus: string;
  carValorParcela: number;
  carDataPagamento: Date | string | null;
}

interface AtendimentoLegacy {
  atePago?: string;
}

interface ItemAtendimentoLegacy {
  itemTotalGeral?: number;
}

interface PrescriptionParseResult {
  success: boolean;
  od: {
    spherical?: string;
    cylindrical?: string;
    axis?: string;
    dnp?: string;
  };
  oe: {
    spherical?: string;
    cylindrical?: string;
    axis?: string;
    dnp?: string;
  };
  addition?: string;
  raw: string;
  error?: string;
}

type PaymentMethod = "PIX" | "MONEY" | "DEBIT" | "CREDIT" | "INSTALLMENT";
type Gender = "MALE" | "FEMALE" | "OTHER" | null;
type ProductCategory = "FRAME" | "LENS" | "ACCESSORY";
type PaymentStatus = "PENDING" | "CONFIRMED" | "CANCELED";

// ============================================================================
// 1. CONVERSÃO DE VALORES MONETÁRIOS
// ============================================================================

/**
 * Converte valores do formato brasileiro para decimal
 * @param valor - Valor no formato "190,00" ou 190
 * @returns Valor decimal (ex: 190.00)
 */
export function convertToDecimal(
  valor: string | number | null | undefined
): number {
  // Check para null/undefined
  if (!valor) return 0;

  // Se for número, retornar direto
  if (typeof valor === "number") return valor;

  // Se for string "0", retornar 0
  if (valor === "0") return 0;

  // Remove pontos de milhar e substitui vírgula por ponto
  // "1.234,56" → 1234.56
  const cleaned = valor
    .toString()
    .replace(/\./g, "") // Remove pontos
    .replace(",", "."); // Troca vírgula por ponto

  return parseFloat(cleaned) || 0;
}

/**
 * Testa a função de conversão
 */
export function testConvertToDecimal(): void {
  const tests = [
    { input: "190,00", expected: 190.0 },
    { input: "1234,56", expected: 1234.56 },
    { input: "0", expected: 0 },
    { input: "100,00", expected: 100.0 },
    { input: 150.5, expected: 150.5 },
  ];

  console.log("\n=== TESTE: convertToDecimal ===");
  tests.forEach((test) => {
    const result = convertToDecimal(test.input);
    const pass = result === test.expected ? "✓" : "✗";
    console.log(
      `${pass} "${test.input}" → ${result} (esperado: ${test.expected})`
    );
  });
}

// ============================================================================
// 2. NORMALIZAÇÃO DE ENUMS
// ============================================================================

/**
 * Mapeia forma de pagamento do sistema antigo para o novo
 */
const PAYMENT_METHOD_MAP: Record<string, PaymentMethod> = {
  CARNÊ: "INSTALLMENT",
  CRÉDITO: "CREDIT",
  DINHEIRO: "MONEY",
  DÉBITO: "DEBIT",
};

export function mapPaymentMethod(
  forma: string | null | undefined
): PaymentMethod {
  if (!forma) return "MONEY";
  return PAYMENT_METHOD_MAP[forma.toUpperCase()] || "MONEY";
}

/**
 * Mapeia gênero
 */
const GENDER_MAP: Record<string, Gender> = {
  MASCULINO: "MALE",
  FEMININO: "FEMALE",
  "----": null,
};

export function mapGender(sexo: string | null | undefined): Gender {
  if (!sexo) return null;
  return GENDER_MAP[sexo.toUpperCase()] || null;
}

/**
 * Mapeia tipo de produto para categoria
 */
const PRODUCT_CATEGORY_MAP: Record<string, ProductCategory> = {
  PRODUTO: "FRAME",
  SERVIÇO: "ACCESSORY",
  "+TR": "ACCESSORY",
  "PRO  DUTO": "FRAME", // erro de digitação
};

export function mapProductCategory(
  tipo: string | null | undefined
): ProductCategory {
  if (!tipo) return "ACCESSORY";
  return PRODUCT_CATEGORY_MAP[tipo.toUpperCase()] || "ACCESSORY";
}

/**
 * Calcula status de pagamento baseado em atendimento e carnê
 */
export function calculatePaymentStatus(
  atendimento: AtendimentoLegacy,
  carneParcelas: CarneParcelaLegacy[] | null | undefined
): PaymentStatus {
  if (!carneParcelas || carneParcelas.length === 0) {
    // Sem carnê: verificar campo atePago
    return atendimento.atePago?.includes("Pago") ? "CONFIRMED" : "PENDING";
  }

  // Com carnê: verificar se todas as parcelas foram pagas
  const allPaid = carneParcelas.every(
    (parcela) =>
      parcela.carParcelaStatus === "Pago com sucesso" ||
      parcela.carParcelaStatus === "Pago com atraso"
  );

  return allPaid ? "CONFIRMED" : "PENDING";
}

/**
 * Verifica se uma parcela foi paga
 */
export function isInstallmentPaid(status: string): boolean {
  return status === "Pago com sucesso" || status === "Pago com atraso";
}

// ============================================================================
// 3. LIMPEZA DE DADOS
// ============================================================================

/**
 * Limpa CPF removendo formatação
 */
export function cleanCPF(
  cpf: string | number | null | undefined
): string | null {
  if (!cpf) return null;
  return cpf.toString().replace(/[^0-9]/g, "");
}

/**
 * Limpa telefone removendo formatação
 */
export function cleanPhone(
  phone: string | number | null | undefined
): string | null {
  if (!phone) return null;
  return phone.toString().replace(/[^0-9]/g, "");
}

/**
 * Extrai nome do pai de um campo de filiação
 * Exemplo: "MARIA SILVA E JOSE SANTOS" → "JOSE SANTOS"
 */
export function extractFatherName(
  filiacao: string | null | undefined
): string | null {
  if (!filiacao) return null;
  const cleaned = filiacao.trim();
  if (cleaned === "-----" || cleaned === "") return null;

  // Normalizar: adiciona espaço se termina com ' E'
  const normalized = cleaned.endsWith(" E") ? cleaned + " " : cleaned;

  if (normalized.includes(" E ")) {
    const parts = normalized.split(" E ");
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
export function extractMotherName(
  filiacao: string | null | undefined
): string | null {
  if (!filiacao) return null;
  const cleaned = filiacao.trim();
  if (cleaned === "-----" || cleaned === "") return null;

  // Normalizar: adiciona espaço se termina com ' E'
  const normalized = cleaned.endsWith(" E") ? cleaned + " " : cleaned;

  if (normalized.includes(" E ")) {
    const parts = normalized.split(" E ");
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
export function calculatePaidAmount(
  carneParcelas: CarneParcelaLegacy[] | null | undefined
): number {
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
export function countPaidInstallments(
  carneParcelas: CarneParcelaLegacy[] | null | undefined
): number {
  if (!carneParcelas) return 0;

  return carneParcelas.filter((p) => isInstallmentPaid(p.carParcelaStatus))
    .length;
}

/**
 * Obtém data do último pagamento
 */
export function getLastPaymentDate(
  carneParcelas: CarneParcelaLegacy[] | null | undefined
): Date | string | null {
  if (!carneParcelas) return null;

  const paidParcelas = carneParcelas
    .filter((p) => isInstallmentPaid(p.carParcelaStatus) && p.carDataPagamento)
    .sort((a, b) => {
      const dateA = new Date(a.carDataPagamento!).getTime();
      const dateB = new Date(b.carDataPagamento!).getTime();
      return dateB - dateA;
    });

  return paidParcelas.length > 0 ? paidParcelas[0].carDataPagamento : null;
}

/**
 * Calcula subtotal de itens de um atendimento
 */
export function calculateSubtotal(
  itensAtendimento: ItemAtendimentoLegacy[] | null | undefined
): number {
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
export function hasPrescription(text: string | null | undefined): boolean {
  if (!text) return false;
  const rxPattern = /(RX|rx|Rx).*?(OD|od|Od).*?(OE|oe|Oe)/;
  return rxPattern.test(text);
}

/**
 * Parser SIMPLIFICADO de receita oftalmológica
 * IMPORTANTE: Este parser é básico e captura apenas ~60-70% das receitas
 * Para produção, recomenda-se manter texto original em 'notes' e revisar manualmente
 */
export function parsePrescription(text: string): PrescriptionParseResult {
  const result: PrescriptionParseResult = {
    success: false,
    od: {},
    oe: {},
    raw: text,
  };

  try {
    // Buscar OD (Olho Direito)
    const odMatch = text.match(
      /OD\s*([\+\-]?\d+[,.]?\d*)\s*([\+\-]?\d+[,.]?\d*)\s*(\d+)[ºo°]?\s*([\d,\.]+)/i
    );
    if (odMatch) {
      result.od = {
        spherical: odMatch[1].replace(",", "."),
        cylindrical: odMatch[2].replace(",", "."),
        axis: odMatch[3],
        dnp: odMatch[4].replace(",", "."),
      };
    }

    // Buscar OE (Olho Esquerdo)
    const oeMatch = text.match(
      /OE\s*([\+\-]?\d+[,.]?\d*|PL)\s*([\+\-]?\d+[,.]?\d*)\s*(\d+)[ºo°]?\s*([\d,\.]+)/i
    );
    if (oeMatch) {
      result.oe = {
        spherical: oeMatch[1] === "PL" ? "0.00" : oeMatch[1].replace(",", "."),
        cylindrical: oeMatch[2].replace(",", "."),
        axis: oeMatch[3],
        dnp: oeMatch[4].replace(",", "."),
      };
    }

    // Buscar adição
    const adMatch = text.match(/AD\s*([\d,\.]+)/i);
    if (adMatch) {
      result.addition = adMatch[1].replace(",", ".");
    }

    result.success = !!(result.od.spherical || result.oe.spherical);
  } catch (error: any) {
    result.error = error.message;
  }

  return result;
}
