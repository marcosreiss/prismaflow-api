/**
 * SCRIPT DE MIGRAÇÃO - CLIENTES
 * Sistema: Ótica Cristã
 * Data: 2025-11-23
 *
 * Migra dados das tabelas 'pessoa' + 'pesCliente' do sistema antigo para o novo modelo
 */

import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";
import * as XLSX from "xlsx";
import {
  cleanCPF,
  cleanPhone,
  extractFatherName,
  extractMotherName,
  mapGender,
} from "./utils/converters";

const prisma = new PrismaClient();

// ============================================================================
// CONFIGURAÇÃO
// ============================================================================

const CONFIG = {
  tenantId: "cmibvcyed00007m0118rkgft8",
  branchId: "cmibvcyed00017m014r66e39w",
  pessoaPath: path.join(__dirname, "../data/pessoa.xlsx"),
  pesClientePath: path.join(__dirname, "../data/pesCliente.xlsx"),
};

// ============================================================================
// INTERFACES
// ============================================================================

interface PessoaRow {
  pesId: number;
  pesNome: string;
  pesCel?: string;
  pesTel?: string;
  pesRua?: string;
  pesBairro?: string;
  pesCidade?: string;
  pesUf?: string;
  pesCep?: string;
  pesComp?: string;
  pesEmail?: string;
  pesTipo: number;
  pesDoc?: string;
  pesDataNasc?: Date | string;
  pesSexo?: string;
  pesContato?: string;
  pesSite?: string;
}

interface PesClienteRow {
  cliPessoa: number;
  cliConjuge?: string;
  cliFiliacao?: string;
  cliRefNome1?: string;
  cliRefContato1?: string;
  cliRefNome2?: string;
  cliRefContato2?: string;
  cliRefNome3?: string;
  cliRefContato3?: string;
  cliSpc?: string;
  cliRg?: string;
  cliProfissao?: string;
  cliEmpresa?: string;
  cliAtendimentos?: string;
}

interface ClienteMerged extends PessoaRow, PesClienteRow {}

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
function readExcelFile<T>(filePath: string): T[] {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(worksheet) as T[];
  return data;
}

/**
 * Faz JOIN entre pessoa e pesCliente
 */
function joinPessoaCliente(
  pessoas: PessoaRow[],
  pesClientes: PesClienteRow[]
): ClienteMerged[] {
  const clientesMap = new Map(pesClientes.map((pc) => [pc.cliPessoa, pc]));

  return pessoas
    .filter((p) => p.pesTipo === 3) // Apenas clientes
    .map((p) => {
      const pc = clientesMap.get(p.pesId);
      if (!pc) return null;
      return { ...p, ...pc } as ClienteMerged;
    })
    .filter((c): c is ClienteMerged => c !== null);
}

/**
 * Valida dados do cliente
 */
