/**
 * SCRIPT DE MIGRAÇÃO - PRODUTOS
 * Sistema: Ótica Cristã
 * Data: 2025-11-23
 *
 * Migra dados da tabela 'produto' do sistema antigo para o novo modelo
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
  csvPath: path.join(__dirname, "../data/produto.xlsx"),
  defaultBrandId: 1, // "Sem Marca"
};

// ============================================================================
// INTERFACES
// ============================================================================

interface ProdutoRow {
  prodId: number;
  prodNome: string;
  prodMarca?: number;
  prodPrecoCompra: string | number;
  prodPrecoVenda: string | number;
  prodPercentual: string | number;
  prodQtd: number;
  prodTipo: string;
}

interface MigrationStats {
  total: number;
  success: number;
  errors: number;
  skipped: number;
}

type ProductCategory = "FRAME" | "LENS" | "ACCESSORY";

// ============================================================================
// FUNÇÕES AUXILIARES
// ============================================================================

/**
 * Lê arquivo Excel e retorna array de objetos
 */
function readExcelFile(filePath: string): ProdutoRow[] {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(worksheet) as ProdutoRow[];
  return data;
}

/**
 * Mapeia tipo de produto para categoria
 */
function mapProductCategory(tipo: string | null | undefined): ProductCategory {
  if (!tipo) return "ACCESSORY";

  const PRODUCT_CATEGORY_MAP: Record<string, ProductCategory> = {
    PRODUTO: "FRAME",
    SERVIÇO: "ACCESSORY",
    "+TR": "ACCESSORY",
    "PRO  DUTO": "FRAME", // erro de digitação
  };

  return PRODUCT_CATEGORY_MAP[tipo.toUpperCase()] || "ACCESSORY";
}

/**
 * Valida dados do produto
 */
function validateProduto(produto: ProdutoRow): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!produto.prodId || produto.prodId <= 0) {
    errors.push("prodId inválido ou ausente");
  }

  if (!produto.prodNome || produto.prodNome.trim() === "") {
    errors.push("prodNome vazio");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ============================================================================
// MIGRAÇÃO
// ============================================================================

async function migrateProdutos() {
  const stats: MigrationStats = {
    total: 0,
    success: 0,
    errors: 0,
    skipped: 0,
  };

  const errorLog: Array<{ produto: ProdutoRow; error: string }> = [];

  console.log("\n" + "=".repeat(80));
  console.log("MIGRAÇÃO DE PRODUTOS - ÓTICA CRISTÃ");
  console.log("=".repeat(80));
  console.log(`\nTenant ID: ${CONFIG.tenantId}`);
  console.log(`Branch ID: ${CONFIG.branchId}`);
  console.log(`Arquivo: ${CONFIG.csvPath}\n`);

  try {
    // Ler arquivo Excel
    console.log("📂 Lendo arquivo Excel...");
    const produtos = readExcelFile(CONFIG.csvPath);
    stats.total = produtos.length;
    console.log(`✓ ${stats.total} produtos encontrados\n`);

    // Processar cada produto
    console.log("🔄 Iniciando migração...\n");

    for (const produto of produtos) {
      try {
        // Validar dados
        const validation = validateProduto(produto);
        if (!validation.valid) {
          console.log(
            `⚠️  Produto ${produto.prodId} inválido: ${validation.errors.join(
              ", "
            )}`
          );
          stats.skipped++;
          errorLog.push({ produto, error: validation.errors.join(", ") });
          continue;
        }

        // Verificar se já existe (por nome)
        const existing = await prisma.product.findFirst({
          where: {
            name: produto.prodNome,
            tenantId: CONFIG.tenantId,
          },
        });

        if (existing) {
          console.log(
            `⏭️  Produto "${produto.prodNome}" já existe (ID: ${existing.id})`
          );
          stats.skipped++;
          continue;
        }

        // Resolver brandId (usar default se null)
        const brandId = produto.prodMarca || CONFIG.defaultBrandId;

        // Verificar se a marca existe
        const brandExists = await prisma.brand.findUnique({
          where: { id: brandId },
        });

        if (!brandExists) {
          console.log(
            `⚠️  Produto ${produto.prodId}: Marca ${brandId} não existe. Usando marca padrão.`
          );
          errorLog.push({
            produto,
            error: `Marca ${brandId} não encontrada. Usando marca padrão (${CONFIG.defaultBrandId})`,
          });
        }

        // Converter preços
        const costPrice = convertToDecimal(produto.prodPrecoCompra);
        const salePrice = convertToDecimal(produto.prodPrecoVenda);
        const markup = convertToDecimal(produto.prodPercentual);

        // Criar produto
        await prisma.product.create({
          data: {
            id: produto.prodId,
            name: produto.prodNome,
            description: null,
            costPrice,
            markup,
            salePrice,
            stockQuantity: produto.prodQtd,
            minimumStock: 0,
            category: mapProductCategory(produto.prodTipo),
            isActive: true,
            tenantId: CONFIG.tenantId,
            branchId: CONFIG.branchId,
            brandId: brandExists ? brandId : CONFIG.defaultBrandId,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });

        console.log(`✓ Produto ${produto.prodId}: ${produto.prodNome}`);
        stats.success++;
      } catch (error: any) {
        console.error(
          `✗ Erro ao migrar produto ${produto.prodId}: ${error.message}`
        );
        stats.errors++;
        errorLog.push({ produto, error: error.message });
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
        "../data/logs/produtos-errors.json"
      );
      fs.mkdirSync(path.dirname(errorLogPath), { recursive: true });
      fs.writeFileSync(errorLogPath, JSON.stringify(errorLog, null, 2));
      console.log(`\n⚠️  Log de erros salvo em: ${errorLogPath}`);
    }

    // Verificar total de produtos no banco
    const totalInDb = await prisma.product.count({
      where: { tenantId: CONFIG.tenantId },
    });

    console.log(`\n📊 Total de produtos no banco: ${totalInDb}\n`);

    // Estatísticas por categoria
    console.log("📊 Produtos por categoria:");
    const byCategory = await prisma.product.groupBy({
      by: ["category"],
      where: { tenantId: CONFIG.tenantId },
      _count: true,
    });
    byCategory.forEach((cat) => {
      console.log(`   ${cat.category}: ${cat._count}`);
    });
    console.log();
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

migrateProdutos()
  .then(() => {
    console.log("✅ Migração concluída com sucesso!\n");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Falha na migração:", error);
    process.exit(1);
  });
