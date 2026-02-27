/**
 * SCRIPT DE MIGRAÇÃO - PARCELAS DE PAGAMENTO
 * Sistema: Ótica Cristã
 * Data: 2025-11-24
 *
 * Migra dados da tabela 'carne' para PaymentInstallment
 */

import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";
import * as XLSX from "xlsx";
import { convertToDecimal } from "./utils/converters";

const prisma = new PrismaClient();

// ============================================================================
// CONFIGURAÇÃO
// ============================================================================

const CONFIG = {
  tenantId: "cmibvcyed00007m0118rkgft8",
  branchId: "cmibvcyed00017m014r66e39w",
  carnePath: path.join(__dirname, "../data/carne.xlsx"),
};

// ============================================================================
// INTERFACES
// ============================================================================

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
    if (row.carId) row.carId = parseInt(row.carId, 10);
    if (row.carAtendimento)
      row.carAtendimento = parseInt(row.carAtendimento, 10);
    if (row.carParcelas) row.carParcelas = parseInt(row.carParcelas, 10);
    if (row.carNumeroParcela)
      row.carNumeroParcela = parseInt(row.carNumeroParcela, 10);
    return row as T;
  });
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

/**
 * Verifica se parcela foi paga
 */
function isPaid(status: string): boolean {
  return status === "Pago com sucesso" || status === "Pago com atraso";
}

// ============================================================================
// MIGRAÇÃO
// ============================================================================

async function migrateInstallments() {
  const stats: MigrationStats = {
    total: 0,
    success: 0,
    errors: 0,
    skipped: 0,
  };

  const errorLog: Array<{ parcela: CarneRow; error: string }> = [];

  console.log("\n" + "=".repeat(80));
  console.log("MIGRAÇÃO DE PARCELAS - ÓTICA CRISTÃ");
  console.log("=".repeat(80));
  console.log(`\nTenant ID: ${CONFIG.tenantId}`);
  console.log(`Branch ID: ${CONFIG.branchId}`);
  console.log(`Arquivo: ${CONFIG.carnePath}\n`);

  try {
    // Ler arquivo
    console.log("📂 Lendo arquivo Excel...");
    const parcelas = readExcelFile<CarneRow>(CONFIG.carnePath);

    stats.total = parcelas.length;
    console.log(`✓ ${stats.total} parcelas encontradas\n`);

    // Processar cada parcela
    console.log("🔄 Iniciando migração...\n");

    for (const parcela of parcelas) {
      try {
        // Validar dados
        if (!parcela.carAtendimento || parcela.carAtendimento <= 0) {
          console.log(`⚠️  Parcela ${parcela.carId}: carAtendimento inválido`);
          stats.skipped++;
          errorLog.push({ parcela, error: "carAtendimento inválido" });
          continue;
        }

        // Buscar payment pelo saleId (carAtendimento)
        const payment = await prisma.payment.findUnique({
          where: { saleId: parcela.carAtendimento },
        });

        if (!payment) {
          console.log(
            `⚠️  Parcela ${parcela.carId}: Payment não existe para venda ${parcela.carAtendimento}`
          );
          stats.skipped++;
          errorLog.push({
            parcela,
            error: `Payment não encontrado para venda ${parcela.carAtendimento}`,
          });
          continue;
        }

        // Verificar se parcela já existe (por paymentId + sequence)
        const existingInstallment = await prisma.paymentInstallment.findFirst({
          where: {
            paymentId: payment.id,
            sequence: parcela.carNumeroParcela,
          },
        });

        if (existingInstallment) {
          console.log(
            `⏭️  Parcela ${parcela.carNumeroParcela} do payment ${payment.id} já existe`
          );
          stats.skipped++;
          continue;
        }

        // Calcular valores
        const amount = convertToDecimal(parcela.carValorParcela);
        const paidAmount = isPaid(parcela.carParcelaStatus) ? amount : 0;
        const paidAt = isPaid(parcela.carParcelaStatus)
          ? parseDate(parcela.carDataPagamento)
          : null;

        // Criar parcela
        await prisma.paymentInstallment.create({
          data: {
            paymentId: payment.id,
            sequence: parcela.carNumeroParcela,
            amount,
            paidAmount,
            paidAt,
            tenantId: CONFIG.tenantId,
            branchId: CONFIG.branchId,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });

        console.log(
          `✓ Parcela ${parcela.carNumeroParcela}/${parcela.carParcelas}: Payment ${payment.id} - ${parcela.carParcelaStatus}`
        );
        stats.success++;
      } catch (error: any) {
        console.error(
          `✗ Erro ao migrar parcela ${parcela.carId}: ${error.message}`
        );
        stats.errors++;
        errorLog.push({ parcela, error: error.message });
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
        "../data/logs/installments-errors.json"
      );
      fs.mkdirSync(path.dirname(errorLogPath), { recursive: true });
      fs.writeFileSync(errorLogPath, JSON.stringify(errorLog, null, 2));
      console.log(`\n⚠️  Log de erros salvo em: ${errorLogPath}`);
    }

    // Verificar total
    const totalInDb = await prisma.paymentInstallment.count({
      where: { tenantId: CONFIG.tenantId },
    });

    console.log(`\n📊 Total de parcelas no banco: ${totalInDb}`);

    // Estatísticas de status
    const paidCount = await prisma.paymentInstallment.count({
      where: {
        tenantId: CONFIG.tenantId,
        paidAt: { not: null },
      },
    });

    const pendingCount = totalInDb - paidCount;

    console.log(`📊 Parcelas pagas: ${paidCount}`);
    console.log(`📊 Parcelas pendentes: ${pendingCount}\n`);
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

migrateInstallments()
  .then(() => {
    console.log("✅ Migração concluída com sucesso!\n");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Falha na migração:", error);
    process.exit(1);
  });
