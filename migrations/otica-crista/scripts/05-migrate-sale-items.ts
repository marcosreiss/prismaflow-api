/**
 * SCRIPT DE MIGRAÇÃO - ITENS DE VENDA
 * Sistema: Ótica Cristã
 * Data: 2025-11-24
 *
 * Migra dados da tabela 'itensAtendimento' para ItemProduct
 * OBS: Sistema antigo só tem produtos (não tem serviços ópticos)
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
  itensPath: path.join(__dirname, "../data/itensAtendimento.xlsx"),
};

// ============================================================================
// INTERFACES
// ============================================================================

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
    raw: false,
    defval: null,
  });

  // Converter IDs para number
  return data.map((row: any) => {
    if (row.itemAtendimento)
      row.itemAtendimento = parseFloat(row.itemAtendimento);
    if (row.itemProduto) row.itemProduto = parseInt(row.itemProduto, 10);
    if (row.itemQtd) row.itemQtd = parseInt(row.itemQtd, 10);
    return row as T;
  });
}

/**
 * Valida dados do item
 */
function validateItem(item: ItemAtendimentoRow): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!item.itemAtendimento || item.itemAtendimento <= 0) {
    errors.push("itemAtendimento inválido ou ausente");
  }

  if (!item.itemProduto || item.itemProduto <= 0) {
    errors.push("itemProduto inválido ou ausente");
  }

  if (!item.itemQtd || item.itemQtd <= 0) {
    errors.push("itemQtd inválido");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ============================================================================
// MIGRAÇÃO
// ============================================================================

async function migrateSaleItems() {
  const stats: MigrationStats = {
    total: 0,
    success: 0,
    errors: 0,
    skipped: 0,
  };

  const errorLog: Array<{ item: ItemAtendimentoRow; error: string }> = [];

  console.log("\n" + "=".repeat(80));
  console.log("MIGRAÇÃO DE ITENS DE VENDA - ÓTICA CRISTÃ");
  console.log("=".repeat(80));
  console.log(`\nTenant ID: ${CONFIG.tenantId}`);
  console.log(`Branch ID: ${CONFIG.branchId}`);
  console.log(`Arquivo: ${CONFIG.itensPath}\n`);

  try {
    // Ler arquivo Excel
    console.log("📂 Lendo arquivo Excel...");
    const itens = readExcelFile<ItemAtendimentoRow>(CONFIG.itensPath);

    stats.total = itens.length;
    console.log(`✓ ${stats.total} itens encontrados\n`);

    // Processar cada item
    console.log("🔄 Iniciando migração...\n");

    for (const item of itens) {
      try {
        // Validar dados
        const validation = validateItem(item);
        if (!validation.valid) {
          console.log(`⚠️  Item inválido: ${validation.errors.join(", ")}`);
          stats.skipped++;
          errorLog.push({ item, error: validation.errors.join(", ") });
          continue;
        }

        // Converter itemAtendimento para inteiro (pode vir como float no Excel)
        const saleId = Math.floor(item.itemAtendimento);

        // Verificar se venda existe
        const saleExists = await prisma.sale.findUnique({
          where: { id: saleId },
        });

        if (!saleExists) {
          console.log(`⚠️  Item: Venda ${saleId} não existe`);
          stats.skipped++;
          errorLog.push({
            item,
            error: `Venda ${saleId} não encontrada`,
          });
          continue;
        }

        // Verificar se produto existe
        const productExists = await prisma.product.findUnique({
          where: { id: item.itemProduto },
        });

        if (!productExists) {
          console.log(`⚠️  Item: Produto ${item.itemProduto} não existe`);
          stats.skipped++;
          errorLog.push({
            item,
            error: `Produto ${item.itemProduto} não encontrado`,
          });
          continue;
        }

        // Calcular valores
        const quantity = item.itemQtd;
        const subtotal = convertToDecimal(item.itemTotalParcial);
        const discount = convertToDecimal(item.itemDesc);
        const total = convertToDecimal(item.itemTotalGeral);
        const unitPrice = subtotal / quantity;

        // Criar item de produto
        await prisma.itemProduct.create({
          data: {
            saleId,
            productId: item.itemProduto,
            quantity,
            tenantId: CONFIG.tenantId,
            branchId: CONFIG.branchId,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });

        console.log(
          `✓ Item: Venda ${saleId} - Produto ${item.itemProduto} (Qtd: ${quantity})`
        );
        stats.success++;
      } catch (error: any) {
        console.error(`✗ Erro ao migrar item: ${error.message}`);
        stats.errors++;
        errorLog.push({ item, error: error.message });
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
        "../data/logs/sale-items-errors.json"
      );
      fs.mkdirSync(path.dirname(errorLogPath), { recursive: true });
      fs.writeFileSync(errorLogPath, JSON.stringify(errorLog, null, 2));
      console.log(`\n⚠️  Log de erros salvo em: ${errorLogPath}`);
    }

    // Verificar total de itens no banco
    const totalInDb = await prisma.itemProduct.count({
      where: { tenantId: CONFIG.tenantId },
    });

    console.log(`\n📊 Total de itens no banco: ${totalInDb}\n`);
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

migrateSaleItems()
  .then(() => {
    console.log("✅ Migração concluída com sucesso!\n");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Falha na migração:", error);
    process.exit(1);
  });
