import fs from "node:fs";
import path from "node:path";
import * as xlsx from "xlsx";
import { PrismaClient } from "@prisma/client";
import chalk from "chalk";

const prisma = new PrismaClient();
const tenantId = "cmibvcyed00007m0118rkgft8";

function nowFolderName(d = new Date(), scriptName: string) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}_${scriptName}`;
}

function ensureDir(p: string) {
  fs.mkdirSync(p, { recursive: true });
}
function toCsv(rows: Record<string, any>[]) {
  if (rows.length === 0) return "";
  const headers = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
  const esc = (v: any): string => {
    if (v === null || v === undefined) return "";
    const str = String(v);
    if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
    return str;
  };
  return [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => esc(r[h])).join(",")),
  ].join("\n");
}

async function main() {
  const marcaPath = path.resolve("migrations/oticacrista/data/marca.xlsx");
  const produtoPath = path.resolve("migrations/oticacrista/data/produto.xlsx");
  const logDir = path.join(
    path.resolve("migrations/oticacrista/logs"),
    nowFolderName(new Date(), "corrigir-marcas"),
  );
  ensureDir(logDir);

  const renamed: { brandId: number; oldName: string; newName: string }[] = [];
  const deleted: { brandId: number; name: string; reason: string }[] = [];
  const errors: { type: string; details: string; name?: string }[] = [];

  // 1. Lê marca.xlsx → mapa marcaId(number) → marcaNome(string)
  console.log(chalk.blue("📖 Lendo marca.xlsx..."));
  let marcaMap = new Map<number, string>();
  try {
    const wb = xlsx.readFile(marcaPath);
    const sheet = wb.Sheets["marca"];
    if (!sheet) throw new Error('Aba "marca" não encontrada');
    const rows: any[] = xlsx.utils.sheet_to_json(sheet, { defval: null });
    for (const r of rows) {
      const id = parseInt(String(r["marcaId"] || r["marcId"] || ""));
      const nome = String(r["marcaNome"] || r["marcNome"] || "").trim();
      if (!isNaN(id) && nome) marcaMap.set(id, nome);
    }
    console.log(chalk.green(`✅ ${marcaMap.size} marcas carregadas`));
  } catch (e: any) {
    console.error(chalk.red(`❌ Erro marca.xlsx: ${e.message}`));
    process.exit(1);
  }

  // 2. Lê produto.xlsx → mapa prodMarca(number) → usado?
  console.log(chalk.blue("📖 Lendo produto.xlsx..."));
  let idsUsados = new Set<number>();
  try {
    const wb = xlsx.readFile(produtoPath);
    const sheet = wb.Sheets["produto"];
    const rows: any[] = xlsx.utils.sheet_to_json(sheet, { defval: null });
    for (const r of rows) {
      const id = Math.floor(parseFloat(String(r["prodMarca"] || "")));
      if (!isNaN(id) && id > 0) idsUsados.add(id);
    }
    console.log(
      chalk.green(`✅ ${idsUsados.size} IDs de marca usados nos produtos`),
    );
  } catch (e: any) {
    console.error(chalk.red(`❌ Erro produto.xlsx: ${e.message}`));
    process.exit(1);
  }

  // 3. Busca todas as brands do tenant no banco
  console.log(chalk.blue("🔍 Buscando brands no banco..."));
  const brandsNoBanco = await prisma.brand.findMany({ where: { tenantId } });
  console.log(
    chalk.yellow(`📦 ${brandsNoBanco.length} brands encontradas no banco`),
  );

  // 4. Identifica quais são inválidas (nome numérico ou que não bate com marcaMap)
  //    Padrão criado errado: name = "1", "5", "21", "5.0" etc.
  const invalidasRegex = /^\d+(\.\d+)?$/; // nome que é só número

  let processed = 0;
  const total = brandsNoBanco.length;

  for (const brand of brandsNoBanco) {
    processed++;
    process.stdout.write(`\r${chalk.yellow("🔄")} ${processed}/${total}`);

    const isNumericName = invalidasRegex.test(brand.name.trim());
    if (!isNumericName) continue; // nome parece correto, ignora

    const numId = Math.floor(parseFloat(brand.name.trim()));
    const nomeCorreto = marcaMap.get(numId);

    if (!nomeCorreto) {
      // Sem correspondência na tabela de marcas
      // Verifica se tem produtos vinculados
      const produtosVinculados = await prisma.product.count({
        where: { brandId: brand.id, tenantId },
      });
      if (produtosVinculados === 0) {
        // Pode deletar com segurança
        try {
          await prisma.brand.delete({ where: { id: brand.id } });
          deleted.push({
            brandId: brand.id,
            name: brand.name,
            reason: "sem correspondência e sem produtos",
          });
        } catch (e: any) {
          errors.push({
            type: "DELETE_ERROR",
            details: e.message,
            name: brand.name,
          });
        }
      } else {
        errors.push({
          type: "SEM_CORRESPONDENCIA",
          details: `Brand "${brand.name}" (id:${brand.id}) sem match no marca.xlsx mas tem ${produtosVinculados} produtos`,
          name: brand.name,
        });
      }
      continue;
    }

    // Verifica se já existe brand com o nome correto
    const jaExiste = await prisma.brand.findUnique({
      where: { name: nomeCorreto, tenantId },
    });

    if (jaExiste) {
      // Já existe brand com nome correto → redireciona produtos e deleta a inválida
      try {
        await prisma.product.updateMany({
          where: { brandId: brand.id, tenantId },
          data: { brandId: jaExiste.id },
        });
        await prisma.brand.delete({ where: { id: brand.id } });
        deleted.push({
          brandId: brand.id,
          name: brand.name,
          reason: `merged → brand "${nomeCorreto}" (id:${jaExiste.id})`,
        });
      } catch (e: any) {
        errors.push({
          type: "MERGE_ERROR",
          details: e.message,
          name: brand.name,
        });
      }
    } else {
      // Renomeia a brand inválida para o nome correto
      try {
        await prisma.brand.update({
          where: { id: brand.id },
          data: { name: nomeCorreto },
        });
        renamed.push({
          brandId: brand.id,
          oldName: brand.name,
          newName: nomeCorreto,
        });
      } catch (e: any) {
        errors.push({
          type: "RENAME_ERROR",
          details: e.message,
          name: brand.name,
        });
      }
    }
  }

  console.log("\n");

  // Logs
  fs.writeFileSync(path.join(logDir, "renamed.csv"), toCsv(renamed));
  fs.writeFileSync(path.join(logDir, "deleted.csv"), toCsv(deleted));
  fs.writeFileSync(path.join(logDir, "errors.csv"), toCsv(errors));
  fs.writeFileSync(
    path.join(logDir, "summary.json"),
    JSON.stringify(
      {
        ok: true,
        tenantId,
        totalBrandsNoBanco: brandsNoBanco.length,
        renamed: renamed.length,
        deleted: deleted.length,
        errors: errors.length,
        ranAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );

  console.log(
    chalk.green(`✅ ${chalk.bold(renamed.length)} brands renomeadas`),
  );
  console.log(
    chalk.yellow(
      `🗑  ${chalk.bold(deleted.length)} brands deletadas (inválidas/merged)`,
    ),
  );
  if (errors.length)
    console.log(chalk.red(`❌ ${errors.length} erros — ver errors.csv`));
  console.log(chalk.gray(`📁 Logs: ${logDir}`));
}

main()
  .catch(async (e) => {
    console.error(chalk.red("💥 Erro fatal:", e));
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
