# ⚙️ Middleware Overview

Documentação técnica dos **middlewares globais e específicos** utilizados no projeto **PrismaFlow API**.

Eles são responsáveis por segurança, validação, logs, autenticação, autorização e tratamento de erros.

---

## 🧩 Sumário

1. [🌍 global.middleware.ts](#-globalmiddlewarets)
2. [🔐 auth.middleware.ts](#-authmiddlewarets)
3. [🧾 authorize.middleware.ts](#-authorizemiddlewarets)
4. [✅ validation.middleware.ts](#-validationmiddlewarets)
5. [🚨 error.middleware.ts](#-errormiddlewarets)
6. [💡 Boas práticas de uso](#-boas-práticas-de-uso)


---

## 🌍 `global.middleware.ts`

### **Função**

Responsável por aplicar **middlewares globais** de segurança, logs e parsing de requisições HTTP.

### **O que ele faz**

- Aplica **Helmet** → protege contra vulnerabilidades HTTP comuns.
- Configura **CORS** → libera acesso de origens específicas ao backend.
- Habilita o **JSON parser** do Express.
- Registra logs de requisições HTTP via **Morgan** (formato `dev`).

### **Regra de negócio**

Nenhuma — é puramente técnico e deve ser aplicado **no início da configuração do servidor**.

### **Uso**

```tsx
import express from "express";
import { globalMiddleware } from "./middlewares/global.middleware";

const app = express();
globalMiddleware(app);

```

---

## 🔐 `auth.middleware.ts`

### **Função**

Valida o **token JWT** enviado no header da requisição e injeta o usuário decodificado (`req.user`) no contexto da request.

### **O que ele faz**

1. Verifica se o header contém `Authorization: Bearer <token>`.
2. Valida o token JWT usando `env.JWT_SECRET`.
3. Decodifica os dados do token → `{ sub, email, tenantId, role, branchId? }`.
4. Injeta `req.user` com o payload validado.
5. Retorna erro 401 se o token estiver ausente, inválido ou expirado.

### **Regra de negócio**

- Exige que a rota tenha um **usuário autenticado**.
- Utilizado em conjunto com o `requireRoles()` para controle de acesso por perfil (RBAC).

### **Uso**

```tsx
import { Router } from "express";
import { authGuard } from "../middlewares/auth.middleware";

router.get("/profile", authGuard, (req, res) => {
  res.json({ user: req.user });
});

```

### **Erro retornado**

```json
{
  "success": false,
  "message": "Token inválido ou expirado.",
  "status": 401
}

```

---

## 🧾 `authorize.middleware.ts`

### **Função**

Controla o **acesso baseado em papéis (RBAC)**.

Permite restringir rotas para usuários de certos perfis (`ADMIN`, `MANAGER`, `EMPLOYEE`).

### **O que ele faz**

- Recebe uma ou mais roles permitidas como parâmetro.
- Lê o `req.user.role` (definido pelo `authGuard`).
- Caso o usuário não tenha uma role autorizada, retorna 403 com mensagem de acesso negado.

### **Regra de negócio**

- `ADMIN` tem acesso total ao tenant.
- `MANAGER` possui escopo limitado à própria filial.
- `EMPLOYEE` possui acesso restrito.

### **Uso**

```tsx
import { requireRoles } from "../middlewares/authorize.middleware";
import { authGuard } from "../middlewares/auth.middleware";

router.post(
  "/branches",
  authGuard,
  requireRoles("ADMIN"),
  createBranch
);

```

### **Erro retornado**

```json
{
  "success": false,
  "message": "Acesso negado: permissão insuficiente.",
  "status": 403
}

```

---

## ✅ `validation.middleware.ts`

### **Função**

Valida automaticamente o corpo (`body`), parâmetros (`params`) ou query string (`query`) de uma requisição, com base em **DTOs decorados com `class-validator`**.

### **O que ele faz**

1. Converte o conteúdo recebido em uma instância da classe DTO (`plainToInstance`).
2. Valida os campos conforme as regras declaradas (`@IsEmail`, `@MinLength`, etc.).
3. Se houver erros, retorna status 400 com lista de mensagens.
4. Caso contrário, continua para o próximo middleware/controller.

### **Regra de negócio**

- Regras declarativas de validação em nível de DTO.
- Evita que dados inválidos cheguem ao service ou repository.

### **Uso**

```tsx
import { validateDto } from "../middlewares/validation.middleware";
import { CreateUserDto } from "../modules/users/dtos/create-user.dto";

router.post(
  "/users",
  authGuard,
  validateDto(CreateUserDto, "body"),
  createUser
);

```

### **Erro retornado**

```json
{
  "success": false,
  "message": "Erro de validação.",
  "errors": [
    "O e-mail informado é inválido.",
    "A senha deve ter pelo menos 6 caracteres."
  ],
  "status": 400
}

```

---

## 🚨 `error.middleware.ts`

### **Função**

Middleware global de **tratamento centralizado de erros**.

Captura exceções não tratadas em rotas, services e middlewares, retornando um padrão de resposta uniforme.

### **O que ele faz**

- Intercepta qualquer erro lançado por `next(err)`.
- Retorna um `ApiResponse.error()` padronizado com status HTTP apropriado.
- Evita duplicação de try/catch em controllers.
- Garante que respostas de erro sigam o mesmo formato JSON.

### **Regra de negócio**

Nenhuma — é um **mecanismo de infraestrutura**, mas garante consistência nas respostas de falha.

### **Uso**

Aplicado **no final da cadeia de middlewares**:

```tsx
import express from "express";
import { errorMiddleware } from "./middlewares/error.middleware";

const app = express();
// ... rotas
app.use(errorMiddleware);

```

### **Erro retornado**

```json
{
  "success": false,
  "message": "Erro interno do servidor.",
  "status": 500
}

```

---

## 💡 Boas Práticas de Uso

| Middleware | Deve ser aplicado | Exemplo |
| --- | --- | --- |
| **global.middleware** | Na inicialização do app | `globalMiddleware(app)` |
| **auth.middleware** | Antes de qualquer rota protegida | `router.use(authGuard)` |
| **authorize.middleware** | Após o `authGuard` | `requireRoles("ADMIN")` |
| **validation.middleware** | Antes do controller | `validateDto(DtoClass, "body")` |
| **error.middleware** | No final de todas as rotas | `app.use(errorMiddleware)` |

---

## 🧠 Fluxo de Execução (Request Lifecycle)

```
Express App
  ↓
global.middleware.ts   → Segurança / Logs / JSON
  ↓
auth.middleware.ts     → Valida JWT e injeta req.user
  ↓
authorize.middleware.ts → Verifica roles permitidas
  ↓
validation.middleware.ts → Valida DTO
  ↓
Controller → Service → Repository
  ↓
error.middleware.ts     → Captura exceções e retorna ApiResponse.error()

```

---

##