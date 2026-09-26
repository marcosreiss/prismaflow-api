/**
 * SCRIPT DE MIGRAÇÃO - PAGAMENTOS
 * Sistema: Ótica Cristã
 * Data: 2025-11-24
 *
 * Migra dados de atendimento + finReceita + carne para Payment
 */

import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";
import * as XLSX from "xlsx";
import { convertToDecimal, mapPaymentMethod } from "../utils/converters";

const prisma = new PrismaClient();

// ============================================================================
// CONFIGURAÇÃO
// ============================================================================

const CONFIG = {
  tenantId: "cmibvcyed00007m0118rkgft8",
  branchId: "cmibvcyed00017m014r66e39w",
  atendimentoPath: path.join(__dirname, "../data/atendimento.xlsx"),
  finReceitaPath: path.join(__dirname, "../data/finReceita.xlsx"),
  carnePath: path.join(__dirname, "../data/carne.xlsx"),
};

// ============================================================================
// INTERFACES
// ============================================================================

interface AtendimentoRow {
  ateId: number;
  ateTotal: string | number;
  ateFormaPagamento?: string;
  ateEntrada?: string | number;
  atePago?: string;
}

interface FinReceitaRow {
  recFinanceiro: number;
  recAtendimento: number;
  recParcelas: number;
  recDesconto: string | number;
  recJuros: string | number;
}

interface CarneRow {
  carId: number;
  carAtendimento: number;
  carParcelas: number;
  carValorParcela: string | number;
  carVencimento: Date | string;
  carNumeroParcela: number;
  carParcelaStatus: string;
  carDataPagamento?: Date | string;
}

interface MigrationStats {
  total: number;
  success: number;
  errors: number;
  skipped: number;
}

type PaymentStatus = "PENDING" | "CONFIRMED" | "CANCELED";

// ============================================================================
// FUNÇÕES AUXILIARES
// ============================================================================

/**
 * Lê arquivo Excel e converte IDs para number
 */
function readExcelFile<T>(filePath: string): T[] {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(worksheet, {
    raw: false,
    defval: null,
  });

  return data.map((row: any) => {
    // Converter IDs numéricos
    if (row.ateId) row.ateId = parseInt(row.ateId, 10);
    if (row.recAtendimento)
      row.recAtendimento = parseInt(row.recAtendimento, 10);
    if (row.recFinanceiro) row.recFinanceiro = parseInt(row.recFinanceiro, 10);
    if (row.recParcelas) row.recParcelas = parseInt(row.recParcelas, 10);
    if (row.carAtendimento)
      row.carAtendimento = parseInt(row.carAtendimento, 10);
    if (row.carId) row.carId = parseInt(row.carId, 10);
    if (row.carParcelas) row.carParcelas = parseInt(row.carParcelas, 10);
    if (row.carNumeroParcela)
      row.carNumeroParcela = parseInt(row.carNumeroParcela, 10);
    return row as T;
  });
}

/**
 * Calcula status do pagamento baseado em carnê
 */
function calculatePaymentStatus(
  carneParcelas: CarneRow[] | undefined
): PaymentStatus {
  if (!carneParcelas || carneParcelas.length === 0) {
    return "CONFIRMED"; // Pagamento à vista
  }

  const allPaid = carneParcelas.every(
    (parcela) =>
      parcela.carParcelaStatus === "Pago com sucesso" ||
      parcela.carParcelaStatus === "Pago com atraso"
  );

  return allPaid ? "CONFIRMED" : "PENDING";
}

/**
 * Converte data para Date
 */
function parseDate(date: Date | string | undefined | null): Date | null {
  if (!date) return null;
  if (date instanceof Date) return date;

  try {
    const parsed = new Date(date);
    return isNaN(parsed.getTime()) ? null : parsed;
  } catch {
    return null;
  }
}

// ============================================================================
// MIGRAÇÃO
// ============================================================================

