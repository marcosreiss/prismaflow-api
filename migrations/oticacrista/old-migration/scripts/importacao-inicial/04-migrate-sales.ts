/**
 * SCRIPT DE MIGRAÇÃO - VENDAS (ATENDIMENTOS)
 * Sistema: Ótica Cristã
 * Data: 2025-11-24
 *
 * Migra dados da tabela 'atendimento' do sistema antigo para Sale
 */

import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";
import * as XLSX from "xlsx";
import { convertToDecimal } from "../utils/converters";

const prisma = new PrismaClient();

// ============================================================================
// CONFIGURAÇÃO
// ============================================================================

const CONFIG = {
  tenantId: "cmibvcyed00007m0118rkgft8",
  branchId: "cmibvcyed00017m014r66e39w",
  atendimentoPath: path.join(__dirname, "../data/atendimento.xlsx"),
  itensPath: path.join(__dirname, "../data/itensAtendimento.xlsx"),
};

// ============================================================================
// INTERFACES
// ============================================================================

interface AtendimentoRow {
  ateId: number;
  ateColaborador?: number;
  ateCliente: number;
  ateDataCompra: Date | string;
  ateDataVencimento?: Date | string;
  ateTotal: string | number;
  atePago?: string;
  ateFormaPagamento?: string;
  ateEntrada?: string | number;
}

