import fs from "node:fs";
import path from "node:path";
import * as xlsx from "xlsx";
import { PrismaClient, ProductCategory } from "@prisma/client";
import chalk from "chalk";

const prisma = new PrismaClient();
const tenantId = "cmibvcyed00007m0118rkgft8";
const branchId = "cmibvcyed00017m014r66e39w"; // ← FIXO

type ProductRow = {
  prodId?: number | string;
  prodNome: string;
  prodMarca?: string | number;
  prodPrecoCompra?: string | number;
  prodPrecoVenda?: string | number;
  prodPercentual?: string | number;
  prodQtd?: string | number;
  prodTipo?: string;
};

type CreateRow = {
  prodId: string | number;
  name: string;
  brandId: number | null;
  costPrice: number | null;
  salePrice: number | null;
  stockQuantity: number;
  category: ProductCategory;
  prodTipo: string;
};

type ErrorRow = {
  type: string;
  prodId: string | number;
  name: string;
  details: string;
};

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

function parseFloatBr(value: any): number | null {
  if (value === null || value === undefined || value === "") return null;
  const s = String(value)
    .replace(/[.,]/g, (m, i, str) =>
      str.includes(",") && m === "," ? "." : "",
    )
    .replace(/\D/g, "");
  const n = parseFloat(s) / 100;
  return isNaN(n) ? null : n;
}

function parseIntSafe(value: any): number {
  const n = parseInt(String(value));
  return isNaN(n) ? 0 : n;
}

async function main() {
  const dataPath = path.resolve("migrations/oticacrista/data/produto.xlsx");
  const logsBase = path.resolve("migrations/oticacrista/logs");
  const logDir = path.join(
    logsBase,
    nowFolderName(new Date(), "verificar-produtos-faltantes"),
  );
  ensureDir(logDir);

  const created: CreateRow[] = [];
  const errors: ErrorRow[] = [];
  const skipped: { prodId: string | number; name: string; reason: string }[] =
    [];

  console.log(chalk.blue(`🔍 Lendo ${dataPath}`));

  // Lê xlsx
  let rows: ProductRow[] = [];
  try {
    const wb = xlsx.readFile(dataPath, { cellDates: true });
    const sheet = wb.Sheets["produto"];
    if (!sheet) throw new Error('Aba "produto" não encontrada');
    rows = xlsx.utils.sheet_to_json(sheet, { defval: null });
    console.log(chalk.green(`✅ ${rows.length} linhas lidas`));
  } catch (e: any) {
    console.error(chalk.red(`❌ Erro xlsx: ${e.message}`));
    process.exit(1);
  }

  // Mapeia brands
  console.log(chalk.blue("🔗 Mapeando brands..."));
  const brandMap = new Map<string, number>();
  for (const row of rows) {
    const marca = String(row.prodMarca || "").trim();
    if (
      marca &&
      !brandMap.has(marca) &&
      marca !== "0" &&
      !marca.includes(".")
    ) {
      try {
        let brand = await prisma.brand.findUnique({
          where: { name: marca, tenantId },
        });
        if (!brand) {
          brand = await prisma.brand.create({
            data: { name: marca, tenantId, isActive: true },
          });
        }
        brandMap.set(marca, brand.id);
      } catch (e: any) {
        errors.push({
          type: "BRAND_ERROR",
          prodId: row.prodId || "?",
          name: row.prodNome || "",
          details: e.message,
        });
      }
    }
  }

  // Processa produtos (busca por name+tenantId SÓ)
  console.log(
    chalk.blue(
      `🚀 Verificando produtos para tenant ${tenantId.slice(0, 8)}...`,
    ),
  );
  let processed = 0;
  const total = rows.length;

  for (const row of rows) {
    processed++;
    const prodId = row.prodId || "?";
    const name = String(row.prodNome || "").trim();
    const prodTipo = String(row.prodTipo || "").trim();

    if (!name || name === "Produto Indisponivel") {
      skipped.push({ prodId, name, reason: "nome inválido" });
      process.stdout.write(`\r${chalk.yellow("⏭")} ${processed}/${total}`);
      continue;
    }

    // Busca por name+tenantId SÓ
    const existing = await prisma.product.findFirst({
      where: { name, tenantId },
    });

    if (existing) {
      skipped.push({ prodId, name, reason: "já existe" });
      process.stdout.write(`\r${chalk.yellow("⏭")} ${processed}/${total}`);
      continue;
    }

    // Categoria POR prodTipo
    let category: ProductCategory;
    const tipoLower = prodTipo.toLowerCase();
    if (tipoLower === "produto") {
      if (
        name.toLowerCase().includes("armao") ||
        name.toLowerCase().includes("oculos")
      ) {
        category = "FRAME";
      } else if (
        name.toLowerCase().includes("lente") ||
        name.toLowerCase().includes("bif")
      ) {
        category = "LENS";
      } else {
        category = "ACCESSORY";
      }
    } else {
      category = "ACCESSORY"; // SERVIO → ACCESSORY
    }

    // Cria
    try {
      const brandId = brandMap.get(String(row.prodMarca || "")) || null;
      const data = {
        name,
        description: `Importado produto.xlsx (ID:${prodId}, tipo:${prodTipo})`,
        costPrice: parseFloatBr(row.prodPrecoCompra),
        salePrice: parseFloatBr(row.prodPrecoVenda),
        stockQuantity: parseIntSafe(row.prodQtd),
        minimumStock: 0,
        category,
        isActive: true,
        tenantId,
        branchId, // ← FIXO cmibvcyed00017m014r66e39w
        brandId,
      };

      const product = await prisma.product.create({ data });
      created.push({ ...data, prodId, brandId, prodTipo });

      process.stdout.write(
        `\r${chalk.green("✅")} ${processed}/${total} | ${chalk.greenBright(created.length)} criados`,
      );
    } catch (e: any) {
      errors.push({ type: "CREATE_ERROR", prodId, name, details: e.message });
      process.stdout.write(
        `\r${chalk.red("❌")} ${processed}/${total} | ${chalk.redBright(errors.length)} err`,
      );
    }
  }

  console.log("\n");

  // Logs
  fs.writeFileSync(path.join(logDir, "created.csv"), toCsv(created));
  fs.writeFileSync(path.join(logDir, "skipped.csv"), toCsv(skipped));
  fs.writeFileSync(path.join(logDir, "errors.csv"), toCsv(errors));
  fs.writeFileSync(
    path.join(logDir, "summary.json"),
    JSON.stringify(
      {
        ok: true,
        tenantId,
        branchId,
        dataPath,
        totalRows: rows.length,
        created: created.length,
        skipped: skipped.length,
        errors: errors.length,
        ranAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );

  console.log(
    chalk.green(`🎉 ${chalk.bold(created.length)} produtos criados!`),
  );
  console.log(chalk.gray(`📁 Logs: ${logDir}`));
}

main()
  .catch(async (e) => {
    console.error(chalk.red("💥 Erro:", e));
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