function validateCliente(cliente: ClienteMerged): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!cliente.pesId || cliente.pesId <= 0) {
    errors.push("pesId inválido ou ausente");
  }

  if (!cliente.pesNome || cliente.pesNome.trim() === "") {
    errors.push("pesNome vazio");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Converte data para formato Date
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

async function migrateClientes() {
  const stats: MigrationStats = {
    total: 0,
    success: 0,
    errors: 0,
    skipped: 0,
  };

  const errorLog: Array<{ cliente: ClienteMerged; error: string }> = [];

  console.log("\n" + "=".repeat(80));
  console.log("MIGRAÇÃO DE CLIENTES - ÓTICA CRISTÃ");
  console.log("=".repeat(80));
  console.log(`\nTenant ID: ${CONFIG.tenantId}`);
  console.log(`Branch ID: ${CONFIG.branchId}`);
  console.log(`Arquivo pessoa: ${CONFIG.pessoaPath}`);
  console.log(`Arquivo pesCliente: ${CONFIG.pesClientePath}\n`);

  try {
    // Ler arquivos Excel
    console.log("📂 Lendo arquivos Excel...");
    const pessoas = readExcelFile<PessoaRow>(CONFIG.pessoaPath);
    const pesClientes = readExcelFile<PesClienteRow>(CONFIG.pesClientePath);

    console.log(`✓ ${pessoas.length} pessoas encontradas`);
    console.log(`✓ ${pesClientes.length} registros pesCliente encontrados`);

    // Fazer JOIN
    console.log("\n🔗 Fazendo JOIN pessoa + pesCliente...");
    const clientes = joinPessoaCliente(pessoas, pesClientes);
    stats.total = clientes.length;
    console.log(`✓ ${stats.total} clientes válidos após JOIN\n`);

    // Processar cada cliente
    console.log("🔄 Iniciando migração...\n");

    for (const cliente of clientes) {
      try {
        // Validar dados
        const validation = validateCliente(cliente);
        if (!validation.valid) {
          console.log(
            `⚠️  Cliente ${cliente.pesId} inválido: ${validation.errors.join(
              ", "
            )}`
          );
          stats.skipped++;
          errorLog.push({ cliente, error: validation.errors.join(", ") });
          continue;
        }

        // Verificar se já existe (por CPF ou nome)
        const cpfLimpo = cleanCPF(cliente.pesDoc);

        let existing = null;
        if (cpfLimpo) {
          existing = await prisma.client.findUnique({
            where: { cpf: cpfLimpo },
          });
        }

        if (!existing) {
          existing = await prisma.client.findFirst({
            where: {
              name: cliente.pesNome,
              tenantId: CONFIG.tenantId,
            },
          });
        }

        if (existing) {
          console.log(
            `⏭️  Cliente "${cliente.pesNome}" já existe (ID: ${existing.id})`
          );
          stats.skipped++;
          continue;
        }

        // Extrair filiação
        const motherName = extractMotherName(cliente.cliFiliacao);
        const fatherName = extractFatherName(cliente.cliFiliacao);

        // Converter data de nascimento
        const bornDate = parseDate(cliente.pesDataNasc);

        // Mapear isBlacklisted
        const isBlacklisted = cliente.cliSpc?.toUpperCase() === "SIM";

        // Criar cliente
        await prisma.client.create({
          data: {
            id: cliente.pesId,
            name: cliente.pesNome,
            cpf: cpfLimpo,
            rg: cliente.cliRg || null,
            bornDate,
            gender: mapGender(cliente.pesSexo),
            fatherName,
            motherName,
            spouse: cliente.cliConjuge || null,
            email: cliente.pesEmail || null,
            company: cliente.cliEmpresa || null,
            occupation: cliente.cliProfissao || null,
            street: cliente.pesRua || null,
            neighborhood: cliente.pesBairro || null,
            city: cliente.pesCidade || null,
            uf: cliente.pesUf || null,
            cep: cliente.pesCep || null,
            complement: cliente.pesComp || null,
            isBlacklisted,
            phone01: cleanPhone(cliente.pesCel),
            phone02: cleanPhone(cliente.pesTel),
            reference01: cliente.cliRefNome1 || null,
            reference02: cliente.cliRefNome2 || null,
            reference03: cliente.cliRefNome3 || null,
            isActive: true,
            tenantId: CONFIG.tenantId,
            branchId: CONFIG.branchId,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });

        console.log(`✓ Cliente ${cliente.pesId}: ${cliente.pesNome}`);
        stats.success++;
      } catch (error: any) {
        console.error(
          `✗ Erro ao migrar cliente ${cliente.pesId}: ${error.message}`
        );
        stats.errors++;
        errorLog.push({ cliente, error: error.message });
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
        "../data/logs/clientes-errors.json"
      );
      fs.mkdirSync(path.dirname(errorLogPath), { recursive: true });
      fs.writeFileSync(errorLogPath, JSON.stringify(errorLog, null, 2));
      console.log(`\n⚠️  Log de erros salvo em: ${errorLogPath}`);
    }

    // Verificar total de clientes no banco
    const totalInDb = await prisma.client.count({
      where: { tenantId: CONFIG.tenantId },
    });

    console.log(`\n📊 Total de clientes no banco: ${totalInDb}`);

    // Estatísticas de blacklist
    const blacklisted = await prisma.client.count({
      where: {
        tenantId: CONFIG.tenantId,
        isBlacklisted: true,
      },
    });

    console.log(`📊 Clientes na blacklist: ${blacklisted}\n`);
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

migrateClientes()
  .then(() => {
    console.log("✅ Migração concluída com sucesso!\n");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Falha na migração:", error);
    process.exit(1);
  });