interface ItemAtendimentoRow {
  itemAtendimento: number;
  itemProduto: number;
  itemQtd: number;
  itemTotalParcial: string | number;
  itemDesc: string | number;
  itemTotalGeral: string | number;
  itemObs?: string;
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
 * Lê arquivo Excel e retorna array de objetos
 * CONVERTE IDs para number
 */
function readExcelFile<T>(filePath: string): T[] {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(worksheet, {
    raw: false, // Não interpreta números automaticamente
    defval: null,
  });

  // Converter IDs para number
  return data.map((row: any) => {
    if (row.ateId) row.ateId = parseInt(row.ateId, 10);
    if (row.ateCliente) row.ateCliente = parseInt(row.ateCliente, 10);
    if (row.ateColaborador)
      row.ateColaborador = parseInt(row.ateColaborador, 10);
    if (row.itemAtendimento)
      row.itemAtendimento = parseInt(row.itemAtendimento, 10);
    if (row.itemProduto) row.itemProduto = parseInt(row.itemProduto, 10);
    if (row.itemQtd) row.itemQtd = parseInt(row.itemQtd, 10);
    return row as T;
  });
}

/**
 * Valida dados do atendimento
 */
function validateAtendimento(atendimento: AtendimentoRow): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!atendimento.ateId || atendimento.ateId <= 0) {
    errors.push("ateId inválido ou ausente");
  }

  if (!atendimento.ateCliente || atendimento.ateCliente <= 0) {
    errors.push("ateCliente inválido ou ausente");
  }

  if (!atendimento.ateDataCompra) {
    errors.push("ateDataCompra ausente");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Converte data para formato Date
 */
function parseDate(date: Date | string | undefined | null): Date {
  if (!date) return new Date();
  if (date instanceof Date) return date;

  try {
    const parsed = new Date(date);
    return isNaN(parsed.getTime()) ? new Date() : parsed;
  } catch {
    return new Date();
  }
}

/**
 * Calcula subtotal e desconto dos itens
 */
function calculateTotals(itens: ItemAtendimentoRow[]): {
  subtotal: number;
  discount: number;
} {
  let subtotal = 0;
  let totalDesconto = 0;

  for (const item of itens) {
    const totalParcial = convertToDecimal(item.itemTotalParcial);
    const desconto = convertToDecimal(item.itemDesc);

    subtotal += totalParcial;
    totalDesconto += desconto;
  }

  return {
    subtotal,
    discount: totalDesconto,
  };
}

// ============================================================================
// MIGRAÇÃO
// ============================================================================

async function migrateSales() {
  const stats: MigrationStats = {
    total: 0,
    success: 0,
    errors: 0,
    skipped: 0,
  };

  const errorLog: Array<{ atendimento: AtendimentoRow; error: string }> = [];

  console.log("\n" + "=".repeat(80));
  console.log("MIGRAÇÃO DE VENDAS (ATENDIMENTOS) - ÓTICA CRISTÃ");
  console.log("=".repeat(80));
  console.log(`\nTenant ID: ${CONFIG.tenantId}`);
  console.log(`Branch ID: ${CONFIG.branchId}`);
  console.log(`Arquivo atendimento: ${CONFIG.atendimentoPath}`);
  console.log(`Arquivo itens: ${CONFIG.itensPath}\n`);

  try {
    // Ler arquivos Excel
    console.log("📂 Lendo arquivos Excel...");
    const atendimentos = readExcelFile<AtendimentoRow>(CONFIG.atendimentoPath);
    const itens = readExcelFile<ItemAtendimentoRow>(CONFIG.itensPath);

    console.log(`✓ ${atendimentos.length} atendimentos encontrados`);
    console.log(`✓ ${itens.length} itens encontrados`);

    // Criar mapa de itens por atendimento
    console.log("\n🔗 Criando mapa de itens por atendimento...");
    const itensMap = new Map<number, ItemAtendimentoRow[]>();

    for (const item of itens) {
      if (!item.itemAtendimento) continue;

      if (!itensMap.has(item.itemAtendimento)) {
        itensMap.set(item.itemAtendimento, []);
      }
      itensMap.get(item.itemAtendimento)!.push(item);
    }

    console.log(`✓ Mapa criado: ${itensMap.size} atendimentos com itens\n`);

    stats.total = atendimentos.length;

    // Processar cada atendimento
    console.log("🔄 Iniciando migração...\n");

    for (const atendimento of atendimentos) {
      try {
        // Validar dados
        const validation = validateAtendimento(atendimento);
        if (!validation.valid) {
          console.log(
            `⚠️  Atendimento ${
              atendimento.ateId
            } inválido: ${validation.errors.join(", ")}`
          );
          stats.skipped++;
          errorLog.push({ atendimento, error: validation.errors.join(", ") });
          continue;
        }

        // Verificar se já existe
        const existing = await prisma.sale.findUnique({
          where: { id: atendimento.ateId },
        });

        if (existing) {
          console.log(`⏭️  Atendimento ${atendimento.ateId} já existe`);
          stats.skipped++;
          continue;
        }

        // Verificar se cliente existe
        const clientExists = await prisma.client.findUnique({
          where: { id: atendimento.ateCliente },
        });

        if (!clientExists) {
          console.log(
            `⚠️  Atendimento ${atendimento.ateId}: Cliente ${atendimento.ateCliente} não existe`
          );
          stats.skipped++;
          errorLog.push({
            atendimento,
            error: `Cliente ${atendimento.ateCliente} não encontrado`,
          });
          continue;
        }

        // Calcular valores dos itens
        const itensDoAtendimento = itensMap.get(atendimento.ateId) || [];
        const { subtotal, discount } = calculateTotals(itensDoAtendimento);

        // Total do atendimento
        const total = convertToDecimal(atendimento.ateTotal);

        // Criar venda
        await prisma.sale.create({
          data: {
            id: atendimento.ateId,
            clientId: atendimento.ateCliente,
            prescriptionId: null, // Será vinculado depois se houver
            subtotal: subtotal || total,
            discount: discount || 0,
            total,
            notes: null,
            isActive: true,
            tenantId: CONFIG.tenantId,
            branchId: CONFIG.branchId,
            createdAt: parseDate(atendimento.ateDataCompra),
            updatedAt: new Date(),
          },
        });

        console.log(
          `✓ Atendimento ${atendimento.ateId}: Cliente ${
            atendimento.ateCliente
          } - R$ ${total.toFixed(2)}`
        );
        stats.success++;
      } catch (error: any) {
        console.error(
          `✗ Erro ao migrar atendimento ${atendimento.ateId}: ${error.message}`
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
        "../data/logs/sales-errors.json"
      );
      fs.mkdirSync(path.dirname(errorLogPath), { recursive: true });
      fs.writeFileSync(errorLogPath, JSON.stringify(errorLog, null, 2));
      console.log(`\n⚠️  Log de erros salvo em: ${errorLogPath}`);
    }

    // Verificar total de vendas no banco
    const totalInDb = await prisma.sale.count({
      where: { tenantId: CONFIG.tenantId },
    });

    console.log(`\n📊 Total de vendas no banco: ${totalInDb}\n`);
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

migrateSales()
  .then(() => {
    console.log("✅ Migração concluída com sucesso!\n");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Falha na migração:", error);
    process.exit(1);
  });