async function migratePayments() {
  const stats: MigrationStats = {
    total: 0,
    success: 0,
    errors: 0,
    skipped: 0,
  };

  const errorLog: Array<{ atendimento: AtendimentoRow; error: string }> = [];

  console.log("\n" + "=".repeat(80));
  console.log("MIGRAÇÃO DE PAGAMENTOS - ÓTICA CRISTÃ");
  console.log("=".repeat(80));
  console.log(`\nTenant ID: ${CONFIG.tenantId}`);
  console.log(`Branch ID: ${CONFIG.branchId}\n`);

  try {
    // Ler arquivos
    console.log("📂 Lendo arquivos Excel...");
    const atendimentos = readExcelFile<AtendimentoRow>(CONFIG.atendimentoPath);
    const finReceitas = readExcelFile<FinReceitaRow>(CONFIG.finReceitaPath);
    const carneParcelas = readExcelFile<CarneRow>(CONFIG.carnePath);

    console.log(`✓ ${atendimentos.length} atendimentos`);
    console.log(`✓ ${finReceitas.length} finReceitas`);
    console.log(`✓ ${carneParcelas.length} parcelas de carnê`);

    // Criar mapas
    console.log("\n🔗 Criando mapas...");

    // Mapa de finReceitas por atendimento
    const finReceitaMap = new Map<number, FinReceitaRow[]>();
    for (const rec of finReceitas) {
      if (!finReceitaMap.has(rec.recAtendimento)) {
        finReceitaMap.set(rec.recAtendimento, []);
      }
      finReceitaMap.get(rec.recAtendimento)!.push(rec);
    }

    // Mapa de carnê por atendimento
    const carneMap = new Map<number, CarneRow[]>();
    for (const parcela of carneParcelas) {
      if (!carneMap.has(parcela.carAtendimento)) {
        carneMap.set(parcela.carAtendimento, []);
      }
      carneMap.get(parcela.carAtendimento)!.push(parcela);
    }

    console.log(`✓ ${finReceitaMap.size} atendimentos com finReceita`);
    console.log(`✓ ${carneMap.size} atendimentos com carnê\n`);

    stats.total = atendimentos.length;

    // Processar cada atendimento
    console.log("🔄 Iniciando migração...\n");

    for (const atendimento of atendimentos) {
      try {
        // Verificar se venda existe
        const saleExists = await prisma.sale.findUnique({
          where: { id: atendimento.ateId },
        });

        if (!saleExists) {
          console.log(`⚠️  Payment: Venda ${atendimento.ateId} não existe`);
          stats.skipped++;
          errorLog.push({
            atendimento,
            error: `Venda ${atendimento.ateId} não encontrada`,
          });
          continue;
        }

        // Verificar se payment já existe
        const existingPayment = await prisma.payment.findUnique({
          where: { saleId: atendimento.ateId },
        });

        if (existingPayment) {
          console.log(`⏭️  Payment já existe para venda ${atendimento.ateId}`);
          stats.skipped++;
          continue;
        }

        // Buscar finReceitas do atendimento
        const receitas = finReceitaMap.get(atendimento.ateId) || [];

        // Calcular desconto total (soma de todas receitas)
        const totalDesconto = receitas.reduce((sum, rec) => {
          return sum + convertToDecimal(rec.recDesconto);
        }, 0);

        // Buscar carnê do atendimento
        const parcelas = carneMap.get(atendimento.ateId);

        // Calcular dados do carnê
        let installmentsTotal = 0;
        let paidAmount = 0;
        let installmentsPaid = 0;
        let firstDueDate: Date | null = null;
        let lastPaymentAt: Date | null = null;

        if (parcelas && parcelas.length > 0) {
          installmentsTotal = parcelas.length;

          // Calcular parcelas pagas
          const parcelasPagas = parcelas.filter(
            (p) =>
              p.carParcelaStatus === "Pago com sucesso" ||
              p.carParcelaStatus === "Pago com atraso"
          );

          installmentsPaid = parcelasPagas.length;
          paidAmount = parcelasPagas.reduce((sum, p) => {
            return sum + convertToDecimal(p.carValorParcela);
          }, 0);

          // Primeira data de vencimento
          const vencimentos = parcelas
            .map((p) => parseDate(p.carVencimento))
            .filter((d): d is Date => d !== null)
            .sort((a, b) => a.getTime() - b.getTime());

          if (vencimentos.length > 0) {
            firstDueDate = vencimentos[0];
          }

          // Última data de pagamento
          const pagamentos = parcelasPagas
            .map((p) => parseDate(p.carDataPagamento))
            .filter((d): d is Date => d !== null)
            .sort((a, b) => b.getTime() - a.getTime());

          if (pagamentos.length > 0) {
            lastPaymentAt = pagamentos[0];
          }
        } else {
          // Pagamento à vista
          paidAmount = convertToDecimal(atendimento.ateTotal);
        }

        // Determinar status
        const status = calculatePaymentStatus(parcelas);

        // Entrada
        const downPayment = convertToDecimal(atendimento.ateEntrada);

        // Total
        const total = convertToDecimal(atendimento.ateTotal);

        // Método de pagamento
        const method = mapPaymentMethod(atendimento.ateFormaPagamento);

        // Criar payment
        await prisma.payment.create({
          data: {
            saleId: atendimento.ateId,
            method,
            status,
            total,
            discount: totalDesconto,
            downPayment: downPayment || 0,
            installmentsTotal: installmentsTotal || null,
            paidAmount,
            installmentsPaid,
            lastPaymentAt,
            firstDueDate,
            tenantId: CONFIG.tenantId,
            branchId: CONFIG.branchId,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });

        console.log(
          `✓ Payment: Venda ${atendimento.ateId} - ${method} - ${status}`
        );
        stats.success++;
      } catch (error: any) {
        console.error(
          `✗ Erro ao migrar payment ${atendimento.ateId}: ${error.message}`
        );
        stats.errors++;
        errorLog.push({ atendimento, error: error.message });
      }
    }

    // Relatório final
    console.log("\n" + "=".repeat(80));
    console.log("RELATÓRIO DE MIGRAÇÃO");
    console.log("=".repeat(80));
    console.log(`Total de registros: ${stats.total}`);
    console.log(`✓ Sucesso:          ${stats.success}`);
    console.log(`⏭️  Ignorados:        ${stats.skipped}`);
    console.log(`✗ Erros:            ${stats.errors}`);
    console.log("=".repeat(80));

    // Log de erros
    if (errorLog.length > 0) {
      const errorLogPath = path.join(
        __dirname,
        "../data/logs/payments-errors.json"
      );
      fs.mkdirSync(path.dirname(errorLogPath), { recursive: true });
      fs.writeFileSync(errorLogPath, JSON.stringify(errorLog, null, 2));
      console.log(`\n⚠️  Log de erros salvo em: ${errorLogPath}`);
    }

    // Verificar total
    const totalInDb = await prisma.payment.count({
      where: { tenantId: CONFIG.tenantId },
    });

    console.log(`\n📊 Total de payments no banco: ${totalInDb}\n`);
  } catch (error: any) {
    console.error("\n❌ ERRO FATAL:", error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// ============================================================================
// EXECUTAR MIGRAÇÃO
// ============================================================================

migratePayments()
  .then(() => {
    console.log("✅ Migração concluída com sucesso!\n");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Falha na migração:", error);
    process.exit(1);
  });
