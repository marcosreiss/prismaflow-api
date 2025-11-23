/**
 * SCRIPT DE MIGRAÇÃO - MARCAS
 * Sistema: Ótica Cristã
 * Data: 2025-11-23
 *
 * Migra dados da tabela 'marca' do sistema antigo para o novo modelo
 */

import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";
import * as XLSX from "xlsx";

const prisma = new PrismaClient();

// ============================================================================
// CONFIGURAÇÃO
// ============================================================================

const CONFIG = {
  tenantId: "cmibvcyed00007m0118rkgft8",
  branchId: "cmibvcyed00017m014r66e39w",
  csvPath: path.join(__dirname, "../data/marca.xlsx"),
};

// ============================================================================
// INTERFACES
// ============================================================================

interface MarcaRow {
  marcaId: number;
  marcaNome: string;
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
 */
function readExcelFile(filePath: string): MarcaRow[] {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(worksheet) as MarcaRow[];
  return data;
}

/**
 * Valida dados da marca
 */
function validateMarca(marca: MarcaRow): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!marca.marcaId || marca.marcaId <= 0) {
    errors.push("marcaId inválido ou ausente");
  }

  if (!marca.marcaNome || marca.marcaNome.trim() === "") {
    errors.push("marcaNome vazio");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ============================================================================
// MIGRAÇÃO
// ============================================================================

async function migrateMarcas() {
  const stats: MigrationStats = {
    total: 0,
    success: 0,
    errors: 0,
    skipped: 0,
  };

  const errorLog: Array<{ marca: MarcaRow; error: string }> = [];

  console.log("\n" + "=".repeat(80));
  console.log("MIGRAÇÃO DE MARCAS - ÓTICA CRISTÃ");
  console.log("=".repeat(80));
  console.log(`\nTenant ID: ${CONFIG.tenantId}`);
  console.log(`Branch ID: ${CONFIG.branchId}`);
  console.log(`Arquivo: ${CONFIG.csvPath}\n`);

  try {
    // Ler arquivo Excel
    console.log("📂 Lendo arquivo Excel...");
    const marcas = readExcelFile(CONFIG.csvPath);
    stats.total = marcas.length;
    console.log(`✓ ${stats.total} marcas encontradas\n`);

    // Processar cada marca
    console.log("🔄 Iniciando migração...\n");

    for (const marca of marcas) {
      try {
        // Validar dados
        const validation = validateMarca(marca);
        if (!validation.valid) {
          console.log(
            `⚠️  Marca ${marca.marcaId} inválida: ${validation.errors.join(
              ", "
            )}`
          );
          stats.skipped++;
          errorLog.push({ marca, error: validation.errors.join(", ") });
          continue;
        }

        // Verificar se já existe
        const existing = await prisma.brand.findUnique({
          where: { name: marca.marcaNome },
        });

        if (existing) {
          console.log(
            `⏭️  Marca "${marca.marcaNome}" já existe (ID: ${existing.id})`
          );
          stats.skipped++;
          continue;
        }

        // Criar marca
        await prisma.brand.create({
          data: {
            id: marca.marcaId,
            name: marca.marcaNome,
            isActive: true,
            tenantId: CONFIG.tenantId,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });

        console.log(`✓ Marca ${marca.marcaId}: ${marca.marcaNome}`);
        stats.success++;
      } catch (error: any) {
        console.error(
          `✗ Erro ao migrar marca ${marca.marcaId}: ${error.message}`
        );
        stats.errors++;
        errorLog.push({ marca, error: error.message });
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
        "../data/logs/marcas-errors.json"
      );
      fs.mkdirSync(path.dirname(errorLogPath), { recursive: true });
      fs.writeFileSync(errorLogPath, JSON.stringify(errorLog, null, 2));
      console.log(`\n⚠️  Log de erros salvo em: ${errorLogPath}`);
    }

    // Verificar total de marcas no banco
    const totalInDb = await prisma.brand.count({
      where: { tenantId: CONFIG.tenantId },
    });

    console.log(`\n📊 Total de marcas no banco: ${totalInDb}\n`);
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

migrateMarcas()
  .then(() => {
    console.log("✅ Migração concluída com sucesso!\n");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Falha na migração:", error);
    process.exit(1);
  });
